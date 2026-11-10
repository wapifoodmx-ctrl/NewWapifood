# Inventario del legado Wapifood

Fecha: 2026-11-04. Lectura de solo lectura de los tres repos, commit superficial de `main` / `master` al momento del clon.

- `WapifoodFront` (`main`): UX y flujos. 27 páginas, 80 casos de uso HTTP y los componentes de cada pantalla.
- `ApiWapifood` (`master`): FastAPI. Routers en `app/routers`, modelos en `app/db/models.py`, enums en `app/enums.py`.
- `microServicioWapiFood` (`master`): el snapshot de GitHub **no contiene** el router `/inventory`. El front sí llama `https://api-micro.wapifood.com/inventory/...`. Esas reglas se reconstruyen de los `useCases` del front y de lo que New ya persistió en Supabase. El resto del micro (órdenes, pagos, mesas, usuario) repite una versión anterior del API principal; la fuente vigente de esas reglas es `ApiWapifood`.

Conteos verificados en el árbol clonado:

| Pieza | Cantidad |
|---|---|
| Páginas Next del front (`pages/`) | 27 |
| Componentes con flujo propio (modales, pestañas, tableros) | 48 |
| Casos de uso que pegan a un HTTP | 80 |
| Endpoints distintos que el front llama | 62 (48 al API, 14 al micro de inventario) |
| Rutas declaradas en `ApiWapifood/app/routers` | 78 decoradores, 64 rutas únicas después de quitar duplicados y código comentado |
| Rutas de inventario que el front usa y el micro de GitHub no trae | 14 |

Una pantalla no es un flujo. Punto de venta, cocina, menú cliente y web tienen varios subflujos (modales, estados, cobro, cancelación). Abajo van todos.

## 1. Modelo y reglas que cruzan módulos

El legado es **un usuario = un restaurante**. La tabla `restaurante` está comentada en `models.py`. No hay sucursales. No hay áreas de mesa. No hay directorio de clientes: el nombre, teléfono y dirección viven en la pre-orden web y se copian como texto a la orden real.

### Estados

| Capa | Valores | Dónde |
|---|---|---|
| Orden | `Pendiente`, `Preparado`, `Finalizado`, `Cancelado`, `PuntoDeVenta` | `orders.order_status`. Mesa 1 nace `PuntoDeVenta` y la mesa se queda `Libre` |
| Línea | `Pendiente`, `Preparado`, `Cancelado`, `Finalizado` | `orders_details.order_detail_status` |
| Mesa | `Libre`, `Ocupado`, `NoDisponible` | `tables` y `table_details` |
| Web | `PENDIENTE`, `ACEPTADO`, `RECHAZADO` | `web_orders` |

Cocina no mueve la orden entera de un jalón: marca **cada producto**. Cuando todos los no cancelados están `Preparado`, la comanda se ve como completada. `Finalizado` es el cobro (lleva `metodo_pago`). `Cancelado` no puede pasar a `Finalizado`.

### Dinero

En `POST /orders` (`orders.py`, `crear_orden`):

1. Descuento de línea (`descuento_details`): `10%` o un monto. Si el número de descuentos no coincide con el de productos, 400. Porcentaje fuera de 0–100, 400. El monto no puede ser negativo. El subtotal de la línea no baja de 0.
2. Descuento de la orden (`descuento`) se aplica **después**, sobre la suma de líneas ya descontadas. Tampoco baja de 0.
3. No hay IVA, no hay redondeo a peso, no hay propina en el API. El total es `Decimal(10,2)`.
4. El PDF (`utils/pdfGenerator.js`) imprime `propina` si el objeto del ticket la trae. Ningún `useCase` ni el API la capturan. La landing dice que el ticket lleva propina; el código de cobro no.
5. Métodos: `efectivo`, `tarjeta`, `pasarela`.

No existe corte de caja, fondo, entrada, salida ni diferencia. El efectivo y el cambio no se guardan.

### Inventario

