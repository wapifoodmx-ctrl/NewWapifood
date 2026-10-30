# GAP de lógica de negocio — WapifoodFront vs NewWapifood

**Fecha:** 2026-10-29  
**Fuente de verdad de reglas:** `https://github.com/wapifoodmx-ctrl/WapifoodFront` (+ API `api.wapifood.com` vía useCases)  
**Destino:** `https://github.com/wapifoodmx-ctrl/NewWapifood`  

Este documento **no propone código todavía**. Solo describe **qué hace el Front en lógica de negocio**, qué tiene New, y **qué falta o está mal alineado** (sobre todo **estados de órdenes** y **mesas**).

---

## 1. Hallazgo central (por qué “los estatus no se sienten correctos”)

### 1.1 En WapifoodFront hay **dos capas de estado**

| Capa | Dónde vive | Valores reales en Front |
|------|------------|-------------------------|
| **Estado de la ORDEN** | API `order_status` / `cambio_estatus` | `Pendiente`, `Preparado` (en agrupaciones de cocina), `Finalizado`, `Cancelado` (+ flujos de cobro con método de pago) |
| **Estado del PRODUCTO dentro de la orden** | API `updateProductStatus` + UI cocina/carrito | `Pendiente`, `Preparado`, `Cancelado`, `Finalizado` |
| **Estado de la MESA** | API `tables/status` (`useCases/tablesStatus.js`) | `Libre`, `Ocupado`, `NoDisponible` |

### 1.2 En NewWapifood hay **casi solo una capa de orden**

| Capa | New | Valores actuales |
|------|-----|------------------|
| **Orden** | columna `orders.status` | `pendiente`, `abierta`, `cocina`, `lista`, `entregada`, `pagada`, `cancelada` |
| **Producto en orden** | `order_items` | **Sin status por ítem** (solo qty, precio, notes) |
| **Mesa** | `dining_tables.state` | `libre` / `ocupada` (no existe `NoDisponible`) |

**Conclusión:** New colapsó el modelo del Front. Cocina en Front trabaja **producto por producto**; New avanza la **orden entera**. Por eso se siente “incorrecto” al operar como el sistema viejo.

---

## 2. Máquina de estados del Front (reconstruida)

### 2.1 Producto en cocina (`updateProductStatus` + `modalCocina.jsx`)

```
Pendiente  ──marcar preparado──►  Preparado
    │                                │
    │ cancelar producto              │ regresar a cocina
    ▼                                ▼
Cancelado                        Pendiente

Preparado ──(cuando todos los no-cancelados están Preparado)──► comanda type=completed
```

Acciones de UI en `modalCocina.jsx`:
- Marcar producto **Preparado**
- **Cancelar producto** (línea)
- **Regresar a cocina** (Preparado → Pendiente)
- **Cancelar orden** completa
- **Finalizar** comanda completada (entrega / cierre operativo)
- Caso especial **Mesa 1 (POS)**: al “completar” puede **Finalizar orden** y disparar inventario (`postProcessOrder` / mermas)

### 2.2 Orden (API `cambio_estatus`)

Archivos clave:
- `useCases/cancelOrder.js` → `order_status=Cancelado`
- `useCases/endOrder.js` / `endPuntoDeVenta.js` → `order_status=Finalizado` + `metodo_pago`
- `useCases/endOrderPuntoDeVenta.js` → `cambio_estatus?order_status={status}&metodo_pago=...`

Flujo típico POS:
```
Crear/ampliar orden (OrderPntoVenta / createOrder)
  → productos salen Pendiente a cocina
  → cocina marca Preparado por ítem
  → cobro / finalización → Finalizado + método de pago
  → o Cancelado
```

### 2.3 Cocina agrupa comandas por “tipo” visual (`VistaCocina.jsx`)

