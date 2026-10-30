# Comparativa WapifoodFront vs NewWapifood

Documento vivo de migración gradual.  
Repos: `wapifoodmx-ctrl/WapifoodFront` (legacy) y `wapifoodmx-ctrl/NewWapifood` (destino).

**Última actualización:** 2026-10-29  
**Cómo usarlo:** al cerrar un ítem, marcar `[x]` y anotar el patch/commit. No borrar filas; solo actualizar estado.

---

## 1. Leyenda

| Estado | Significado |
|--------|-------------|
| **OK** | Existe en New con paridad útil |
| **PARCIAL** | Existe esqueleto; faltan reglas, modales o profundidad legacy |
| **NO** | No existe o no es usable como en Front |
| **N/A** | No aplica en la nueva arquitectura (reemplazado a propósito) |

**Canales de feedback**

| Legacy (Front) | New |
|----------------|-----|
| `toast.success/error/warning/info` | Mensajes inline `msg`/`err`/`notice` |
| `ModalMessage` | Casi no hay; `confirm`/`prompt`/`alert` nativos |
| `LoadingOverlay` | `loading` local por botón |
| Modales de negocio dedicados | Formularios en página o muy pocos modales |

---

## 2. Arquitectura (contexto)

| Tema | WapifoodFront | NewWapifood |
|------|---------------|-------------|
| Framework | Next Pages Router | Next App Router 16 |
| Auth | Token API propia | Supabase Auth |
| Backend | ApiWapifood + microservicio | Supabase (RLS + RPC) + Route Handlers MP |
| Multi-tenant | Usuario/API | `restaurants` + `memberships` |
| Pagos SaaS | MP vía API | MP checkout + webhook en Vercel |
| Diseño | Verde/gradientes legacy | DESIGN.md parchment/saffron |

---

## 3. Comparativa vista por vista

### 3.1 Público y auth

| Vista / flujo | Front (ruta + piezas) | New | Estado | Qué falta en New |
|---------------|----------------------|-----|--------|------------------|
| Landing | `/` Header, Main, Características, Funcionamiento, Paquetes, ChatBot | `/` + PricingSection | PARCIAL | ChatBot; profundidad marketing legacy |
| Términos | `/terminosyCondiciones` | `/terminos` | PARCIAL | Contenido legal completo |
| Login / registro | `/login` + loginForm; toasts | `/login` Supabase | PARCIAL | UX/toasts; mensajes más ricos |
| Recuperar pass | `/resetLink`, `/resetpass` | `/recuperar`, `/actualizar-password` | PARCIAL | Paridad visual y copy |
| Confirmación correo | Según API | `/auth/confirmado`, callback | OK | — |
| 404 | `/404` | default Next | PARCIAL | Página branded |

### 3.2 Plan SaaS (pago del software)

| Vista / flujo | Front | New | Estado | Falta |
|---------------|-------|-----|--------|-------|
| Listado planes / checkout | `/payments`, getPaymentsLink, checkPayment | `/pagos`, SubscriptionPanel, API MP | PARCIAL | checkPayment continuo tipo legacy; planes impresora legacy |
| Success pago | `/success` | `/pagos/exito` | OK | Copy/branding |
| Error pago | `/error` | `/pagos/error` | OK | — |
| Webhook activa plan | API Python | `/api/mercadopago/webhook` | PARCIAL | Robustez + service role en prod |

### 3.3 Perfil restaurante

| Vista / flujo | Front `/user` | New `/config` | Estado | Falta |
|---------------|---------------|---------------|--------|-------|
| Nombre, contacto, dirección | userpage + patchUserInfo | ConfigPanel | PARCIAL | RLS/name/logo en proceso (patch 0024); validaciones MX en curso |
| Logo | Colores/user | Storage + logo_url | PARCIAL | Persistencia estable post-RLS |
| Código confirmación | getCodogoConfirmacion | Sí | OK | — |
| Delivery on/off | putDeliveryOnOff | Toggle delivery_enabled | PARCIAL | Flujo domicilio completo vs externalOrderDelivery |
| Colores menú | post/patchColorMenu | ThemePanel | PARCIAL | Más opciones visuales |
| UUID menú web | getUserUUID / webmenu uuid | id restaurante en `/m/[id]` | N/A | Modelo distinto (OK si se documenta) |

### 3.4 Dashboard