El front descuenta al cerrar (`postMermas` → `POST /inventory/process-order/`) y puede devolver (`POST /inventory/return-product/`). El micro de GitHub no incluye ese código. En la práctica del front, cancelar un producto ya preparado pregunta si regresa insumo o se queda como merma. Aceptar un domicilio en el API (`gestionar_orden_web` con `ACEPTAR`) arma la orden real y el comentario del chatbot dice que el stock se mueve al procesar; el descuento de receta no está en `orders.py`, está en el micro ausente.

### Planes

`PLAN_WAITER_LIMITS` en `waiters.py`: básico/inauguración 2 meseros, profesional 5, empresarial 10. Sin pago vigente el tope es 0. Los montos de suscripción en `enums.py` son 400 / 600 / 800 mensuales y 4000 / 6000 / 8000 con impresora. El comentario viejo de mesas dice 1 / 16 / 26. Los topes y precios vigentes de New están en `docs/PLANES.md`.

### Tiempo real

`GET/WS /ws` en el API y en el micro. El front de cocina y de mesas también vuelve a pedir por HTTP. No hay cron en los routers. El único vencimiento es la lectura de datos de envío: `GET /orders/web/delivery-info/{uuid}` deja de responder a las 12 horas.

## 2. Pantallas del front

Roles: el JWT del API es el dueño (`admin` en `RoleEnum`). El mesero no tiene usuario: entra con código (`POST /login/waiter`) y solo ve sus mesas. El comensal no inicia sesión. Cocina y caja comparten la misma cuenta del dueño; no hay rol `cocina` en el API.

### `/` Landing (`pages/index.js` + `Main`, `paquetes`, `Características`, `Funcionamiento`, `ChatBot`)

Marketing, precios y un chatbot que llama `POST https://api.wapifood.com/api/chatbot`. No escribe negocio. El chatbot del API responde con texto fijo y, si preguntan stock, intenta leer un producto.

### `/login`, `/resetLink`, `/resetpass`

- `POST /login` correo y contraseña → token.
- `POST /user/password-reset/request` y `/confirm`.
- Registro: `POST /user`. Hay OTP (`/generate-otp`, `/verify-otp`) que el front de estas páginas no usa en el flujo principal.

### `/terminosyCondiciones`

Texto legal. Sin API.

### `/user` Perfil del local (`user/userpage.jsx`)

`GET/PATCH/POST /user/me/info`. Campos: nombre del restaurante, teléfono, WhatsApp, dirección, código postal, ciudad, alcaldía, horario, logo, código de confirmación de 4 dígitos. `GET /user/me/confirmation-code` lo usa el menú de mesa. Efecto: el menú público, el domicilio y la cocina leen ese perfil.

### `/menu` Carta (`menuComponents`, `RecipeModalForProduct`)

- `GET /categoria` y `GET /categoria/productos`.
- `POST /categoria`.
- `POST /products` alta con foto (multipart). `PATCH /products/{id}`, `DELETE /products/{id}`.
- Varias fotos: el modelo `images` cuelga del producto.
- Costo de producción (`production_cost`) y precio.
- Checkbox de inventario unitario: el chatbot documenta que crea una receta oculta de 1 pieza. La llamada real es al micro.
- `POST /products/productos`, `/insumos`, `/productos/carga-completa-recetas`, `/productos/asignar-receta` (import CSV, `importrouter.py`).

No hay grupos de modificadores con mínimo y máximo. El “extra” es un insumo con precio, en el micro.

### `/recetas` (`Recetas/recipes.jsx`, `AddRecipeModal`, `EditRecipeModal`, `ExtrasModals`)

- `GET/POST /inventory/recipes/`, `GET/PUT /inventory/recipes/{id}`, `GET /inventory/recipes/my-recipes`.
- `GET/POST /inventory/extras/`, `PATCH /inventory/extras/bulk/update`.
- Una receta es lista de insumo + cantidad. El extra es insumo + cantidad + precio, ligado al producto.
- Efecto: el cobro suma el precio del extra; el cierre descuenta la cantidad del insumo.

### `/inventarios` (`Inventarios/inventario.jsx`, pestañas)

Pestañas de insumos, kardex, PIN y adicionales.

