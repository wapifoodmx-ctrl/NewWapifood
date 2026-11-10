# Paridad Wapifood legado → NewWapifood

Fecha: 2026-11-04. El detalle de cada pantalla y endpoint está en `docs/LEGADO-INVENTARIO.md`. Esta matriz solo marca el estado en New, con la ruta de los dos lados. Nada queda en «completo» sin un camino de código de punta a punta.

Leyenda: **completo**, **parcial** (se dice qué falta), **ausente**, **distinto** (a propósito o porque el legado tampoco lo tenía y aquí se tomó una regla explícita).

## Conteos

Inventario legado: 27 páginas, 48 componentes con flujo, 80 casos de uso HTTP, 64 rutas únicas en `ApiWapifood`, 14 llamadas de inventario que el snapshot de `microServicioWapiFood` no trae.

Flujos de esta matriz: **58**. Cada fila está en un solo grupo.

| | Antes (main, verificado en código) | Después de este cambio |
|---|---|---|
| Completo | 26 | 38 |
| Parcial | 13 | 8 |
| Ausente | 11 | 2 |
| Distinto | 8 | 10 |

12 flujos pasaron a completo (horario del menú, liberar mesas, tope en la base, descuento de línea, cambio guardado, merma o devolución, rechazar domicilio, dirección en cocina, total del ticket, equipo, clientes, roles). Tres capacidades que el legado no tenía quedaron operando con regla explícita: áreas, propina y turno. La utilidad exportable pasó de ausente a parcial. Siguen ausentes los comentarios de redes y los modificadores con mínimo y máximo.

## Matriz

