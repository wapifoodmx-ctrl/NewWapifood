# NewWapifood

Refactor del SaaS **Comanadas / Wapifood** (Front + Api + microservicio inventarios) sobre **Next.js 16 + Supabase**.

## Qué ya está migrado (bloque 1)

| Legacy | Nueva ruta | Estado |
|---|---|---|
| `pages/index.js` landing | `/` | live |
| `pages/login.js` | `/login` | live (Supabase Auth) |
| `pages/dashboard.js` | `/dashboard` | live |
| `pages/puntodeventa.js` | `/pos` | live |
| `pages/cocina.js` | `/cocina` | live |
| `pages/menu.js` | `/carta` | live |
| `pages/inventarios.js` + microservicio | `/insumos` | live |
| `pages/recetas.js` | `/recetas` | live |
| `pages/meseros.js` | `/meseros` | live (necesita SQL 004) |
| `pages/clientmenu.js` | `/menu` | live parcial |
| payments, user, tickets, pantallas, kiosko | rutas shell | siguiente bloque |

## Setup

```bash
npm install
cp .env.example .env.local
# URL + anon + service_role
npm run db:seed
# opcional: npm run db:seed -- --owner=UUID_DE_TU_USUARIO
npm run dev
```

## SQL en Supabase

1. `001` schema base (ya corrido)
2. `supabase/004_schema_saas_completo.sql` — meseros, web_orders, suscripciones, etc.
3. Seed por `npm run db:seed` (recomendado) o `002_seed_demo.sql`

## Seguridad

- RLS por `restaurant_id` + memberships
- Cobro e inventario solo vía `close_order`
- `service_role` solo en `.env.local`, nunca `NEXT_PUBLIC_`