- `GET/POST /inventory/ingredients/`, `GET/PUT /inventory/ingredients/{id}`.
- `GET /inventory/movements/?ingredient_id=`.
- `GET/PATCH /inventory/security/pin`.
- Entrada suma stock. Salida / merma resta.
- Efecto cruzado: cocina y cancelación llaman process-order y return-product.

### `/puntodeventa` (`pntoventa.jsx`, `CarritoModal`, `ModalsPago`, `ProductoCard`)

Subflujos:

1. Elegir mesa. `GET /tables/status`. Mesa 1 es la caja y no se ocupa.
2. Armar carrito. Mismo producto puede ir en **otra línea** (`orders_details` no tiene unicidad por producto). Nota por línea.
3. Descuento de línea y descuento de orden, con la validación del API.
4. Enviar: `POST /orders` (form: productos, cantidades, descuentos, `metodo_pago`, `order_uuid` opcional). Si la orden de esa mesa sigue activa, **suma** líneas. Si está finalizada o cancelada, abre otra.
5. Cocina ve las líneas en `Pendiente`.
6. Cobro: `PUT /orders/orders/{uuid}/cambio_estatus?order_status=Finalizado&metodo_pago=`. Libera la mesa si no es la 1. Dispara inventario.
7. Cancelar orden: el mismo endpoint con `Cancelado`. `cancelOrder.js` manda `metodo_pago=efectivo` aunque no haya cobro.
8. Cancelar una línea: `PUT .../cambio_details_status`.
9. Comentarios: `POST/GET /orders/{uuid}/comments`.
10. Ticket: `GET /orders/{uuid}` y `GET /orders/final/{uuid}`.
11. Listas de productos para la caja: `GET/POST/PUT/DELETE /products/custom-list`.

No hay propina, cambio guardado, división de cuenta ni turno.

### `/cocina` (`VistaCocina.jsx` ~1900 líneas, `modalCocina.jsx`)

Vistas: pendientes, completadas (todas las líneas activas en Preparado), finalizadas, canceladas, web.

Acciones del modal:

- Marcar producto preparado.
- Regresar producto a pendiente.
- Cancelar producto (y elegir merma o devolución si ya se procesó inventario).
- Cancelar la orden.
- Finalizar desde cocina en la mesa caja: cierra, libera y genera ticket.
- Aceptar o descartar domicilio (`createwebExternalOrder.js` → `POST /orders/web/process/{uuid}?accion=`).
- Ver dirección, teléfono y nombre. `GET /orders/web/delivery-info/{uuid}` (caduca a las 12 h).
- `GET /orders/web/list`, `GET/PUT /orders/web/status/delivery` para el interruptor de domicilio.

La mesa `NoDisponible` no recibe pedidos. Hay acción de liberar mesa.

### `/tickets` y ticket externo

`GET /orders/orders/allorders`, filtros por 24 h, 7 días, 30 días y entre fechas. Modal con PDF (`pdfGenerator.js`). El ticket externo (`pages/tickets/externalTicketView.js`) es el beeper: el comensal abre el estado sin login.

### `/dashboard`

- `GET /analytics/dashboard` acumulado.
- `GET /analytics/get-analytics-basic`.
- `GET /analytics/ventas_por_semana`, `ventas_por_mes_reciente`, `ventas_por_año` (el gráfico de rango reutiliza el de año con query).
- `GET /analytics/get-utilidades`.
- `GET /products/top`.
- `GET /orders/orders/latest-by-plan` (el plan recorta cuántas órdenes recientes se ven).
- Pedidos del día en componentes `pedidos` / `idpedidos`.

No exporta CSV. La utilidad es precio menos costo de producción, no la receta.

### `/meseros`

- `POST/GET/PATCH/DELETE /waiters`.
- Tope por plan: `GET /waiters/limits`. Si se pasa, 403.
- Asignar mesas: `POST/DELETE /assignments/table/{n}/waiter/{uuid}`, `GET /assignments/`.
- Historial: `GET /waiters/orders-history`.
- Ligar mesero a la orden: `POST /waiters/assign/order` (`vincularMeseroOrden.js`).

### `/meseroMenu`

`POST /login/waiter` con código. Solo mesas asignadas y libres u ocupadas, nunca `NoDisponible`. Carrito propio (`CartModalMesero`) que pega a `POST /orders`. Ve el estado de cada línea. No cobra.

