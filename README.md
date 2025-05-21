# Federated MNIST Client (Frontend)

Interfaz web para participar como cliente en un sistema de aprendizaje federado sobre el dataset MNIST.

## Descripción

Esta aplicación permite a cualquier usuario conectarse a un servidor de aprendizaje federado, entrenar localmente un modelo de reconocimiento de dígitos manuscritos y enviar los pesos al servidor. El usuario puede visualizar métricas, la matriz de confusión y probar el modelo en tiempo real dibujando en un canvas.

## Características

- Entrenamiento local sobre muestras de MNIST.
- Envío y recepción de pesos del modelo vía WebSocket.
- Visualización de métricas (precisión, pérdida) y matriz de confusión.
- Prueba interactiva del modelo con dibujo en canvas.
- Gráficas responsivas de precisión y pérdida usando Chart.js.

## Estructura de archivos

```
static/
├── index.html         # Interfaz principal
├── main.js            # Lógica JavaScript del cliente
├── mnist_sample.json  # Subconjunto de datos MNIST (debe estar en el mismo directorio)
```

## Requisitos

- Un servidor que provea el archivo `mnist_sample.json` y soporte WebSocket.
- Navegador moderno (Chrome, Firefox, Edge, etc.).
- Conexión a internet para cargar las librerías desde CDN.

## Uso

1. Coloca todos los archivos en el mismo directorio (incluyendo `mnist_sample.json`).
2. Abre `index.html` en tu navegador.
3. Espera a que cargue MNIST y haz clic en "Conectar al Servidor".
4. Usa "Entrenar y Enviar Pesos" para participar en el aprendizaje federado.
5. Dibuja un dígito en el canvas y haz clic en "Predecir" para probar el modelo.

## Créditos

- [TensorFlow.js](https://www.tensorflow.org/js)
- [Chart.js](https://www.chartjs.org/)
- [Bootstrap](https://getbootstrap.com/)

---

**Creado con fines educativos y experimentales.**