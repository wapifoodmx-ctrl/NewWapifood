# Planes Wapifood

Fecha: 10 de noviembre de 2026. Hugo aprobó estos nombres y que el precio de varios locales es el **total del grupo**, no un precio por sucursal. Cada local conserva los topes de mesas y meseros de su nivel.

El anual paga 10 meses (2 meses gratis) y dura 365 días. Precios en MXN.

## Un local

| Nombre | Id | Al mes | Al año | Mesas | Meseros | Locales |
|---|---|---:|---:|---:|---:|---:|
| Brasa | `brasa` | 300 | 3,000 | 5 | 3 | 1 |
| Comal | `comal` | 500 | 5,000 | 15 | 7 | 1 |
| Fogón | `fogon` | 800 | 8,000 | 25 | 15 | 1 |

## Varios locales

| Nombre | Id | Al mes | Al año | Mesas por local | Meseros por local | Locales |
|---|---|---:|---:|---:|---:|---:|
| Brasas | `brasas` | 500 | 5,000 | 5 | 3 | 3 |
| Comales | `comales` | 800 | 8,000 | 15 | 7 | 5 |
| Fogones | `fogones` | 1,000 | 10,000 | 25 | 15 | 8 |

## Mapeo de planes viejos

No se reescriben filas ya pagadas. El monto histórico se queda. El próximo cobro usa el precio nuevo. Los topes nuevos son iguales o más altos, así que nadie pierde mesas ni meseros.

| Lo que ya está guardado | Se lee como |
|---|---|
| `ventas`, `esencial` | Brasa |
| `restaurante`, `profesional` | Comal |
| `plus`, `empresarial` | Fogón |
| `ventas_multi`, `cadena` | Brasas |
| `restaurante_multi`, `franquicia` | Comales |
| `plus_multi`, `corporativo` | Fogones |

Los cobros nuevos guardan el id nuevo (`brasa`, `comal`, `fogon`, `brasas`, `comales`, `fogones`). Un pago que todavía traiga el id viejo también se acepta y se guarda ya con el id nuevo.

## Dónde vive

- Precios y nombres: [src/lib/plans.js](../src/lib/plans.js)
- Cobro: checkout de Mercado Pago, mensual o anual
- Activación: el webhook llama `activate_plan` con la service role. La firma no cambió
- Topes: `restaurant_caps` y el trigger `enforce_plan_caps`
- Migración de precios: `supabase/migrations/20261110043000_planes_brasa.sql`
- Migración de sucursales: `supabase/migrations/20261110052000_sucursales.sql`

## Subir o bajar de plan

Pagar otro plan deja una suscripción nueva y marca la anterior como `replaced`. No se borran mesas, meseros ni locales. Si ya hay más de los que permite el plan nuevo, no se pueden dar de alta más hasta quitar los que sobran.

El tope de locales se cuenta por grupo, no por persona. La suscripción del local que cobra cubre a los demás. El selector está en el pie del menú. Copiar el menú y el reporte de todos los locales están en Configuración y Reportes.

## Qué no se tocó

- Quien ya paga conserva el monto de esa fila.
- El trial de una cuenta nueva queda en Brasa, 14 días, sin cobro.
- Sin plan vigente no se pueden dar de alta mesas de piso ni meseros. Así ya estaba.
