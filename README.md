# NewWapifood

SaaS de operación para restaurantes. Refactor de:

- `WapifoodFront` (Next.js UI + Capacitor)
- `ApiWapifood` (FastAPI)
- `microServicioWapiFood` (inventarios)

Stack objetivo: **Next.js 16 + Supabase (Auth, Postgres, RLS, Realtime) + Capacitor**.

## Setup rápido

```bash
npm install
cp .env.example .env.local
# llena NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

## Base de datos

1. Ya corriste `001` (schema + RLS + `close_order`).
2. Ejecuta en SQL Editor: `supabase/002_seed_demo.sql`
3. Crea un usuario en Authentication.
4. Ejecuta `supabase/003_bootstrap_owner.sql` con el UUID de ese usuario.

Sin membership, RLS no deja ver filas (es correcto).

## Migración sin perder funcionalidad

Ver `src/lib/modules.js`: mapa completo de módulos legacy → rutas nuevas.
Orden: auth → carta/insumos → POS/cocina → menú cliente → pagos → Capacitor.

## Seguridad

- Nunca subas `service_role` al cliente.
- Todo dato de negocio cuelga de `restaurant_id` + RLS.
- Cobrar solo vía `close_order` (descuento de stock atómico).
