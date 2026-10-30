# DICTAMEN 100% — Lógica de negocio de WapifoodFront

**Repo:** https://github.com/wapifoodmx-ctrl/WapifoodFront  
**APIs que orquesta el Front:**
- Principal: `https://api.wapifood.com`
- Micro inventario: `https://api-micro.wapifood.com`

**Propósito de este documento:** dejar **dictaminada** la lógica de negocio del software legado **pantalla por pantalla**, **sección por sección** y **useCase por useCase**, sin omitir módulos. Es la fuente de verdad funcional antes de seguir migrando NewWapifood.

---

## 0. Modelo mental global del negocio

WapifoodFront es un **SaaS de restaurante** con:

1. **Dueño / admin del local** (token JWT de `api.wapifood.com`) → panel completo.  
2. **Mesero** (código / login propio) → mini-sistema de piso.  
3. **Cliente final** (menú QR / web / kiosko) → pedir sin panel.  
4. **Cocina / pantallas** → operación y estados de comanda.  
5. **Inventario (microservicio)** → insumos, recetas, extras, mermas, PIN, process-order.  
6. **Suscripción** → gate de uso (`checkPayment` / planes).

### 0.1 Tres capas de estado (crítico)

| Capa | Valores de negocio en Front | API |
|------|----------------------------|-----|
| **Mesa** | `Libre`, `Ocupado`, `NoDisponible` | `POST /tables/status` |
| **Orden** | al menos `Pendiente`, en curso, `Finalizado`, `Cancelado` | `PUT .../cambio_estatus?order_status=&metodo_pago=` |
| **Producto dentro de orden** | `Pendiente`, `Preparado`, `Cancelado`, `Finalizado` | `PUT .../cambio_details_status` (`updateProductStatus`) |

### 0.2 Mesa 1 = Punto de venta

Regla transversal: **mesa número 1** se trata como **caja / POS**. En cocina, al “completar”, a menudo **finaliza la orden** y dispara **process-order** (inventario), a diferencia de mesas de piso que solo marcan productos Preparado.

### 0.3 Auth transversal

- `AuthGuard` + token en storage.  
- Navbar del dashboard exige sesión.  
- Rutas públicas: landing, login, recovery, webmenu, a veces clientmenu/kiosko/mesero según diseño.

---

# PARTE A — Pantallas (`pages/`)

## A1. `/` — Landing (`pages/index.js`)

**Componentes:** Header, Main, Características, Funcionamiento, paquetes/planes, Creditos, FormContainer, ChatBot, appTickets, paginaWeb.

**Lógica de negocio:**
- Marketing del SaaS.
- CTA a login / registro.
- Mostrar **paquetes** (planes de venta).
- ChatBot comercial (`useCases/chatbot.js` → `POST /api/chatbot`).
- No opera mesas ni órdenes.

---

## A2. `/login` — Login y alta de cuenta

**UI:** `loginComponents/loginForm.jsx`  
**UseCases:** `login.js`, `createUser.js`, `postDataUser.js`

**Lógica:**
1. **Registro** → `POST /user` (`createUser`).  
2. **Login** → API login; guarda token.  
3. Tras login puede pedir / completar **info de restaurante** (`/user/me/info`).  
4. Si no hay pago activo, flujos posteriores redirigen a `/payments` (guardas en dashboard/cocina).

---

## A3. `/resetLink` y `/resetpass` — Recuperación

**UseCases:** `recuperarContraseña.js` (`POST /user/password-reset/request`), `cambiarPass.js` (`POST /user/password-reset/confirm`).

**Lógica:** solicitar correo → link → confirmar nueva contraseña → volver a login.

---

## A4. `/payments` — Suscripción del software

**UseCases:** `getPaymentsLink.js`, `checkPayment.js`

**Lógica:**
1. Listar / generar link de pago (Mercado Pago vía API).  
2. `GET /payments/check-payment` valida si puede usar el producto.  
3. Gate global: sin plan activo, módulos operativos se bloquean o muestran modal de suscripción (cocina tiene countdown/modal).

---

## A5. `/success` y `/error`

**Lógica:** retorno de pasarela. Success confirma pago; error permite reintentar. No mutan inventario ni mesas.

---

## A6. `/dashboard` — Panel analítico

**Componentes:**  
`dashboard.jsx`, `mainStats.jsx`, `mainContentDasboard.jsx`, `ventas.jsx`, `pedidos.jsx`, `populares.jsx`, `idpedidos.jsx`, `chart.jsx`, `chartbar.jsx`, `navbar.jsx`

