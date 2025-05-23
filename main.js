console.log("=== FEDERATED MNIST CLIENT v1.0 ===");
let websocket, model, modelReady = false;
let mnistData;
let mnistSample = null;

// Mostrar estado de carga de MNIST
(async () => {
    document.getElementById("mnist-status").textContent = "Cargando MNIST...";
    const resp = await fetch("mnist_sample.json");
    mnistSample = await resp.json();
    document.getElementById("mnist-status").className = "alert alert-success text-center mb-4";
    document.getElementById("mnist-status").textContent = "MNIST cargado ✔️";
    document.getElementById("connect").disabled = false;
    console.log("MNIST cargado");
})();

document.getElementById("connect").onclick = () => {
    websocket = new WebSocket("wss://test-ogae.onrender.com/ws");
    websocket.onopen = () => console.log("Conectado al servidor");
    websocket.onclose = () => {
        console.log("Desconectado del servidor");
        document.getElementById("trainAndSend").disabled = true;
        modelReady = false;
    };
    websocket.onerror = (e) => {
        console.error("Error en WebSocket:", e);
        document.getElementById("trainAndSend").disabled = true;
        modelReady = false;
    };
    websocket.onmessage = async (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "init_model") {
            model = tf.sequential();
            model.add(tf.layers.dense({units: 32, activation: 'relu', inputShape: [784]}));
            model.add(tf.layers.dense({units: 10, activation: 'softmax'}));
            model.compile({optimizer: 'sgd', loss: 'categoricalCrossentropy', metrics: ['accuracy']});
            console.log("Modelo en el cliente:");
            model.summary();
            const tensors = data.weights.map((arr, i) => {
                const shape = model.getWeights()[i].shape;
                if (shape.length === 2) {
                    // Transponer para compatibilidad PyTorch <-> TF.js
                    return tf.tensor(arr, [shape[1], shape[0]]).transpose();
                } else {
                    return tf.tensor(arr, shape);
                }
            });
            model.setWeights(tensors);
            tensors.forEach(t => t.dispose());
            modelReady = true;
            document.getElementById("trainAndSend").disabled = false;
            console.log("Modelo inicializado y pesos cargados");
        }
        if (data.type === "global_update" && data.weights) {
            const tensors = data.weights.map((arr, i) => {
                const shape = model.getWeights()[i].shape;
                if (shape.length === 2) {
                    return tf.tensor(arr, [shape[1], shape[0]]).transpose();
                } else {
                    return tf.tensor(arr, shape);
                }
            });
            model.setWeights(tensors);
            tensors.forEach(t => t.dispose());
            if (data.metrics) {
                const metricsList = document.getElementById("metrics");
                metricsList.innerHTML = "";
                for (const [k, v] of Object.entries(data.metrics)) {
                    metricsList.innerHTML += `<li class="list-group-item">${k}: ${parseFloat(v).toFixed(4)}</li>`;
                }
                // Actualiza los gráficos
                if (typeof data.metrics.accuracy !== "undefined" && typeof data.metrics.loss !== "undefined") {
                    roundLabels.push(roundLabels.length + 1);
                    accuracyData.push(Number(data.metrics.accuracy));
                    lossData.push(Number(data.metrics.loss));
                    if (accuracyChart && lossChart) {
                        accuracyChart.update();
                        lossChart.update();
                    }
                }
            }
            console.log("Pesos globales recibidos y cargados");
        }
    };
};

function getMnistBatch(batchSize) {
    const idxs = [];
    while (idxs.length < batchSize) {
        idxs.push(Math.floor(Math.random() * mnistSample.images.length));
    }
    const images = tf.tensor2d(idxs.map(i => mnistSample.images[i]), [batchSize, 784]);
    const labels = tf.oneHot(tf.tensor1d(idxs.map(i => mnistSample.labels[i]), 'int32'), 10);
    return {images, labels};
}

function computeConfusionMatrix(model, images, labels) {
    const preds = model.predict(images).argMax(1).dataSync();
    const trues = labels.argMax(1).dataSync();
    const matrix = Array.from({length: 10}, () => Array(10).fill(0));
    for (let i = 0; i < preds.length; ++i) {
        matrix[trues[i]][preds[i]] += 1;
    }
    return matrix;
}