No es un solo listado “cocina”:
- `pending` — con productos pendientes
- `completed` — todos los productos activos en Preparado
- `finished` — orden Finalizado
- `cancelled` — orden Cancelado
- mesas vacías / `NoDisponible`

Filtros de vista (`view`) y modales de detalle de mesa.

### 2.4 Mesas (`tablesStatus.js`)

```js
libre   → API "Libre"
ocupado → API "Ocupado"
otro    → API "NoDisponible"
```

Reglas de negocio asociadas en Front:
- Al abrir consumo / pedir en mesa → **Ocupado**
- Al cancelar/finalizar (según flujo) → **Libre**
- **NoDisponible**: mesa bloqueada manualmente (no se asigna)
- **Mesa 1 = Punto de venta**: reglas distintas en cocina (finalizar vs solo marcar preparado)
- Mesero solo ve / elige mesas según asignación + estado Libre/Ocupado

### 2.5 Canales y reglas que el Front codifica

| Canal | Comportamiento Front |
|-------|----------------------|
| POS (`/puntodeventa`) | Mesa (incl. 1), carrito, descuentos línea/orden, comentarios, envío cocina, cobro, cancelación, tickets |
| Cocina | Estados por **producto**, modales, liberar mesa, web orders, delivery info |
| Mesero | Login código, selección mesa, carrito propio, estados de ítems visibles, vínculo orden-mesero |
| Client menu / webmenu | Mesa + código confirmación, carrito, a veces pago modal; web puede ser “externo” |
| Kiosko | Orden propia sin mesero |
| Tickets | Listado, modal, PDF, cancelados, vista externa |
| Inventario | Mermas al procesar; PIN; kardex |
| Dashboard | Stats, pedidos pendientes, populares, gráficas |

---

## 3. Qué hace New hoy (mapa resumido de lógica)

| Tema | Implementación New | ¿Alineado a Front? |
|------|--------------------|--------------------|
| Estado orden | `pendiente/abierta/cocina/lista/entregada/pagada/cancelada` | **Parcial** — nombres y semántica distintos |
| Estado ítem | No existe | **NO** |
| Mesa libre/ocupada | Sí al abrir/cerrar/cancelar orden | **Parcial** — falta `NoDisponible` |
| Mesa 1 = caja | `channel_type=caja` | **Parcial** — no todas las reglas especiales de cocina Mesa 1 |
| Cocina | Cambia status de **orden** completa | **NO** equivalente a Front |
| POS cobro | `close_order` → `pagada` + stock | Parcial (Front: Finalizado + método) |
| Cancelar orden | `cancel_order` → `cancelada` + libera mesa | Parcial |
| Web/domicilio pendiente | `pendiente` + confirm | Parcial (OK idea, distinto naming) |
| Mesero | Código + mesas + source=mesero + waiter_id (022) | Parcial |
| Descuentos POS | No | **NO** |
| Cancelar solo un producto en cocina | No | **NO** |
| Regresar producto a pendiente | No | **NO** |
| Comanda “completed” vs “finished” | No | **NO** |

---

## 4. Matriz de gaps de LÓGICA (prioridad)

### P0 — Bloqueantes para que “se sienta Wapifood”

1. **Status por línea de orden (`order_items.status`)**  
   Valores sugeridos alineados al Front: `pendiente | preparado | cancelado` (y opcional `finalizado` si se requiere).  
   Sin esto, cocina no puede operar como `modalCocina`.

2. **Transiciones de cocina al estilo Front**  
   - Marcar ítem preparado  
   - Cancelar ítem  
   - Undo ítem a pendiente  
   - Cuando todos los ítems activos están `preparado` → la orden pasa a un estado tipo “listo/completado”  
   - Finalizar entrega / cobro según canal  

3. **Semántica de estados de ORDEN alineada** (mapa propuesto)