**UseCases:**  
`getAnalitics`, `getDataGrafico`, `getGraficaSemana`, `getGraficaMes`, `getGraficaAño`, `getGraficaFechas`, `getOrdersDia`, `getOrdersSemana`, `getOrdersMes`, `getOrdesFecha`, `getPopulares`, `getLatestOrdersByPlan`

**Lógica de negocio:**
- KPIs del día / periodo.  
- Ventas y conteo de pedidos.  
- Productos **populares**.  
- Gráficas por semana, mes, año, rango de fechas.  
- Listado / detalle de pedidos (`idpedidos`) con estados tipo “En Proceso”, cancelados, etc.  
- Navbar: accesos a POS, cocina, tickets, menú, inventarios, meseros, pantallas, user, payments; indicadores de pendientes.

---

## A7. `/user` — Perfil del restaurante

**UI:** `user/userpage.jsx`  
**UseCases:**  
`getUserInfo`, `patchUserInfo`, `getUserUUID`, `getCodogoConfirmacion`, `getDeliveryOnOff`, `putDeliveryOnOff`, `getColorMenu`, `postColorMenu`, `patchColorMenu`

**Lógica:**
- Datos del local (nombre, contacto, dirección, etc.).  
- **Código de confirmación** del menú digital (clientes lo deben ingresar).  
- **Delivery on/off** global para pedidos web a domicilio.  
- **Colores del menú** digital.  
- UUID del restaurante para links `/webmenu/[uuid]`.

---

## A8. `/menu` — Carta admin (productos y categorías)

**UI:** `menuComponents/menucomponentes.jsx`, `Cards.jsx`, `modalRecetas.jsx`, `RecipeModalForProduct`  
**UseCases:**  
`getProducts`, `createProduct`, `updateProduct`, `updateProductStatus` (activo/inactivo producto catálogo), `deleteProduct`, `getCategoria`, `postCategoria`, `crearListaProductos`, `actualizarListaProductos`, `deleteListaProductos`, `getListaProductos`

**Lógica:**
1. CRUD **categorías**.  
2. CRUD **productos**: nombre, precio, categoría, imagen, descripción, **activo/inactivo**.  
3. **Listas custom** de productos (`/products/custom-list`) para pantallas/kiosko/especiales.  
4. Atajo a **receta** desde producto.  
5. Solo productos activos entran a canales de venta.

---

## A9. `/inventarios` — Inventario

**UI:** `Inventarios/inventario.jsx`, `navegaciónPestañas.jsx`, `pestañasInventario.jsx`  
**API micro:** `api-micro.wapifood.com`  
**UseCases:**  
`getIngredientesInventario`, `postInventarioIngredientes`, `putEditarIngrediente`, `postMermas` (**process-order**), `inventarioRegresarStock`, `getKardexData`, `getPinInventario`, `patchPinInventario`, `getIngredienteId`

**Lógica / pestañas típicas:**
1. Alta y edición de **ingredientes** (stock, mínimos, unidades).  
2. **Entradas** / ajustes de stock.  
3. **Mermas** explícitas.  
4. **Kardex** (historial de movimientos).  
5. **PIN de inventario** (seguridad operativa; sin PIN no se hacen movimientos sensibles).  
6. **Regresar stock** (reversa).  
7. Al **procesar orden finalizada**, `POST /inventory/process-order/` descuenta por recetas (`postMermas.js` nombre histórico, función process-order).

---

## A10. `/recetas` — Recetas y extras

**UI:** `Recetas/recipes.jsx`, `RecipeCard`, `AddRecipeModal`, `EditRecipeModal`, `SelectionModals`, `ExtrasModals`, `recetasExtras.jsx`  
**UseCases:**  
`getRecetas`, `getRecetasId`, `postRecetas`, `putRecetas`, `getExtras`, `postExtras`, `patchExtras`

**Lógica:**
1. Por cada **producto vendible**, líneas de receta: insumo + cantidad.  
2. **Extras / modificadores** (micro inventario `/inventory/extras/`).  
3. Sin receta, el process-order puede no descontar ese producto.  
4. Modales dedicados de alta/edición/selección.

---

## A11. `/meseros` — Administración de meseros