### `/clientmenu` y `/webmenu/[uuid]`

Menú público.

- Carta: `GET /categoria/web-menu/{uuid}` y `GET /user/info/{uuid}`.
- Mesa + código de confirmación (`GET /user/me/confirmation-code` del lado del local; el comensal lo teclea).
- Carrito, nota, extras.
- `POST /orders` para mesa. Domicilio: `POST /orders/web/create?restaurant_uuid=` con nombre, teléfono, dirección y notas. Si el interruptor de delivery está apagado, no deja.
- Horario: el webmenu compara día y hora del navegador con el horario del perfil.
- Colores: `GET/POST/PATCH/DELETE /menucolors/`.
- Pago del comensal: `PaymentModal` existe en el cliente; el cobro de suscripción del restaurante es otro flujo (`/payments`). El modal de menú no crea un Checkout de Mercado Pago de la cuenta de la mesa en el API de órdenes.

### `/kiosko`

`GET /categoria/productos` y `POST /orders/kiosko`. Orden sin mesero, canal propio. También existe `puntoVentaPostOrder.js`, que por error de nombre pega al mismo `/orders/kiosko`.

### `/pantallas` y `/pantallasExternal`

Elige una lista custom (`GET /products/custom-list`) y la muestra en una pantalla (cocina o cliente). No es un KDS: es un carrusel de productos. La externa no pide login si ya tiene el id de la lista.

### `/payments` y `/success`

Suscripción del restaurante, no la cuenta de una mesa.

- `POST /payments/create-checkout-session`.
- `GET /payments/check-payment`, `/payments/me`, `/payments/public-key`, `/payments/verify-payment/{id}`.
- Webhook `POST /payments/webhook` (Mercado Pago; quedan campos históricos de Stripe en migraciones viejas).
- `POST /free/activate-plan` activa un plan de prueba por días **sin cobro**. New lo quitó a propósito.

### `/masaProduction`

Pantalla “en desarrollo”. No descuenta harina ni tiene endpoint.

### 404, error, sitemap

Sin negocio.

## 3. Endpoints de ApiWapifood

Prefijos reales. El efecto dice qué más se mueve.

### Auth y usuario

| Método y ruta | Qué hace | Efecto |
|---|---|---|
| `POST /login`, `/login/oauth2`, `/login/json`, `/login/test-token` | Token del dueño. Hay handlers duplicados en el archivo | Sesión |
| `POST /login/waiter` | Código de mesero | No crea usuario |
| `POST /user` | Alta del dueño | Usuario |
| `GET/PUT/DELETE /user/{id}` | Admin de usuarios | |
| `GET/PATCH/POST /user/me/info` | Perfil y logo | Menú, domicilio, cocina |
| `GET /user/info/{uuid}` | Perfil público por uuid | Menú web |
| `GET /user/me/confirmation-code` | Código de 4 dígitos | Menú en mesa |
| `POST /user/password-reset/request` y `/confirm` | Correo y nueva contraseña | |
| `GET /generate-otp`, `POST /register`, `POST /verify-otp` | OTP. El front principal no lo usa | |
| `POST /` y `GET/PATCH/DELETE /{id}` en `restaurante.py` | Alta de restaurante legado, casi sin uso porque el modelo está comentado | |

### Carta

| Método y ruta | Qué hace |
|---|---|
| `POST /categoria`, `GET /categoria`, `GET /categoria/productos` | Categorías del dueño y productos anidados |
| `GET /categoria/web-menu/{uuid}` | Carta pública |
| `GET/POST /products`, `GET/PATCH/DELETE /products/{id}` | CRUD. Foto en multipart. Precio y costo |
| `GET /products/top` | Más vendidos (declarado dos veces) |
| `GET/POST/PUT/DELETE /products/custom-list` | Listas para pantallas y caja |
| `POST /products/insumos`, `/productos`, `/productos/carga-completa-recetas`, `/productos/asignar-receta` | CSV. El de insumos reenvía al micro |

### Mesas, meseros