function renderConfusionMatrix(matrix) {
    let html = '<table class="table table-bordered table-sm text-center"><thead><tr><th></th>';
    for (let i = 0; i < 10; ++i) html += `<th>${i}</th>`;
    html += '</tr></thead><tbody>';
    for (let i = 0; i < 10; ++i) {
        html += `<tr><th>${i}</th>`;
        for (let j = 0; j < 10; ++j) {
            html += `<td>${matrix[i][j]}</td>`;
        }
        html += '</tr>';
    }
    html += '</tbody></table>';
    document.getElementById('confusion-matrix-container').innerHTML = html;
}

document.getElementById("trainAndSend").onclick = async () => {
    if (!modelReady || !mnistSample) return;
    document.getElementById("trainAndSend").disabled = true;
    const {images: xTrain, labels: yTrain} = getMnistBatch(32);
    await model.fit(xTrain, yTrain, {epochs: 1, batchSize: 32});
    // Matriz de confusión local
    const matrix = computeConfusionMatrix(model, xTrain, yTrain);
    renderConfusionMatrix(matrix);
    xTrain.dispose(); yTrain.dispose();
    // Serializa y transpón los pesos antes de enviar
    const weights = await Promise.all(model.getWeights().map(async (w, i) => {
        const vals = Array.from(await w.data());
        const shape = w.shape;
        if (shape.length === 2) {
            const tfTensor = tf.tensor(vals, shape);
            const transposed = tf.transpose(tfTensor);
            const arr2d = await transposed.array();
            tfTensor.dispose();
            transposed.dispose();
            return arr2d;
        } else {
            return vals;
        }
    }));
    if (websocket && websocket.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({type: "weights", weights: weights}));
        console.log("Pesos entrenados y enviados al servidor");
    } else {
        console.warn("WebSocket no está conectado.");
    }
    document.getElementById("trainAndSend").disabled = false;
};

// Dibujo en canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
let drawing = false;

canvas.addEventListener('mousedown', e => { drawing = true; });
canvas.addEventListener('mouseup', e => { drawing = false; ctx.beginPath(); });
canvas.addEventListener('mouseleave', e => { drawing = false; ctx.beginPath(); });
canvas.addEventListener('mousemove', draw);

function draw(e) {
    if (!drawing) return;
    ctx.lineWidth = 12;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#000';
    ctx.lineTo(e.offsetX, e.offsetY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(e.offsetX, e.offsetY);
}

document.getElementById('clear').onclick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    document.getElementById('prediction').textContent = '';
};

// Predice la cifra dibujada en el lienzo
document.getElementById('predict').onclick = async () => {
    // Preprocesar: escalar a 28x28, invertir color, normalizar [0,1]
    const imgData = ctx.getImageData(0, 0, 140, 140);
    // Convertir a escala de grises
    let gray = [];
    for (let i = 0; i < imgData.data.length; i += 4) {
        // Promedio de R,G,B
        const avg = (imgData.data[i] + imgData.data[i+1] + imgData.data[i+2]) / 3;
        gray.push(255 - avg); // invertir: fondo blanco, trazo negro
    }
    // Convertir a tensor, redimensionar a 28x28
    let imgTensor = tf.tensor(gray, [140, 140]);
    imgTensor = tf.image.resizeBilinear(imgTensor.expandDims(-1), [28, 28]).squeeze();
    imgTensor = imgTensor.div(255.0).reshape([1, 784]);
    // Predecir
    const pred = model.predict(imgTensor);
    const predValue = pred.argMax(1).dataSync()[0];
    document.getElementById('prediction').textContent = `Predicción: ${predValue}`;
    imgTensor.dispose();
    pred.dispose();
};

// Variables para los gráficos
let accuracyChart, lossChart;
let accuracyData = [];
let lossData = [];
let roundLabels = [];

// Inicializa los gráficos después de cargar la página
window.onload = function() {
    const accCtx = document.getElementById('accuracyChart').getContext('2d');
    const lossCtx = document.getElementById('lossChart').getContext('2d');
    accuracyChart = new Chart(accCtx, {
        type: 'line',
        data: {
            labels: roundLabels,
            datasets: [{
                label: 'Precisión',
                data: accuracyData,
                borderColor: 'green',
                fill: false,
                tension: 0.2
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } } 
        }
    });
    lossChart = new Chart(lossCtx, {
        type: 'line',
        data: {
            labels: roundLabels,
            datasets: [{
                label: 'Pérdida',
                data: lossData,
                borderColor: 'red',
                fill: false,
                tension: 0.2
            }]
        },
        options: { 
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } } 
        }
    });
};