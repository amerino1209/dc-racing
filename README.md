# DC Racing · Inventario

Herramienta web de inventario, precios y ventas de DC Racing Store, con escáner de códigos de barras.

- `index.html`: la aplicación.
- `fb.js`: conexión con Firebase (entrada con Google, base de datos Firestore, fotos tomadas en la herramienta).
- `config.js`: configuración pública del proyecto Firebase.
- `fotos/`: fotos sacadas del Excel original, una por categoría.

El catálogo, los costos, los precios y las ventas viven en Firestore y solo los ven las cuentas autorizadas.