| Método y ruta | Qué hace | Efecto |
|---|---|---|
| `POST /tables/tables`, `GET /tables/tables`, `PUT /tables/tables/{id}` | CRUD | |
| `POST /tables/details` | Detalle de ventas por mesa | |
| `POST /tables/generate` | Genera el número de mesas del plan | |
| `GET/POST /tables/status` | Libre, Ocupado, NoDisponible | POS, mesero, cocina |
| `POST /tables/LiberarTodasLasMesas` | Pone libres las que no tienen orden activa. No toca NoDisponible a la fuerza si el handler lo respeta; el nombre libera en bloque | Mesas |
| `POST/DELETE /assignments/table/{n}/waiter/{uuid}`, `GET /assignments/` | Qué mesero atiende qué mesa | Mesero |
| `POST/GET/PATCH/DELETE /waiters` | CRUD con tope de plan y código único | |
| `POST /waiters/assign/order` | Historial mesero-orden | Tickets |
| `GET /waiters/orders-history`, `GET /waiters/limits` | Rendimiento y tope | Dashboard y alta |

### Órdenes

| Método y ruta | Qué hace | Efecto |
|---|---|---|
| `POST /orders` | Crea o amplía. Mesa 1 = punto de venta y la mesa sigue Libre. Exige suscripción activa. Valida descuentos. Varias líneas del mismo producto | Mesa ocupada si no es la 1. Cocina en Pendiente |
| `POST /orders/kiosko` | Igual, canal kiosko | |
| `GET /orders/orders` | Órdenes con detalle | |
| `GET /orders/{uuid}`, `GET /orders/final/{uuid}` | Ticket | Beeper e impresión |
| `GET /orders/summary` | Resumen | |
| `PUT /orders/orders/{uuid}/cambio_estatus` | Finalizado o Cancelado + método. Prohíbe revivir una cancelada. Libera la mesa | Inventario lo dispara el front, no este handler |
| `PUT /orders/orders/{uuid}/cambio_details_status` | Estado de cada línea | Cocina, total |
| `GET /orders/orders/last-order-by-table` | La cuenta abierta de la mesa | POS y mesero |
| `GET .../allorders`, `ordenes-ultimas-24-hrs`, `ultima-semana`, `ultimo-mes`, `entre-fechas` | Historial | Tickets y gráficas |
| `GET /orders/orders/latest-by-plan` | Recorta por plan | Dashboard |
| `GET /orders/kiosko` | Órdenes de kiosko | |
| `POST/GET /orders/{uuid}/comments` | Notas de la comanda | Cocina y ticket |
| `POST /orders/web/create` | Pre-orden de domicilio | Cola de cocina |
| `GET /orders/web/list` | Pendientes web | Cocina |
| `POST /orders/web/accept/{uuid}` | Convierte a orden real | Mesa 1, ticket |
| `POST /orders/web/process/{uuid}?accion=ACEPTAR\|DESCARTAR` | Acepta (orden real + texto de cliente) o marca `RECHAZADO` | Cocina o se oculta |
| `GET /orders/web/delivery-info/{uuid}` | Datos de envío, 12 h | Cocina |
| `GET/PUT /orders/web/status/delivery` | Interruptor de domicilio | Menú web |

`GET /ordersorders/by-status` está mal escrito en el decorador (sin barra). El front no lo usa.

### Analítica, colores, pagos, otros

| Método y ruta | Qué hace |
|---|---|
| `GET /analytics/dashboard`, `get-analytics`, `get-analytics-basic`, `get-analytics-details` | KPIs |
| `POST /analytics/generate-analytics` | Recalcula la tabla `order_analytics` |
| `GET /analytics/ventas_por_año`, `ventas_por_mes_reciente`, `ventas_por_semana` | Series. Semana y mes están declarados dos veces |
| `GET /analytics/get-utilidades` | Precio − costo de producción |
| `GET/POST/PATCH/DELETE /menucolors/` | Tema del menú público |
| `POST /payments/create-checkout-session` | Preferencia Mercado Pago del plan |
| `POST /payments/webhook` | Activa la suscripción si el pago está aprobado |
| `GET /payments/success`, `/cancel`, `/check-payment`, `/me`, `/public-key`, `/verify-payment/{id}` | Retorno y consulta |
| `POST /free/activate-plan` | Plan de prueba sin pago |
| `POST /` del chatbot | Texto de ayuda. Puede leer stock de un id |
| `WS /ws` | Aviso de órdenes y mesas |
| `prueba_resend.py` | Prueba de correo, no es flujo de producto |