| Capacidad | Front | New | Estado | Falta |
|-----------|-------|-----|--------|-------|
| Stats día | mainStats | KPIs básicos | PARCIAL | Densidad de métricas |
| Ventas / pedidos / populares | ventas, pedidos, populares | Más vendidos + por canal | PARCIAL | getPopulares profundidad; rangos fecha |
| Gráficas sem/mes/año/rango | getGrafica* | Solo 7 días tickets/$ | PARCIAL | Mes, año, rango custom |
| Lista pedidos dashboard | idpedidos | No dedicada | NO | Vista pedidos del día |
| Navbar rica | navbar.jsx | AppShell tabs | PARCIAL | UX móvil / agrupación |

### 3.5 Carta admin (`/menu` vs `/carta`)

| Capacidad | Front | New | Estado | Falta |
|-----------|-------|-----|--------|-------|
| Categorías CRUD | postCategoria, getCategoria | Sí en CartaManager | PARCIAL | Orden/drag, UI centrada en categorías |
| Productos CRUD | create/update/delete/status | Sí | PARCIAL | Listas de productos legacy |
| Imagen producto | Sí | image_url storage | PARCIAL | Galería multi-imagen (product_images) |
| Modal receta desde producto | modalRecetas, RecipeModalForProduct | No | NO | Atajo producto→receta |
| Toasts al guardar | toast.* | msg/err inline | PARCIAL | Sistema toast unificado |

### 3.6 Inventarios (`/inventarios` vs `/insumos`)

| Capacidad | Front | New | Estado | Falta |
|-----------|-------|-----|--------|-------|
| Alta/edición ingredientes | Sí + pestañas | Sí + tipos perecedero | PARCIAL | Pestañas legacy |
| Mermas | postMermas | prompt + RPC/fallback | PARCIAL | Modal merma formal |
| Kardex | getKardexData | StockMovesList parcial | PARCIAL | Kardex completo |
| PIN inventario | get/patch PinInventario | No | NO | Seguridad operativa |
| Regresar stock | inventarioRegresarStock | Entrada rápida | PARCIAL | Flujo “regresar” explícito |
| Toasts / overlays | Sí | inline | PARCIAL | — |

### 3.7 Recetas (`/recetas`)

| Capacidad | Front | New | Estado | Falta |
|-----------|-------|-----|--------|-------|
| Líneas producto-insumo | Add/EditRecipeModal | RecetasManager simple | PARCIAL | Modales dedicados |
| Extras / modificadores | ExtrasModals, get/post/patchExtras | No | NO | Módulo extras completo |
| Selection modals | SelectionModals | Selects simples | PARCIAL | UX selección |

### 3.8 Meseros admin (`/meseros`)

| Capacidad | Front | New | Estado | Falta |
|-----------|-------|-----|--------|-------|
| Alta/edición/borrado | Add/Edit/DeleteMeseroModal | WaitersPanel | PARCIAL | Modales + validaciones |
| Cards lista | MeseroCard, MeserosList | Lista básica | PARCIAL | — |
| Vincular mesero-orden | vincularMeseroOrden | No explícito | NO | Historial mesero-orden |

### 3.9 Punto de venta (`/puntodeventa` vs `/pos`)

| Capacidad | Front | New | Estado | Falta |
|-----------|-------|-----|--------|-------|
| Grid mesas + estados | tablesStatus, orderByTable | Sí | PARCIAL | Más estados (por cobrar, etc.) |
| Caja = mesa 1 | Concepto operativo | channel_type caja | PARCIAL | Forzar uso caja en cobros |
| Carrito modal | CarritoModal | Panel lateral/inline | PARCIAL | Modal carrito legacy |
| Pago modal | ModalsPago | Cobro simple | PARCIAL | Desglose, propina, parcial |
| Enviar cocina | Sí | Sí | OK | — |
| Cerrar orden + stock | endOrder* | close_order RPC | PARCIAL | Edge cases cancelación parcial |
| Cancelar orden | cancelOrder | cancel_order RPC | PARCIAL | Motivos + permisos UI |
| Comentarios línea | componenteComentario | No | NO | Notas por ítem |
| Toasts / loading | Sí | notice | PARCIAL | — |

### 3.10 Cocina (`/cocina`)