| # | Flujo legado | Legado | New | Antes | Ahora |
|---|---|---|---|---|---|
| 1 | Landing y precios | `pages/index.js` | `src/app/page.js` | completo | completo |
| 2 | Login, recuperar, confirmar | `login`, `resetLink`, `resetpass` | `/login`, `/recuperar`, `/auth` | completo | completo |
| 3 | Alta sin seed | `POST /user` | `create_my_restaurant` | completo | completo |
| 4 | Perfil, logo, horario, código | `user/userpage.jsx`, `/user/me/info` | `ConfigPanel.jsx` | completo | completo |
| 5 | Horario bloquea el menú web | `webmenu/[uuid].js` `checkRestaurantHours` | `src/lib/hours.js`, `DigitalMenu.jsx` | ausente | completo. Kiosko y tablet no se bloquean |
| 6 | Carta, categorías, foto, costo | `menu/` | `CartaManager.jsx` | completo | completo |
| 7 | Varias fotos | `images` | `product_images` | completo | completo |
| 8 | Receta multi-insumo y unitario | `Recetas/`, micro recipes | `RecetasManager.jsx`, `ensure_unit_product_inventory` | completo | completo |
| 9 | Extra con precio | `ExtrasModals`, micro `/inventory/extras` (no está en el snapshot) | `product_extras` | completo | completo |
| 10 | Insumos, PIN, kardex, merma, entrada | `Inventarios/` | `InsumosManager.jsx` | completo | completo |
| 11 | Import CSV | `importrouter.py` | `/importar` | completo | completo |
| 12 | Listas custom y pantallas | `custom-list`, `pantallas` | `/listas`, `/pantallas` | parcial. La pantalla es un enlace, no el carrusel del legado | parcial. Igual |
| 13 | Mesas Libre / Ocupado / NoDisponible | `tablesStatus.js` | `dining_tables.state`, `MesasManager` | completo | completo |
| 14 | Liberar mesas sin cuenta | `POST /tables/LiberarTodasLasMesas` | botón en `MesasManager.releaseIdle` | ausente | completo |
| 15 | Áreas de mesa | no existían | `dining_areas`, selector en Mesas | ausente | distinto. Se agregaron porque el encargo las pidió. No cambian el cobro |
| 16 | Tope de mesas y meseros en la base | `waiters.py` `PLAN_WAITER_LIMITS`, `POST /tables/generate` | trigger `enforce_plan_caps` | parcial. El tope de meseros solo estaba en la pantalla | completo. Topes nuevos en `docs/PLANES.md`: 5/15/25 mesas y 3/7/15 meseros. El legado sigue en 2/5/10 meseros |
| 17 | POS: abrir, sumar, nota, cocina | `Puntodeventa/` | `PosBoard.jsx`, `send_order_to_kitchen` | completo | completo |
| 18 | Mismo producto en dos líneas | `orders_details` sin unicidad | PK `(order_id, product_id)` | parcial | parcial. Sigue una sola línea por producto |
| 19 | Descuento de línea y luego de la orden | `crear_orden` en `orders.py` | `set_item_discount`, `set_order_discount`, `order_subtotal` | parcial. La orden sí; la línea solo tenía columna | completo en caja y en SQL |
| 20 | Cobro efectivo, tarjeta, transferencia | `cambio_estatus` + `metodo_pago` | `close_order` | completo | completo |
| 21 | Efectivo recibido y cambio guardados | no se guardaban; la caja solo lo mostraba | `orders.cash_tendered`, `change_amount` | parcial | completo |
| 22 | Propina | el PDF la imprime si viene; el API no la tiene | `tip_amount` en `close_order` | ausente | distinto. Se captura aparte, default 0, no cambia el precio. Ver decisiones |
| 23 | Separar cuenta | no estaba | `PosBoard.moveMarkedLines` | distinto (extra de New) | distinto. El descuento de toda la orden no se reparte |
| 24 | Cancelar orden y liberar mesa | `cambio_estatus=Cancelado` | `cancel_order` | completo | completo |
| 25 | Cocina por ítem: listo, regresar, cancelar | `modalCocina.jsx` | `KitchenBoard`, `set_order_item_status` | completo | completo |
| 26 | Devolver insumo o merma al anular un platillo ya cobrado | `return-product` del micro | `return_sold_stock` en Cuentas | ausente | completo. No devuelve dinero |
| 27 | Stock al cobrar, no al marcar listo | el front llama process-order al cerrar; el web accept del API arma la orden antes | `close_order` si `stock_applied` es falso | completo en POS | completo. El domicilio también descuenta al cobrar, no al aceptar |
| 28 | Confirmar domicilio | `web/process?accion=ACEPTAR` | `confirm_web_order` | completo | completo |
| 29 | Rechazar domicilio | `accion=DESCARTAR` → `RECHAZADO` | botón Rechazar → `cancel_order` | ausente | completo |
| 30 | Dirección y teléfono en cocina | `VistaCocina.jsx` | tarjeta de `KitchenBoard` | parcial. El dato se pedía y no se veía | completo |
| 31 | Interruptor de domicilio | `PUT /orders/web/status/delivery` | `ConfigPanel` `delivery_enabled` | completo | completo |
| 32 | Menú QR, código, kiosko, tablet | `clientmenu`, `webmenu`, `kiosko`, mesero | `/m`, `/kiosko`, `/tablet`, `/mesero` | completo | completo |
| 33 | Beeper `/t/{id}` | ticket externo | `get_public_ticket` | completo | completo |
| 34 | Mesero por código y mesas | `/login/waiter`, assignments | `waiter_login`, `WaiterApp` | completo | completo |
| 35 | Historial de venta del mesero | `orders-history` | conteo en `/meseros` | parcial. Suma precio × cantidad, sin descuento ni propina | parcial. El reporte nuevo sí resta descuentos; la ficha del mesero no |
| 36 | Comentarios de orden | `/orders/{uuid}/comments` | `order_comments` | completo | completo |
| 37 | Dashboard día, semana, mes, año | `analytics/*` | `DashboardInsights.jsx` | parcial. Sin utilidad ni CSV | parcial. Sigue el tablero. El CSV y el margen están en Reportes |
| 38 | Utilidad y export | `get-utilidades` | `sales_report`, `/reportes` | ausente | parcial. El margen usa `products.cost`, no la receta, y no resta descuentos |
| 39 | Tickets, impresión, PDF | `Ticketview`, `pdfGenerator.js` | `TicketCard`, `ticketPdf.js` | parcial. El total ignoraba descuento | completo en el total (descuento de orden y de línea). El PDF sigue siendo texto, no el formato del legado |
| 40 | Plan Mercado Pago | `payments.py` | `/pagos`, webhook | completo | completo. Sin Stripe |
| 41 | Activar plan sin pago | `POST /free/activate-plan` | no existe | distinto | distinto |
| 42 | Equipo: ver, invitar, rol, quitar | no había equipo; un usuario | `EquipoPanel`, `list_team`, `invite_team_member` | parcial. Lista de UUID | completo para el panel. No se envía correo |
| 43 | Clientes por teléfono | solo texto en la orden web | `customers` + trigger | ausente | completo |
| 44 | Turno, fondo, entradas, salidas, corte | no existía | `/turno`, `cash_sessions` | ausente | distinto. Se agregó con las reglas de dinero de abajo. Cobrar no exige turno abierto |
| 45 | Roles owner, admin, piso, cocina | un rol de dueño | `memberships.role`, `has_role` | parcial | completo en invitaciones y en cerrar el turno |
| 46 | Chatbot remoto | `POST /api/chatbot` | `helpAnswers.js` | distinto | distinto |
| 47 | Masa | página «en desarrollo» | `/masa` | distinto | distinto |
| 48 | Comentarios de redes | `componenteComentario.jsx` | — | ausente | ausente |
| 49 | Grupos de modificadores (mínimo, máximo, obligatorio) | no existían; solo extras | extras | ausente | ausente |
| 50 | Sucursales | modelo comentado | grupo, selector, copiar menú, reporte por local | distinto | parcial. Una suscripción cubre los locales del grupo. No se envía correo de invitación |
| 51 | IVA desglosado | no se calcula | no se calcula | distinto | distinto |
| 52 | WebSocket `/ws` | `websockets.py` | realtime de `orders`, `order_items`, `dining_tables` | distinto | distinto |
| 53 | OTP de registro | `solicitarOTP.py` | Supabase Auth | distinto | distinto |
| 54 | Datos de envío caducan a las 12 h | `delivery-info` | la orden guarda la dirección sin caducidad | parcial | parcial |
| 55 | Recorte de órdenes del dashboard según plan | `latest-by-plan` | el dashboard no recorta | parcial | parcial |
| 56 | Colores del menú | `/menucolors` | `menu_theme`, `ThemePanel` | completo | completo |
| 57 | Código de confirmación en mesa | `confirmation-code` | `place_public_order` | completo | completo |
| 58 | Impresora de comandas en cocina | no hay servicio; imprime el navegador en tickets | igual en Cuentas | completo | completo |