| Front (orden) | New actual | Propuesta de convergencia |
|---------------|------------|---------------------------|
| (nueva / en curso con ítems pendientes) | `abierta` / `cocina` | `en_curso` o mantener `cocina` mientras haya ítems pendientes |
| Comanda con todos Preparado | (no existe; New usa `lista`) | `lista` = “Preparado a nivel comanda” |
| Finalizado (cobrada/cerrada) | `pagada` | OK si se documenta equivalencia Finalizado↔pagada |
| Cancelado | `cancelada` | OK |
| Pendiente (web/confirmación) | `pendiente` | OK |
| — | `entregada` | Extra New; Front a veces fusiona con finalizado |

4. **Mesas: tres estados**  
   `libre | ocupada | no_disponible`  
   - No asignar pedidos a `no_disponible`  
   - UI para marcar no disponible / liberar (Front tiene modal de liberación)

5. **Mesa caja (Mesa 1)**  
   En Front, cocina trata Mesa 1 distinto (finalizar orden + inventario).  
   New debe: al completar cocina de caja, o bien solo marcar lista y dejar cobro en POS, o permitir “finalizar” con las mismas garantías de stock que `close_order`.

### P1 — Importante para paridad operativa

6. **Ampliar orden existente en mesa (re-order)**  
   Front: `order_uuid` opcional en `OrderPntoVenta` para pedidos adicionales a la misma cuenta.  
   New: suma ítems a orden abierta (parcialmente sí en POS) — verificar todos los canales.

7. **Descuentos**  
   Por producto y por orden (`descuento`, `descuento_details` en Front). New: no hay.

8. **Método de pago en cambio de estatus**  
   Front envía `metodo_pago` al finalizar. New lo tiene en `close_order` — OK si siempre se persiste y muestra en tickets.

9. **Liberación explícita de mesa**  
   Aunque no haya cancelación formal, Front puede liberar mesa `NoDisponible`→`Libre`.

10. **Cancelación parcial vs total**  
    Front cancela productos o la orden. New solo orden completa.

11. **Web orders / delivery**  
    Front: `getOrdersWebMenu`, `createwebExternalOrder`, `externalOrderDelivery`, info delivery en cocina.  
    New: `order_type=domicilio` + pendiente — falta cola dedicada “encargos” y datos de delivery siempre visibles en cocina (parcial en Fase 5).

12. **Inventario al finalizar**  
    Front: `postProcessOrder` / mermas ligadas al cierre.  
    New: stock en `close_order` por receta — verificar que **no** descuente al solo marcar `lista`.

### P2 — Paridad amplia (no bloquea MVP operativo si P0/P1 están)

13. Descuentos y propinas  
14. PDF nativo tickets (hoy print HTML)  
15. Extras/modificadores de recetas  
16. PIN inventario (ya hay base Fase 3)  
17. ChatBot / masaProduction / comentarios sociales  
18. Multi-imagen producto  
19. Exportes dashboard  

---

## 5. Inventario componente a componente (Front → lógica → New)

Leyenda: **OK** / **PARCIAL** / **FALTA**

### Auth y SaaS
| Front | Lógica | New |
|-------|--------|-----|
| login / createUser / token | Sesión API | PARCIAL (Supabase; distinta) |
| resetLink / resetpass | Recovery | PARCIAL |
| payments / success / error / checkPayment | Plan activo gate | PARCIAL (MP webhook) |

### User / config
| Front userpage | Lógica | New /config |
|----------------|--------|-------------|
| patchUserInfo | Datos local | PARCIAL |
| código confirmación | Gate menú | OK |
| delivery on/off | Gate domicilio | PARCIAL |
| colores menú | Theme | PARCIAL |

### Dashboard
| Front | Lógica | New |
|-------|--------|-----|
| mainStats / ventas / pedidos / populares | KPIs | PARCIAL (Fase 8 rangos) |
| pedidos pendientes | Alerta operativa | PARCIAL |

### Menu admin
| Front /menu | Lógica | New /carta |
|-------------|--------|------------|
| categorías + productos + status activo | Catálogo | PARCIAL (Fase 2) |
| listas productos | Listas especiales | FALTA |