| Capacidad | Front | New | Estado | Falta |
|-----------|-------|-----|--------|-------|
| Lista comandas | VistaCocina | KitchenBoard | PARCIAL | — |
| Modal detalle | modalCocina | Cards | PARCIAL | Modal detalle rico |
| Estados | Según API | pendiente/cocina/lista/entregada | PARCIAL | Paridad nombres legacy |
| Confirm web | N/A explícito mismo | confirm_web_order | OK | — |
| Realtime | Según backend | Intent realtime | PARCIAL | Publication estable |
| Vista externa TV | pantallas / external | `/vista/.../cocina` | PARCIAL | — |

### 3.11 Tickets (`/tickets`)

| Capacidad | Front | New | Estado | Falta |
|-----------|-------|-----|--------|-------|
| Listado | getOrderTickets | TicketsBoard filtros | PARCIAL | — |
| Modal ticket | TicketModal | TicketCard + print | PARCIAL | Modal formal |
| PDF | pdfGenerator | window.print HTML | PARCIAL | PDF nativo |
| Vista externa | externalTicketView | `/t/[id]` beeper | PARCIAL | Beeper ≠ ticket fiscal legacy |
| Tickets mesero | getTicketMeserosDetails | No | NO | — |
| Cancelación | vía órdenes | Sí + motivo | PARCIAL | — |

### 3.12 Pantallas (`/pantallas`)

| Capacidad | Front | New | Estado | Falta |
|-----------|-------|-----|--------|-------|
| Hub pantallas | pantallasComponente | `/pantallas` links | PARCIAL | Catálogo pantallas legacy |
| External | pantallasExternal | parcial | PARCIAL | — |

### 3.13 Menú cliente / QR

| Capacidad | Front clientmenu + modales | New `/m/[id]` DigitalMenu | Estado | Falta |
|-----------|----------------------------|---------------------------|--------|-------|
| Carta categorías | Sí | Sí | OK | — |
| Detalle producto modal | ProductDetailModal | Click simple | NO | Modal detalle |
| Carrito modal | CartModal | Aside carrito | PARCIAL | Modal |
| Mesa modal | MesaSelectionModal | Select | PARCIAL | — |
| Código confirmación modal | ConfirmationCodeModal | Input inline | PARCIAL | Modal |
| Pago modal cliente | PaymentModal | No (pedido, no cobro MP mesa) | PARCIAL | Según regla negocio |
| Login modal menú | LoginModal | No | NO | Si se requiere |
| Toasts | Sí | status inline | PARCIAL | — |

### 3.14 Web menu público UUID + delivery

| Capacidad | Front `/webmenu/[uuid]` | New `/m/[id]` + order_type | Estado | Falta |
|-----------|-------------------------|----------------------------|--------|-------|
| Link público | UUID usuario | restaurantId | N/A | Documentar cambio |
| Pedido externo | createwebExternalOrder | place_public_order | PARCIAL | — |
| Delivery | externalOrderDelivery | domicilio + dirección/tel | PARCIAL | Tracking delivery, zonas, costos |
| Encargo pendiente confirmar | Sí (modelo negocio) | status pendiente | PARCIAL | Cola dedicada “encargos” en UI |

### 3.15 Kiosko

| Capacidad | Front `/kiosko` | New `/kiosko/[id]` | Estado | Falta |
|-----------|-----------------|--------------------|--------|-------|
| Catálogo kiosko | getProductsKiosko | DigitalMenu mode kiosk | PARCIAL | — |
| Post orden | kioskoPostOrder | source=kiosko | PARCIAL | Auto-cobro |
| Mesa kiosko dedicada | Concepto | channel_type kiosko | PARCIAL | — |

### 3.16 App mesero

| Capacidad | Front `/meseroMenu` | New `/mesero/[id]` WaiterApp | Estado | Falta |
|-----------|---------------------|------------------------------|--------|-------|
| Login propio modal | LoginMeseroModal | Login código pantalla | PARCIAL | Email+código API parity |
| Selección mesa modal | MeseroMesaSelectionModal | Tab mesas | PARCIAL | — |
| Carrito mesero modal | CartModalMesero | Cart fijo | PARCIAL | — |
| Solo mesas asignadas | Sí | Parcial | PARCIAL | — |
| Vincular orden-mesero | vincularMeseroOrden | No | NO | — |
| Tickets mesero | getTicketMeserosDetails | No | NO | — |
| Aislado del panel owner | Sí | Sí | OK | — |

### 3.17 Tablet por mesa