No hay crons, colas ni jobs en el repo. La impresión es del navegador (HTML y jsPDF), no hay servicio de impresora. El webhook de Mercado Pago es la única integración de dinero. Stripe quedó en columnas viejas; el checkout vigente es Mercado Pago.

## 4. Microservicio

Routers presentes y repetidos respecto al API: analytics, auth, categoria, free, orders (incluye `cambio_detalles_subordenes`, que el API principal ya no expone igual), payments, products, restaurante, OTP, tables, user, websocket.

**No está** en este snapshot, y el front sí lo llama:

| Llamada del front | Uso |
|---|---|
| `GET/POST /inventory/ingredients/` | Lista y alta |
| `GET/PUT /inventory/ingredients/{id}` | Ficha y edición (stock, mínimo, unidad, caducidad) |
| `GET /inventory/movements/?ingredient_id=` | Kardex |
| `GET/PATCH /inventory/security/pin` | PIN de 4 a 8 dígitos |
| `GET/POST /inventory/recipes/`, `GET/PUT /inventory/recipes/{id}`, `GET /inventory/recipes/my-recipes` | Recetas |
| `GET/POST /inventory/extras/`, `PATCH /inventory/extras/bulk/update` | Adicionales con precio |
| `POST /inventory/process-order/` | Descuenta la receta al cerrar |
| `POST /inventory/return-product/` | Devuelve o no, según el payload del front |

`importrouter.py` del API reenvía el CSV de insumos a ese host.

## 5. Mapa pantalla → endpoint → entidad

| Pantalla | Endpoints | Entidades |
|---|---|---|
| Landing / chatbot | `POST /api/chatbot` | products (lectura de stock) |
| Login y reset | `/login`, `/user/password-reset/*`, `/user` | users |
| Perfil | `/user/me/info`, confirmation-code | user_info, image_user |
| Carta | `/categoria`, `/products` | products, images, categoria |
| Importar | `/products/insumos`, `/productos`, recetas | products, ingredients, recipes |
| Recetas y extras | micro `/inventory/recipes`, `/inventory/extras` | recipes, extras, ingredients |
| Inventario | micro ingredients, movements, pin, process-order, return-product | ingredients, movements |
| Mesas | `/tables/*`, LiberarTodasLasMesas | tables, table_details |
| POS | `/orders`, cambio_estatus, cambio_details_status, comments, `/tables/status` | orders, orders_details, tables |
| Cocina | órdenes, web/list, web/process, delivery-info, delivery on/off, estado de línea | orders, web_orders |
| Tickets | allorders, rangos, `GET /orders/{uuid}` | orders |
| Dashboard | analytics, products/top, latest-by-plan | order_analytics, orders, products |
| Meseros | `/waiters`, `/assignments`, limits, orders-history | waiters, table_waiters, order_waiter_history |
| Menú mesero | `/login/waiter`, `/orders`, `/tables/status` | waiters, orders |
| Menú mesa y web | web-menu, user/info, `/orders`, web/create | products, web_orders |
| Kiosko | `/orders/kiosko` | orders |
| Pantallas | custom-list | product_selection |
| Plan | payments/*, free/activate-plan | payments |
| Masa | ninguno | — |

## 6. Lo que el legado no hace (para no inventarlo)

- Sucursales.
- Áreas de mesa.
- Directorio de clientes.
- Turno, fondo, corte y diferencia de cajón.
- Propina persistida (solo un campo opcional del PDF).
- IVA desglosado. El precio de la carta es el precio cobrado.
- Grupos de modificadores con mínimo, máximo u obligatorio. Solo extras con precio.
- Rol de cocina distinto del dueño.
- Impresora de comandas. Imprime el navegador.
- Producción de masa.
- División de una cuenta en dos notas. New sí la tiene; el legado no.
