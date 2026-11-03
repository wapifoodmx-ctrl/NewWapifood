# Paridad Wapifood legado → NewWapifood

Fecha: 2026-11-03. Los tres repos se clonaron en solo lectura:

- `WapifoodFront` rama `main`
- `ApiWapifood` rama `master`
- `microServicioWapiFood` rama `master`

El microservicio de GitHub no contiene `/inventory/extras`. El front llama `https://api-micro.wapifood.com/inventory/extras/`, que no está en ese snapshot. La regla de adicionales se reconstruyó del front (`Recetas/ExtrasModals.jsx`, `useCases/postExtras.js`, `getExtras.js`) y de `product_extras` en Supabase.

## Matriz

Leyenda: **Sí** = usable en New. **Parcial** = existe con huecos. **No** = no está. **Este PR** = se cierra aquí (el SQL de adicionales corre en el deploy, no en este preview).

| Flujo legado | Dónde vivía | New | Estado |
|---|---|---|---|
| Landing, login, recuperar, confirmar correo | `pages/index`, `login`, `reset*` | `/`, `/login`, `/recuperar`, `/auth` | Sí |
| Onboarding sin seed | API user | RPC `create_my_restaurant` | Sí |
| Config restaurante + logo | `user/` | `/config` + bucket `public-media` | Sí |
| Carta, categorías, foto | `menu/` | `/carta` | Sí |
| Insumos, PIN, kardex, pestaña adicionales | Inventarios + micro | `/insumos` | Sí |
| Receta multi-insumo y unitario | `Recetas/` | `/recetas` + `ensure_unit_product_inventory` | Sí |
| Adicional con precio en receta, POS y menú | `ExtrasModals`, carrito | `product_extras` + `order_item_extras` | Este PR |
| Mesas libre / ocupada / no disponible | `tablesStatus` | `/mesas` | Sí |
| POS, descuento, comentario, cobro | `Puntodeventa/` | `/pos` + `close_order` | Sí. Un producto sigue siendo una sola línea (PK `order_id, product_id`); los extras cuelgan de esa línea |
| Cocina por ítem | `modalCocina` | `/cocina` | Sí |
| Beeper `/t/{id}` | tickets externos | `/t/[orderId]` | Sí. La lectura pública de todas las órdenes sigue abierta por RLS; `get_public_ticket` queda para acotarla |
| Mesero por código | `meseroMenu` | `/mesero/[id]` | Sí, con adicionales |
| Tablet y kiosko | `kiosko`, tablet | `/tablet`, `/kiosko` | Sí, con adicionales |
| Menú QR y domicilio | `webmenu`, `clientmenu` | `/m/[id]` | Sí |
| Plan Mercado Pago | API payments (antes Stripe) | `/pagos` + webhook firmado | Este PR. No hay Stripe. Se quitó “Activar sin pago” |
| Dashboard | `dashboardComponents` | `/dashboard` | Parcial (sin todas las gráficas del front) |
| Tickets listado | `tickets/` | `/tickets` | Parcial (sin PDF nativo) |
| Pantallas | `pantallas` | `/pantallas` | Parcial |
| Equipo / roles | memberships | `/equipo` | Parcial |
| Chatbot, masa, comentarios sociales, import CSV, listas custom, multi-foto | useCases sueltos | — | No. No se reintroducen en este PR |

## Base viva (verificada, no modificada)

Proyecto `bdimvrykjcvccbjczqkh`. El dump `base_actual.sql` coincide en tablas y columnas y no trae enums, RPC, triggers, RLS, realtime ni storage.

- `order_status`: abierta, cocina, lista, pagada, cancelada, pendiente, entregada
- `table_state`: libre, ocupada, no_disponible
- También existen `app_role`, `pay_method`, `stock_reason`
- Realtime: `orders`, `order_items`, `dining_tables`
- Bucket `public-media` con políticas duplicadas (las débiles se eliminan en la migración nueva)
- 033 aplicada (`product_extras`, `is_extra`, `inventory_mode`)
- No hay `supabase_migrations`
- 30 funciones `security definer` ejecutables por `anon` y `authenticated`, incluidas `activate_plan`, `close_order`, `register_merma` y `rls_auto_enable`
- `close_order` tiene dos firmas (`pay_method` y `text`). El POS manda texto. La migración deja solo `text`
- `place_public_order` tiene 4 firmas (5, 6, 7 y 10). El código usa nombres de la de 10. Las otras se eliminan
- `set_order_waiter` lo llama el mesero y no está en producción. La migración lo crea
- 13 llaves foráneas sin índice, 6 políticas con `auth.uid()` por fila

La migración `20261103231000` no se aplicó desde aquí. El preview sigue sobre el esquema actual.

## Hecho en este trabajo

- Adicionales en receta, caja, menú, mesero, tablet y kiosko (la tabla `order_item_extras` llega con la migración).
- Importación CSV de insumos y productos (`/importar`), con kg→g y L→ml.
- Ayuda en el panel con las preguntas del chatbot legado. La API `api.wapifood.com/api/chatbot` no se reexpone.
- Pantalla `/masa` en el mismo estado que el original: sin lógica de lotes.
- Tablas `product_lists` y `order_comments` en la migración, todavía sin pantalla.

## Falta para la siguiente corrida

1. Pantalla de listas custom (`/listas`) sobre `product_lists`.
2. Comentarios de orden en Tickets y cocina sobre `order_comments`.
3. Varias fotos por producto (`product_images` ya existe en la base).
4. PDF de ticket (hoy es impresión HTML).
5. Gráficas del dashboard por día, semana, mes, año y rango, como `getGrafica*`.
6. Rendimiento por mesero y límite de meseros del plan.
7. División de cuenta (el legado la preguntaba en el chatbot; no hay flujo claro en la API).
8. Chatbot remoto: hace falta un proveedor nuevo. El endpoint viejo no está en este stack.
9. Producción de masa real: el repo legado solo muestra “en desarrollo”.
10. Aplicar la migración en Supabase (`migration repair` de la baseline y luego el push). El preview no debe usarse para crear datos ni cobrar.
