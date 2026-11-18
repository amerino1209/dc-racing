# DC Racing Store

Vitrina pública y panel de inventario, precios y ventas de DC Racing Store.

- `index.html`: la vitrina pública para clientes (catálogo, buscador, filtros, ficha de producto y consulta por WhatsApp).
- `admin/`: el panel privado (inventario, fichas, marcas y categorías, punto de venta, ajustes). Entra con Google.
  - `admin/fb.js`: conexión con Firebase (entrada con Google, base de datos Firestore, fotos tomadas en la herramienta).
- `config.js`: configuración pública del proyecto Firebase (la usan la vitrina y el panel).
- `fotos/`: fotos sacadas del Excel original, una por categoría (las usa el panel).
- `logo.png`, `tienda-192.png`, `tienda-512.png`: logo e íconos de la vitrina.

## Cómo llega el catálogo a la vitrina

El catálogo, los costos, los precios y las ventas viven en Firestore y solo los ven las cuentas autorizadas.
Cada vez que alguien con acceso tiene abierto el panel y cambia fichas, productos, categorías o datos de la tienda,
el panel guarda una copia solo con lo publicable en `publico/catalogo` y `publico/items-N`, y las fotos reducidas en
`pubfotos/{código}`. Esa copia nunca lleva costos, cantidades, proveedores ni notas: de cada opción solo dice si está
disponible o no. La vitrina lee únicamente esa copia.

Para que los clientes puedan leerla, las reglas de Firestore deben permitir lectura pública de esas dos colecciones:

```
match /publico/{doc} { allow read: if true; }
match /pubfotos/{doc} { allow read: if true; }
```