### Inventarios
| Front | Lógica | New |
|-------|--------|-----|
| ingredientes, mermas, entradas | Stock | PARCIAL (Fase 3) |
| PIN | Gate | PARCIAL |
| kardex | Movimientos | PARCIAL |
| descuento stock al finalizar orden | Cierre | PARCIAL (`close_order`) |

### Recetas / extras
| Front | Lógica | New |
|-------|--------|-----|
| recipe lines | Consumo | PARCIAL |
| extras | Modificadores | FALTA |

### Meseros admin
| Front | Lógica | New |
|-------|--------|-----|
| CRUD + asignación mesas | Staff piso | PARCIAL |
| vincularMeseroOrden | Trazabilidad | PARCIAL (SQL 022) |

### POS
| Front puntodeventa | Lógica | New /pos |
|--------------------|--------|----------|
| mesas + estados | Ocupar/liberar | PARCIAL — falta NoDisponible |
| carrito modal | Ítems | PARCIAL (Fase 4) |
| descuentos | Precio | FALTA |
| comentarios | Notas | PARCIAL (notes ítem) |
| envío cocina | Status ítems Pendiente | PARCIAL — New mueve orden a `cocina` |
| cobro / Finalizado | Cierre | PARCIAL (`pagada`) |
| cancelar orden | Cancelado + mesa Libre | PARCIAL |

### Cocina
| Front VistaCocina + modalCocina | Lógica | New /cocina |
|--------------------------------|--------|-------------|
| columnas pending/completed/finished/cancelled | Colas | FALTA (solo lista plana por status orden) |
| status por producto | Motor real | **FALTA** |
| Mesa 1 especial | Finalizar + stock | FALTA |
| liberar mesa | Libre | PARCIAL |
| web + delivery en vista | Encargos | PARCIAL |

### Tickets
| Front | Lógica | New |
|-------|--------|-----|
| listado + modal + PDF | Post-venta | PARCIAL |
| cancelados | Filtro | PARCIAL |
| externa | Seguimiento | PARCIAL (`/t` beeper) |

### Menú cliente / web / kiosko / mesero
| Front | Lógica | New |
|-------|--------|-----|
| modales detalle/carrito/mesa/código | UX pedido | PARCIAL (Fase 6) |
| estados ítem en carrito mesero | Feedback cocina | FALTA |
| kiosko post order | Canal | PARCIAL |
| web external + delivery | Encargos | PARCIAL |

### Pantallas / masa / chatbot
| Front | New |
|-------|-----|
| pantallas hub | PARCIAL |
| masaProduction | FALTA (Fase 9 pausada) |
| ChatBot | FALTA (Fase 9 pausada) |

---

## 6. Fallas concretas observadas en lógica de MESAS (New vs Front)

1. **Solo 2 estados** (`libre`/`ocupada`) vs 3 del Front (`Libre`/`Ocupado`/`NoDisponible`).  
2. **No hay gestión de “No disponible”** (bloqueo manual de mesa).  
3. **Ocupación** depende de existencia de orden abierta; Front también consulta `table_status` del API como fuente.  
4. **Liberación** en New está acoplada a `cancel_order` / `close_order`; Front también libera en flujos de cocina al finalizar/cancelar y en modal de release.  
5. **Mesa 1 / caja**: Front hardcodea reglas; New usa `channel_type` pero cocina no replica el branch Mesa 1.  
6. **Mesero**: Front filtra mesas por estado en modal de selección; New lista asignadas sin `NoDisponible`.  
7. **Multi-orden por mesa**: Front trabaja mucho con “última orden por mesa” (`getLastOrderByTable`); New asume una orden abierta por mesa — hay que validar invariante y errores si hay dos.

---

## 7. Fallas concretas en lógica de ESTADOS DE ORDEN