**UI:** `MeserosList`, `MeseroCard`, `AddMeseroModal`, `EditMeseroModal`, `DeleteMeseroModal`  
**UseCases:** `getMeseros`, `postMeseros`, `updateMeseros`, `deleteMeseros`, `vincularMeseroOrden`

**Lógica:**
1. Alta mesero: nombre, código/credenciales, mesas asignadas.  
2. Edición / baja.  
3. **Asignar mesero a orden** (`POST /waiters/assign/order`) para  
4. Los meseros **no** usan el login del dueño.

---

## A12. `/puntodeventa` — Punto de venta (caja)

**UI:** `pntoventa.jsx`, `ProductoCard`, `CarritoModal`, `ModalsPago`  
**UseCases:**  
`getTables`, `tablesStatus`, `orderByTable` (última orden por mesa), `OrderPntoVenta` (`createOrder`, `createSimpleOrder`, `addProductsToOrder`), `puntoVentaPostOrder`, `endOrderPuntoDeVenta`, `endPuntoDeVenta`, `endOrder`, `cancelOrder`, `postComentario`, `getComentario`

**Flujo de negocio completo:**

```
1. Cargar mesas + estados (Libre/Ocupado/NoDisponible)
2. Elegir mesa (Mesa 1 = caja)
3. Si hay última orden abierta → continuar (order_uuid)
   Si no → crear orden nueva (POST /orders)
4. Agregar productos (y opcionalmente addProductsToOrder)
5. CarritoModal:
   - qty
   - descuento por producto
   - descuento por orden
   - comentario por línea / orden
   - ver estado del ítem (Pendiente/Preparado/Cancelado) si ya fue a cocina
6. Enviar a cocina (productos quedan Pendiente en cocina)
7. Mesa → Ocupado
8. Cobro ModalsPago:
   - efectivo / tarjeta / pasarela
   - cálculo de cambio
   - descuentos
9. cambio_estatus → Finalizado + metodo_pago
10. process-order inventario (según flujo)
11. Mesa → Libre (si aplica)
12. Cancelar orden → Cancelado + liberar mesa
```

**Reglas:**
- No operar mesas `NoDisponible`.  
- Una cuenta activa por mesa (última orden).  
- Se pueden **añadir productos** a orden existente.  
- Descuentos: % o monto, por línea o global.

---

## A13. `/cocina` — Cocina

**UI:** `VistaCocina.jsx`, `modalCocina.jsx`  
**UseCases:**  
`getTables`, `getOrdersDia`, `getOrdersWebMenu`, `updateProductStatus`, `cancelOrder`, `endPuntoDeVenta`, `updateTableStatus`, `getTicket`, `postMermas` (process-order), `getComentario`, `getWebOrderUuid`, `createwebExternalOrder`

**Lógica de negocio (dictamen fino):**

### A13.1 Carga
- Mesas + mapa `table_status`.  
- Órdenes del día.  
- Órdenes web menu / delivery.  
- Arma “comandas” virtuales por mesa+orden con `type`:
  - `pending` — hay productos pendientes  
  - `completed` — todos los activos en Preparado  
  - `finished` — order_status Finalizado  
  - `cancelled` — Cancelado  
  - `unavailable` — mesa NoDisponible  

### A13.2 Por producto (`cambio_details_status`)
- Marcar **Preparado**  
- Marcar **Cancelado** (producto)  
- **Regresar** a Pendiente  
- Comentarios de orden visibles  

### A13.3 Por orden
- Cancelar orden completa → `Cancelado`  
- Finalizar (sobre todo Mesa 1) → `Finalizado` + inventario  
- Finalizar comanda completed → entrega operativa + posible liberar mesa  

### A13.4 Mesa 1
- Branch especial: “Finalizar Orden” vs “Marcar Preparado” en mesas normales.

### A13.5 Web / delivery
- Pedidos externos aparecen en cocina.  
- Pueden requerir aceptación / process distinto (`orders/web/process/...`).  
- Info de delivery (`getWebOrderUuid`).

### A13.6 Liberar mesa
- Modal de release: `NoDisponible`/`Ocupado` → `Libre` cuando aplica.

---

## A14. `/tickets` — Tickets

**UI:** `pages/tickets.js`, `Ticketview.jsx`, `externalTicketView.js`, `TicketModal`, `pdfGenerator.js`  
**UseCases:** `getOrderTickets`, `getTicket`, `getTicketMeserosDetails`, `getfinalOrderId`

