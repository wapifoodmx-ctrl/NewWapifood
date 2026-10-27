# Inventario de funcionalidades Wapifood (migración)

Fuente: `WapifoodFront` main + `ApiWapifood` + `microServicioWapiFood`.
Destino: `NewWapifood` + Supabase.

## A. Público / SaaS

| ID | Funcionalidad | Legacy | Nueva ruta | Estado |
|---|---|---|---|---|
| A1 | Landing marketing | `pages/index.js` | `/` | en curso |
| A2 | Precios / paquetes | `components/paquetes.jsx` | `/#precios` | en curso |
| A3 | Login | `pages/login.js` | `/login` | hecho |
| A4 | Registro + confirmación correo | auth + mail | `/login`, `/auth/*` | hecho |
| A5 | Recuperar / reset password | `resetLink`, `resetpass` | `/recuperar`, `/actualizar-password` | hecho |
| A6 | Términos y condiciones | `terminosyCondiciones` | por migrar | pendiente |
| A7 | Pago de suscripción | `pages/payments.js` | `/pagos` | shell |

## B. Panel del restaurante (owner/admin)

| ID | Funcionalidad | Legacy | Nueva ruta | Qué hace |
|---|---|---|---|---|
| B1 | Dashboard / gráficos | `dashboard.js` | `/dashboard` | Ventas, tickets, mesas, alertas stock |
| B2 | Perfil restaurante | `user.js` + user_info | `/config` | Nombre, logo, teléfono, dirección, horario |
| B3 | Carta / productos | `menu.js` | `/carta` | Alta/edición productos, precio, costo, categoría, imagen |
| B4 | Categorías | API categoria | dentro de `/carta` | Agrupar productos del menú |
| B5 | Recetas | `recetas.js` | `/recetas` | Insumos por producto para descontar stock |
| B6 | Inventario / insumos | `inventarios.js` + micro | `/insumos` | Stock, mínimos, entradas, mermas |
| B7 | Mesas | parte de POS | `/pos` + config mesas | Alta número de mesas / lugares |
| B8 | Meseros | `meseros.js` | `/meseros` | Nombre, código acceso, mesas asignadas |
| B9 | Punto de venta | `puntodeventa.js` | `/pos` | Abrir mesa, pedir, cobrar, ticket |
| B10 | Cocina | `cocina.js` | `/cocina` | Ver comandas, marcar listas |
| B11 | Tickets | `tickets.js` | `/tickets` | Historial e impresión/PDF |
| B12 | Pantallas | `pantallas.js` | `/pantallas` | Pantalla cocina / turno externa |
| B13 | Colores menú digital | menucolors API | `/config` | Tema del menú público |
| B14 | Web config delivery | web_config | `/config` | Flags del menú web |

## C. Experiencia comensal / mesero

| ID | Funcionalidad | Legacy | Nueva ruta | Qué hace |
|---|---|---|---|---|
| C1 | Menú cliente | `clientmenu.js` | `/menu` | Carta pública, carrito |
| C2 | Menú web por UUID | `webmenu/[uuid]` | `/m/[slug]` | Link/QR del restaurante |
| C3 | Kiosko | `kiosko.js` | `/kiosko` | Pedido en barra/tablet |
| C4 | Menú mesero | `meseroMenu.js` | `/mesero` | Login por código, tomar orden |
| C5 | Confirmación código | modales | flujo menú | Validar pedido cliente |

## D. Datos / backend (Supabase)

| ID | Tabla / recurso | Uso |
|---|---|---|
| D1 | restaurants, memberships | Multi-tenant + roles |
| D2 | products, categories, product_images | Carta |
| D3 | ingredients, recipe_lines, stock_moves | Inventario |
| D4 | dining_tables, orders, order_items | POS |
| D5 | waiters, waiter_tables | Meseros |
| D6 | restaurant_profiles, menu_theme | Perfil + branding |
| D7 | subscriptions | Plan SaaS |
| D8 | Storage bucket `public-media` | Logos e imágenes menú (público) |

## Orden de migración (bloques)

1. **Landing + precios** (este patch)
2. **Config restaurante + logo (bucket)** + validaciones perfil
3. **Carta productos + categorías + imágenes**
4. **Mesas + POS cobro**
5. **Insumos + recetas**
6. **Meseros + menú mesero**
7. **Menú digital / QR / kiosko**
8. **Cocina + pantallas + tickets**
9. **Pagos / suscripción**

Cada bloque: UI usable + RLS + sin pasos manuales para el cliente.