1. New no puede marcar **medio plato preparado y medio pendiente** (todo es status de orden).  
2. `lista` en New ≈ “comanda preparada”, pero se setea **a mano a nivel orden**, no por agregación de ítems.  
3. `entregada` no existe como concepto fuerte en Front (suele ser Finalizado).  
4. `abierta` en POS New no tiene equivalente claro en API vieja (allí la orden ya existe y los ítems están Pendiente).  
5. Cancelar en cocina un solo producto **no existe** en New.  
6. Tickets/beeper muestran status de orden New; el cliente del Front veía Preparado/Cancelado por ítem en carrito.

---

## 8. Orden de corrección recomendado (solo lógica; sin Fase 9)

### Bloque L1 — Modelo de estados (DB + RPC)
- [x] `order_items.status` + defaults `pendiente` — SQL 023
- [x] RPC set_order_item_status / recompute / mark all / send kitchen — SQL 023
- [x] Mapear `pagada` ↔ Finalizado, `cancelada` ↔ Cancelado — orderStatus.js
- [x] `dining_tables.state` incluir `no_disponible` — SQL 023

### Bloque L2 — Cocina alineada a Front
- [x] UI por ítem (preparado / cancelar / undo) — patch 0032
- [x] Colas: por preparar / preparados / todos — patch 0032
- [x] Regla visual Caja — patch 0032
- [x] Liberar mesa vía cancel_order / recompute — SQL 023

### Bloque L3 — POS / mesas
- [x] 1 orden abierta por mesa (openTable existing) — ya
- [x] Marcar no disponible — patch 0032
- [x] Ampliar orden = mismos order_id — ya POS
- [ ] Descuentos (si se requieren ya)

### Bloque L4 — Canales
- [ ] Mesero ve status ítems de sus mesas
- [ ] Web/domicilio cola encargos
- [ ] Beeper opcionalmente resume ítems preparados

### Bloque L5 — Cierre y stock
- [x] Stock solo en close_order (pagada); preparar ítem no descuenta — sin cambio de close_order
- [x] Cancelar ítem no llama close_order — SQL 023

---

## 9. Checklist de aceptación (cuando la lógica esté bien)

- [ ] Cocina puede marcar **un solo producto** Preparado sin cerrar la orden  
- [ ] Orden pasa a “lista/completada” solo cuando **todos** los ítems no cancelados están Preparado  
- [ ] Se puede cancelar un producto y seguir con el resto  
- [ ] Mesa queda Ocupada con orden activa y Libre al cancelar/finalizar  
- [ ] Mesa NoDisponible no aparece como seleccionable en menú/mesero  
- [ ] Caja (mesa 1) respeta regla especial de finalización  
- [ ] Cobro POS deja orden Finalizada/pagada y descuenta inventario por receta  
- [ ] Web/domicilio entra Pendiente y no cocina hasta confirmar  
- [ ] Mesero ve activas/historial coherente con estados reales  

---

## 10. Relación con el documento de migración UX

- `COMPARATIVA-NEW-VS-FRONT.md` — módulos, UI, modales, fases 0–8 de features.  
- **Este archivo** — **reglas de negocio y estados**; manda sobre la comparativa cuando hay conflicto de semántica.  

**No se debe seguir solo “pintando pantallas” sin cerrar L1–L3**; si no, los estatus seguirán sintiéndose rotos aunque la UI se parezca.

---

## 11. Repos de referencia

| Repo | Uso |
|------|-----|
| WapifoodFront | UI + orquestación de estados (este análisis) |
| ApiWapifood / api.wapifood.com | Contrato real de `cambio_estatus`, `tables/status`, product status |
| NewWapifood | Destino; corregir modelo antes de más features Fase 9 |

---

*Documento generado tras revisión dirigida de useCases de órdenes/mesas, VistaCocina, modalCocina, POS (Carrito/Pago), y contrastado con el esquema de estados actual de NewWapifood.*