**Lógica:**
- Listar tickets del local.  
- Detalle de orden (ítems, totales, status, pago).  
- Modal ticket.  
- **PDF** de ticket.  
- Vista externa (pantalla / link).  
- Incluye cancelados y finalizados.  
- Tickets asociados a meseros (`getTicketMeserosDetails`).

---

## A15. `/pantallas` y `/pantallasExternal`

**UI:** `Pantallas/pantallasComponente.jsx`  
**UseCases:** `mostrarListPantallas`, listas custom de productos

**Lógica:**
- Configurar **qué se muestra** en pantallas del local (cocina, menú TV, listas).  
- CRUD de listas de productos para pantallas.  
- Abrir vista external a pantalla completa.

---

## A16. `/clientmenu` — Menú cliente interno

**UI:** `menucliente.jsx` + modales: ProductDetail, Cart, MesaSelection, ConfirmationCode, Payment, Login  
**UseCases:** `orderClientMenu`, productos, código confirmación, mesas

**Flujo:**
```
Carta → detalle producto → carrito → elegir mesa → código confirmación
→ enviar orden → (opcional pago modal) → estados de ítems visibles en carrito
```

**Reglas:**
- Solo mesas no bloqueadas.  
- Código de confirmación si el local lo exige.  
- Productos activos.

---

## A17. `/webmenu/[uuid]` — Menú web público

**UI:** `menuweb/Menuweb.jsx`  
**UseCases:** `getwebmenu`, `getWebOrderUuid`, `createwebExternalOrder`, `externalOrderDelivery`

**Lógica:**
- Identifica restaurante por **UUID** (no sesión admin).  
- Muestra carta pública.  
- Crea pedido **web externo**.  
- Si delivery ON → dirección / flujo domicilio (`orders/web/create`).  
- Process web: `orders/web/process/{uuid}?accion=`  
- Encargos pueden quedar pendientes de aceptación en cocina.

---

## A18. `/kiosko` — Kiosko

**UseCases:** `getProductsKiosko`, `kioskoPostOrder` / a veces `puntoVentaPostOrder` hacia `/orders/kiosko`

**Lógica:**
- Auto-servicio en local.  
- Catálogo kiosko (puede usar lista custom).  
- POST orden canal kiosko → cocina.  
- No es el panel admin.

---

## A19. `/meseroMenu` — App mesero

**UI:** `meseroMenuComponent.jsx`, LoginMeseroModal, MeseroMesaSelectionModal, CartModalMesero  
**UseCases:** `loginMesero`, `getMeseros`, órdenes por mesa, `vincularMeseroOrden`, tickets mesero

**Flujo:**
```
Login mesero (código/credencial)
→ solo mesas asignadas (Libre/Ocupado según reglas)
→ armar carrito
→ enviar a cocina
→ vincular mesero-orden
→ ver estados / tickets del mesero
```