| Capacidad | Front (concepto tablets en piso) | New `/tablet/[tableId]` | Estado | Falta |
|-----------|----------------------------------|-------------------------|--------|-------|
| PIN dispositivo | Credenciales por canal | access_pin | PARCIAL | Admin credenciales multi-tablet |
| Pedido mesa fija | Sí en concepto | source=tablet | PARCIAL | Mezcla mesero+tablet rica |

### 3.18 Otros módulos Front

| Módulo | Front | New | Estado | Falta |
|--------|-------|-----|--------|-------|
| Masa production | `/masaProduction` | No | NO | Evaluar si sigue en producto |
| ChatBot | ChatBot + useCases/chatbot | No | NO | Opcional |
| Comentarios | get/postComentario | No | NO | Opcional |
| Equipo panel (memberships) | Implícito API | `/equipo` | OK | Invitar miembros UI |
| Beeper cliente | Implícito tickets externos | `/t/[id]` | OK (New innova) | — |

---

## 4. Qué SÍ trae NewWapifood (base útil)

- Auth Supabase (login, recovery, confirmación)
- Multi-tenant restaurants + memberships + trial/plan
- Mercado Pago checkout + webhook + success/error
- Config restaurante + theme menú + delivery flag + código confirmación
- Carta: categorías + productos + imagen
- Insumos: tipos perecedero/no, caducidad, merma, filtros
- Recetas simples producto→insumo
- Mesas con canales: caja / piso / tablet / kiosko
- POS multi-mesa: abrir, cocina, cobrar, cancelar
- Cocina: pendiente, confirmar web, lista, entregada
- Tickets con filtros + print + cancelar + link beeper
- Menú público, kiosko, tablet PIN, app mesero por código
- Dashboard KPIs, 7 días, top productos, ventas por canal, alertas stock
- Delivery web básico (domicilio pendiente)
- DESIGN tokens parchment/saffron
- Validaciones teléfono/CP MX (en curso)

---

## 5. Qué NO trae (o queda muy por debajo del Front)

1. Sistema global de **toasts** + LoadingOverlay + ModalMessage  
2. **Modales de negocio** (carrito, pago, detalle producto, mesa, código, meseros, recetas, cocina, ticket)  
3. **Extras / modificadores** de recetas y productos  
4. **PIN de inventario** + kardex completo  
5. **Dashboard** mes/año/rango + lista pedidos del día  
6. **PDF tickets** nativo  
7. **App mesero** profunda (vincular orden, tickets mesero, login email+código API)  
8. **Comentarios por línea** en POS  
9. **PaymentModal** cliente / cobros parciales POS  
10. **ChatBot**, **masaProduction**, **comentarios** públicos  
11. **Galería multi-imagen** de producto  
12. **Listas de productos** legacy  
13. Paridad visual/UX de cada pantalla legacy  
14. Credenciales ricas multi-dispositivo (tablets/kiosko)  
15. Delivery avanzado (zonas, costo envío, tracking)

---

## 6. Orden de migración específico (backlog vivo)

Prioridad: **primero reglas de negocio y canales; luego UX (modales/toasts); luego extras**.

### Fase 0 — Estabilidad datos (bloqueante)
- [ ] RLS UPDATE `restaurants` (nombre/logo) — SQL 018 + verificar en prod
- [ ] Guardado nombre/logo 100% confiable post-refresh
- [ ] Service role / webhook MP en Vercel estable

### Fase 1 — Capa de UX compartida (habilita el resto)
- [x] Toast global (paridad `components/Toast.jsx`) — patch 0025
- [x] LoadingOverlay reutilizable — patch 0025
- [x] Modal genérico + confirmAsync — patch 0025 (Config, Carta, Insumos, Mesas)

### Fase 2 — Carta y catálogo (base de toda venta)
- [x] Categorías como ciudadano de primera (orden) — patch 0026 + SQL 019
- [x] Flujo producto completo + validaciones + tabs — patch 0026
- [x] Atajo producto → receta — patch 0026
- [ ] (Opcional) multi-imagen

### Fase 3 — Inventario y recetas
- [x] Modal merma / entrada formal — patch 0027
- [x] Kardex completo — patch 0027
- [x] PIN inventario — patch 0027 + SQL 020
- [ ] Extras/modificadores (ExtrasModals)

### Fase 4 — POS paridad
- [x] Modal carrito — patch 0028
- [x] Modal pago (efectivo/tarjeta/transferencia, cambio) — patch 0028
- [x] Comentarios por línea — patch 0028 + SQL 021
- [ ] Estados de mesa más finos
- [x] Caja priorizada en grid — patch 0028