Grupos de después, sin repetir filas: completo 1–11, 13, 14, 16, 17, 19–21, 24–34, 36, 39, 40, 42, 43, 45, 56–58 (38). Parcial 12, 18, 35, 37, 38, 54, 55 (7). Ausente 48, 49 (2). Distinto 15, 22, 23, 41, 44, 46, 47, 50–53 (11).

## Reglas de dinero que quedaron escritas

Migración `supabase/migrations/20261104010000_paridad_caja_equipo_clientes.sql`.

- El precio capturado es lo que se cobra. No hay IVA.
- Descuento de línea primero. Descuento de la orden después, sobre ese subtotal. Igual que `crear_orden`.
- Propina default 0. A cobrar = alimentos ya descontados + propina. No hay porcentaje automático.
- Cambio = efectivo recibido − a cobrar, a centavos (`round` de Postgres, half away from zero).
- El cajón suma fondo + alimentos en efectivo + propina en efectivo + entradas − salidas. Tarjeta y transferencia no entran.
- Se puede cobrar sin turno. Si no hay turno abierto, la venta se guarda y no hay movimiento de cajón.
- Anular un platillo ya cobrado mueve inventario (devolución o merma) y no toca el dinero.

## Decisiones que Hugo tiene que tomar

1. **Mesas por plan.** El comentario viejo del enum dice 1 / 16 / 26. Hugo fijó los topes nuevos en `docs/PLANES.md` (5 / 15 / 25 mesas y 3 / 7 / 15 meseros). `plans.js` y `restaurant_caps` usan esos números. Quien ya pagaba no pierde mesas ni meseros: los topes nuevos son iguales o más altos.
2. **Propina.** El legado no la guardaba. Aquí es opcional y no entra al precio. Si debe ser un porcentaje sugerido, o si la propina con tarjeta también entra al cajón, hay que decirlo. Hoy la de tarjeta solo se registra.
3. **Turno obligatorio.** Hoy se puede cobrar con el turno cerrado, porque el legado no tenía corte. Si el cajón debe rechazar el efectivo sin turno, es un cambio de una línea en `close_order`.
4. **Una línea por producto.** Dos «tacos al pastor» con notas distintas se suman en la misma línea. Separarlos implica cambiar la llave de `order_items` y de `order_item_extras`. No se hizo para no romper las órdenes vivas.
5. **Cuándo descuenta inventario el domicilio.** Al cobrar, no al aceptar. El API legado armaba la orden al aceptar y el micro (ausente en GitHub) descontaba en otro momento. Descontar al aceptar y otra vez al cobrar duplicaría la salida.
6. **Margen.** Es precio de venta menos `products.cost`. No resta descuentos ni usa los gramos de la receta. Si el margen debe salir de la receta, hace falta definir de dónde sale el costo del insumo: la tabla `ingredients` no tiene costo.
7. **Correo de invitación.** La invitación queda guardada y se acepta cuando esa persona entra con el mismo correo. No se manda mail. Hace falta un proveedor si Hugo quiere el correo.
8. **Una cuenta, un restaurante.** Quien ya tiene restaurante no acepta la invitación de otro. El legado era igual (un usuario). Si un gerente debe ver dos locales, hay que diseñar sucursales.
9. **Datos de envío a las 12 horas.** El legado dejaba de mostrarlos. New los conserva en la orden. Borrar la dirección a las 12 h es un cambio de privacidad, no se hizo solo.
10. **Reembolso.** Devolver inventario no devuelve dinero. Un reembolso parcial contra Mercado Pago o contra el cajón no está modelado.
11. **Comentarios de redes y modificadores con mínimo y máximo.** No están en el legado operativo (el extra sí). No se inventó el modelo.

## Qué sigue pendiente y por qué

- Dos líneas del mismo platillo (decisión 4).
- Carrusel de pantallas como el legado.
- Ficha del mesero sin descuento.
- Caducidad de 12 h de la dirección (decisión 9).
- Recorte del dashboard por plan.
- Margen desde la receta (decisión 6).
- Correo de invitación (decisión 7).
- Comentarios sociales y modificadores avanzados (decisión 11).
- La migración `20261104010000` corre en el deploy a `main`, no en este preview. Hasta entonces Turno, Clientes, Equipo invitable, Reportes y la propina guardada muestran el aviso o caen al cobro anterior. La caja actual sigue cobrando.