**Reglas:**
- Aislado del panel dueño.  
- No administra suscripción ni inventario global.  
- Ve estados de productos en carrito (ero.

---

## A20. `/masaProduction` — Producción de masa

**Lógica de negocio propia** de producción (módulo vertical). No es canal de venta al cliente; es proceso productivo interno ligado al inventario/operación del local. Debe preservarse si el negocio lo sigue usando.

---

## A21. Legales y utilidad

| Ruta | Lógica |
|------|--------|
| `/terminosyCondiciones` | Texto legal |
| `/404` | No encontrado |
| `/sitemap.xml` | SEO |
| `pages/api/hello.js` | Health dummy |

---

# PARTE B — Inventario completo de UseCases (86)

Cada fila = contrato de negocio que el Front espera de backend.

### B1. Identidad y acceso
| UseCase | Endpoint (resumen) | Negocio |
|---------|-------------------|---------|
| login.js | login API | Sesión dueño |
| createUser.js | POST /user | Alta cuenta |
| postDataUser.js | /user/me/info | Leer/completar perfil |
| getUserInfo.js | /user/me/info | Perfil |
| patchUserInfo.js | PATCH /user/me/info | Actualizar perfil |
| getUserUUID.js | UUID local | Links públicos |
| recuperarContraseña.js | password-reset/request | Recuperar |
| cambiarPass.js | password-reset/confirm | Nueva pass |
| loginMesero.js | login mesero | Sesión piso |
| AuthGuard | — | Gate rutas |

### B2. Pagos SaaS
| UseCase | Endpoint | Negocio |
|---------|----------|---------|
| getPaymentsLink.js | payments link | Preferencia MP |
| checkPayment.js | /payments/check-payment | ¿Plan activo? |

### B3. Catálogo
| UseCase | Endpoint | Negocio |
|---------|----------|---------|
| getProducts.js | /products | Listar |
| createProduct.js | /products | Alta |
| updateProduct.js | /products/:id | Edición |
| updateProductStatus.js (catálogo) | status producto | Activo/inactivo **del producto del menú** (distinto al de línea de orden) |
| deleteProduct.js | DELETE /products/:id | Baja |
| getCategoria.js / postCategoria.js | /categoria | Categorías |
| crear/actualizar/delete/get ListaProductos | /products/custom-list | Listas custom |

### B4. Inventario (micro)
| UseCase | Endpoint | Negocio |
|---------|----------|---------|
| getIngredientesInventario | /inventory/ingredients | Stock |
| postInventarioIngredientes | POST ingredients | Alta |
| putEditarIngrediente | PUT ingredients/:id | Edición |
| getIngredienteId | por id | Detalle |
| getKardexData | kardex | Historial |
| inventarioRegresarStock | regresar | Reversa stock |
| postMermas / process-order | /inventory/process-order/ | Descuento por orden finalizada |
| getPinInventario / patchPinInventario | /inventory/security/pin | PIN |
| getRecetas / postRecetas / putRecetas | /inventory/recipes | Recetas |
| getRecetasId | recipe by id | Detalle |
| getExtras / postExtras / patchExtras | /inventory/extras | Extras |

### B5. Mesas
| UseCase | Endpoint | Negocio |
|---------|----------|---------|
| getTables.js | tables | Listado + status |
| tablesStatus.js | POST /tables/status | Libre/Ocupado/NoDisponible |
| orderByTable.js | last-order-by-table | Última orden de la mesa |

### B6. Órdenes y estatus
| UseCase | Endpoint | Negocio |
|---------|----------|---------|
| OrderPntoVenta.js | POST /orders | Crear / ampliar orden POS |
| puntoVentaPostOrder.js | /orders/kiosko | Canal kiosko |
| orderClientMenu.js | orden cliente | Canal menú cliente |
| kioskoPostOrder.js | kiosko | Alta kiosko |
| updateProductStatus.js | cambio_details_status | **Status por ítem** |
| cancelOrder.js | cambio_estatus=Cancelado | Cancelar orden |
| endOrder.js / endPuntoDeVenta.js | Finalizado + pago | Cerrar |
| endOrderPuntoDeVenta.js | status paramétrico + pago | Cierre flexible |
| createwebExternalOrder.js | orders/web/process | Procesar web |
| externalOrderDelivery.js | orders/web/create | Crear delivery |
| getOrdersWebMenu.js | órdenes web | Listar encargos |
| getWebOrderUuid.js | detalle web | Delivery info |
| postComentario / getComentario | /orders/:id/comments | Comentarios |
| vincularMeseroOrden.js | waiters/assign/order | Mesero↔orden |

### B7. Lecturas operativas / analítica
| UseCase | Negocio |
|---------|---------|
| getOrdersDia/Semana/Mes/Fecha | Órdenes por periodo |
| getOrderTickets / getTicket / getfinalOrderId | Tickets |
| getTicketMeserosDetails | Tickets mesero |
| getAnalitics / getDataGrafico / getGrafica* | Dashboard |
| getPopulares | Top productos |
| getLatestOrdersByPlan | Últimas órdenes según plan |
| getDeliveryOnOff / putDeliveryOnOff | Flag delivery |
| getCodogoConfirmacion | Código menú |
| getColorMenu / post / patch | Theme menú |
| getwebmenu | Carta pública |
| getProductsKiosko | Catálogo kiosko |
| getMeseros / post / update / delete | CRUD meseros |
| mostrarListPantallas | Pantallas |
| chatbot.js | Asistente |
| sendChatMessage | Mensajes bot |

---

# PARTE C — Flujos de extremo a extremo (dictamen)

## C1. Onboarding dueño
Registro → login → completar user → pagar plan (`checkPayment`) → configurar user (código, delivery, colores) → categorías → productos → insumos → recetas → mesas → meseros → operar.

## C2. Venta POS
Mesa libre → abrir/continuar orden → carrito (desc+notas) → cocina (ítems Pendiente) → mesa Ocupado → cocina Preparado ítem a ítem → cobro Finalizado → process-order → mesa Libre → ticket.

## C3. Venta mesero
Login mesero → mesa asignada → carrito → cocina → vincular mesero → ticket mesero.

## C4. Tablet / menú cliente en mesa
Menú → mesa → código → orden → cocina (misma máquina de estados de ítems).

## C5. Kiosko
Catálogo kiosko → orden kiosko → cocina.

## C6. Web / domicilio
webmenu UUID → carrito → create web/delivery → pendiente/process → cocina confirma → prepara → entrega.

## C7. Cancelaciones
- Ítem: Cancelado (sigue la orden).  
- Orden: Cancelado + mesa Libre.  
- Inventario: no descontar ítems cancelados; process-order sobre finalizados.

## C8. Inventario
Receta define consumo → solo al process-order / cierre → kardex y mermas manuales con PIN.

---

# PARTE D — Reglas que NO se pueden violar al migrar

1. Status de **ítem** ≠ status de **orden** ≠ status de **mesa**.  
2. Cocina opera **por producto** primero.  
3. **Finalizado** implica cierre económico (+ método de pago).  
4. **process-order** de inventario va con cierre, no con “Preparado”.  
5. Mesa **NoDisponible** no toma pedidos.  
6. **Mesa 1** tiene reglas de cierre distintas.  
7. Mesero **nunca** es el admin.  
8. Web/delivery puede requerir **confirmación** antes de cocina.  
9. Código de confirmación es gate del menú digital si está activo.  
10. Delivery global on/off en perfil.  
11. Listas custom de productos alimentan pantallas/kiosko.  
12. Extras son parte del modelo de receta/modificadores.  
13. Descuentos POS existen en la lógica de cobro del Front.  
14. Comentarios de orden son de primer nivel en API.  
15. Plan inactivo bloquea operación (no solo esconde botones).

---

# PARTE E — Cobertura de archivos del Front (checklist de dictamen)

### Pages dictaminadas
- [x] index, login, resetLink, resetpass  
- [x] payments, success, error  
- [x] dashboard, user  
- [x] menu, inventarios, recetas, meseros  
- [x] puntodeventa, cocina, tickets  
- [x] pantallas, pantallasExternal  
- [x] clientmenu, webmenu/[uuid], kiosko, meseroMenu  
- [x] masaProduction  
- [x] terminosyCondiciones, 404, sitemap, api/hello  

### Carpetas UI dictaminadas
- [x] Menucliente/* (todos los modales)  
- [x] Puntodeventa/*  
- [x] pages/cocina/*  
- [x] Inventarios/*  
- [x] Recetas/*  
- [x] Meseros/*  
- [x] Pantallas/*  
- [x] dashboardComponents/*  
- [x] loginComponents/*, recuperacionComponents/*, user/*  
- [x] menuComponents/*, menuweb/*  
- [x] components/* transversales (Auth, Toast, TicketModal, ChatBot, etc.)  

### UseCases
- [x] 86 archivos en `/useCases` listados en Parte B  

---

# PARTE F — Equivalencia NewWapifood (solo referencia de cumplimiento)

| Bloque Front | ¿Cubierto en New? |
|--------------|-------------------|
| Auth + plan MP | Parcial/OK SaaS |
| Config local + código + delivery + theme | Parcial |
| Carta categorías/productos | Parcial |
| Inventario + PIN + kardex | Parcial |
| Recetas líneas | Parcial |
| Extras | **No** |
| Listas custom productos | **No** |
| Meseros CRUD + assign | Parcial |
| POS carrito/pago/notas | Parcial |
| Descuentos POS | **No** |
| Status ítem cocina | **En curso (SQL 023)** |
| Mesas Libre/Ocupado/NoDisponible | **En curso (023)** |
| Mesa 1 especial | Parcial |
| Web/delivery | Parcial |
| Tickets + PDF | Parcial |
| Pantallas listas | Parcial |
| Dashboard rangos | Parcial |
| masaProduction / ChatBot | **No (Fase 9 pausada)** |

---

## Cierre

Este dictamen **no omite pantallas del árbol de pages ni useCases del directorio `useCases/`**. Cualquier migración posterior debe trazarse a una fila de este documento. Si una función de New no puede mapearse aquí, **no está dictaminada como paridad**.

**Documento hermano:** `GAP-LOGICA-NEGOCIO-FRONT-VS-NEW.md` (brechas).  
**Documento hermano:** `COMPARATIVA-NEW-VS-FRONT.md` (UI/módulos/fases).

*Fin del dictamen.*