### Fase 5 — Cocina y tickets
- [x] Modal detalle comanda — patch 0029
- [x] Realtime cocina + poll 10s — patch 0029
- [x] Impresión ticket con notas (HTML print) — patch 0029
- [x] Vista beeper externa `/t/[id]` (ya existía)
- [ ] PDF binario nativo (opcional)

### Fase 6 — Canales cliente
- [x] Modal detalle producto (menú/kiosko) — patch 0030
- [x] Modal carrito + checkout mesa/código/domicilio — patch 0030
- [x] Cola encargos en cocina (status pendiente) — ya Fase 5
- [ ] Delivery: costo/zona si aplica negocio

### Fase 7 — Mesero y tablets
- [x] Login mesero por código + sesión — patch 0031
- [x] Vincular mesero-orden (set_order_waiter) — patch 0031 + SQL 022
- [x] Activas + historial mesero — patch 0031
- [x] Tablets PIN (ya bloque 2) — estable

### Fase 8 — Dashboard y reportes
- [x] Rangos 7d / 30d / mes — patch 0031
- [x] Populares y pedidos del día — patch 0031
- [ ] Exportes si se requieren

### Fase 9 — Opcionales producto
- [ ] ChatBot
- [ ] masaProduction (solo si el negocio lo sigue usando)
- [ ] Comentarios
- [ ] Capacitor / app nativa

---

## 7. Reglas de negocio críticas (checklist de no regresión)

Al migrar cada vista, verificar:

1. **Trial ≠ operación:** sin plan `active` no vender en POS/QR/kiosko/mesero.  
2. **Datos del cliente:** no seed de productos/mesas ajenos.  
3. **Web menú / domicilio:** encargos pueden quedar `pendiente` hasta confirmar.  
4. **POS/mesero/tablet/kiosko:** confirmados en local → cocina.  
5. **Cobro:** cierra orden, libera mesa, mueve stock por receta.  
6. **Cancelación:** libera mesa si no hay otra orden abierta; guarda motivo.  
7. **Mesero** nunca ve panel admin ni pagos SaaS.  
8. **Código confirmación** y **delivery** respetan flags de config.  
9. **Canales de mesa** caja/piso/tablet/kiosko no se mezclan mal en POS.  
10. **Pagos SaaS** los activa el webhook, no solo el front.

---

## 8. Registro de avances (ir llenando)

| Fecha | Ítem | Patch / commit | Notas |
|-------|------|----------------|-------|
| 2026-10-29 | Documento creado | COMPARATIVA-NEW-VS-FRONT.md | Baseline |
| 2026-10-29 | Fase 1 UX base | 0025-fase1-ux-toasts-modals.patch | Toast, overlay, confirm modal |
| 2026-10-29 | Fase 2 Carta | 0026-fase2-carta-categorias.patch | Tabs categorías/productos, sort, receta |
| 2026-10-29 | Fase 3 Inventario | 0027-fase3-inventario-kardex-pin.patch | Merma/entrada modal, kardex, PIN |
| 2026-10-29 | Fase 4 POS | 0028-fase4-pos-modales.patch | Carrito, pago, notas línea |
| 2026-10-29 | Fase 5 Cocina/Tickets | 0029-fase5-cocina-tickets.patch | Modal cocina, realtime, print |
| 2026-10-29 | Fase 6 Menú cliente | 0030-fase6-menu-kiosko-modales.patch | Detalle, carrito, checkout |
| 2026-10-29 | Fase 7+8 Mesero/Dashboard | 0031-fase7-8-mesero-dashboard.patch | Mesero profundo + analytics |
| | | | |

---

## 9. Repos de referencia (siempre abiertos en migración)

| Repo | Rol |
|------|-----|
| https://github.com/wapifoodmx-ctrl/WapifoodFront | Fuente de verdad UX/flujos/modales legacy |
| https://github.com/wapifoodmx-ctrl/ApiWapifood | Reglas API pagos, meseros, órdenes |
| https://github.com/wapifoodmx-ctrl/microServicioWapiFood | Lógica micro (inventario/comandas según uso) |
| https://github.com/wapifoodmx-ctrl/NewWapifood | Destino; patches siempre desde `main` actual |

---

*Fin del documento. Actualizar secciones 4–6 y la tabla de la §8 en cada bloque migrado.*
