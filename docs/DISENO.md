# Diseño Comal

Fecha: 3 de noviembre de 2026. Sustituye la plantilla editorial Amrit Palace (pergamino, esquinas rectas, mayúsculas y serif delgada). Hugo pidió un sistema nuevo, cálido y obvio para quien nunca ha usado un punto de venta.

## Para quién

Caja, mesero, cocina y dueño. Niños que ayudan en el local, adultos y personas mayores. Por eso el texto base es de 17 px (18 px en la caja), cada ícono va con palabras, y el color nunca es la única señal.

## Paleta

Tema claro, fondo `#FFF8F3`, tarjetas blancas, texto `#1C1410`. El acento es chile `#B93815` (texto blanco, contraste 5.77:1). El texto secundario `#5C463A` sobre el fondo da 8.35:1.

| Uso | Claro | Oscuro |
|---|---|---|
| Fondo | `#FFF8F3` | `#14100E` |
| Tarjeta | `#FFFFFF` | `#241C17` |
| Texto | `#1C1410` | `#FFF6EE` |
| Texto secundario | `#5C463A` | `#E7D5C6` |
| Acción principal | `#B93815` / blanco | `#FF8A4C` / `#1A1410` |
| Éxito | `#166534` | texto `#9BE7B8`, botón `#166534` |
| Alerta | `#B91C1C` | texto `#F8C1BB` |
| Aviso | `#92400E` | `#F6C48A` |

Los estados de mesa y de espera usan color y palabra: libre (verde + palomita), ocupada (ámbar + personas), no disponible (gris + prohibido). En cocina, el tiempo dice «8 min», «tardando» o «muy tarde».

Las categorías de la caja pintan la foto del platillo con una de ocho tintas. El nombre de la categoría va escrito encima del precio.

## Tipo, espacio, forma

- Texto: Plus Jakarta Sans. El nombre Wapifood usa Fraunces, solo en la marca.
- Títulos en 800, no en serif delgada.
- Radio: 14 px en controles, 22 px en tarjetas, 28 px en hojas.
- Sombra suave para separar la tarjeta del fondo. En oscuro, la sombra es más densa.
- Toque mínimo 48 px. Cobrar, enviar a cocina y «todo listo» miden 56 px.
- El tema oscuro sigue al sistema la primera vez y se puede cambiar con el sol/luna. Se guarda en el navegador.

## Piezas

Botón, tarjeta, campo, hoja inferior (en teléfono) o diálogo (en pantalla grande), pestañas de categoría, aviso (toast) con acción Deshacer, vacío con un solo siguiente paso, esqueleto de carga, etiqueta de estado y la barra de progreso de primeros pasos.

## Cómo se entra

- Dueño y administración: Inicio, con mosaicos grandes (caja, cocina, mesas, cuentas, platillos).
- Caja y piso: caen en la caja.
- Cocina: cae en el pase.
- El mesero no usa esa cuenta: entra con su código en `/mesero`.

El menú lateral (y «Más» en el teléfono) sigue teniendo todas las rutas. No se ocultó ninguna.

## Caja

Cuadrícula de platillos con foto o inicial, color de categoría y precio. Un toque suma. Si hay adicionales, se abren en una hoja. La cuenta queda a la vista en tablet y escritorio; en el teléfono, una barra dice el total y «Cobrar».

Cobrar son tres toques: Cobrar, forma de pago, confirmar. Efectivo calcula el cambio y ofrece montos cerrados. Tarjeta es la terminal. «Mercado Pago» envía `transferencia` a `close_order`, porque el enum del cobro solo acepta efectivo, tarjeta y transferencia. El plan del restaurante sí se paga con Mercado Pago Checkout.

Siguen el descuento, la nota, separar la cuenta, el ticket y cancelar con confirmación. Quitar el último de un platillo se puede deshacer unos segundos.

## Cocina, mesas, menú

La cocina muestra la mesa en grande, el reloj y un botón para avanzar. El sonido es opcional y solo suena después de activarlo. Las mesas del salón y del mesero repiten el estado con ícono y texto. El menú público y el kiosko se parecen a una app de pedido: foto, agregar y una barra con el total.

## Primeros pasos

Datos del local, primeros platillos, mesas y precios, venta de prueba. Hay barra de avance y «Saltar este paso». No hay un campo de IVA en la base: el precio capturado es el que se cobra. La venta de prueba se marca hecha cuando existe una orden pagada.

## Accesibilidad

Contraste AA en texto y botones. Foco visible. Enlace «Saltar al contenido». `lang="es-MX"`. Aviso fijo si se pierde internet. `prefers-reduced-motion` apaga animaciones. Los errores de acceso dicen qué revisar (contraseña, correo sin confirmar, spam, internet).

Los alias `--color-*` antiguos apuntan a estos tokens para que carta, insumos, recetas y el resto hereden la paleta sin reescribir cada formulario.
