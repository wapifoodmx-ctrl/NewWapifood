# MVP Auth + Landing + Dashboard

## 1. SQL (una sola vez, equipo técnico)

En Supabase SQL Editor ejecuta si aún no está:

- Schema base (001) — tablas + RLS + `close_order`
- `supabase/005_auto_onboarding.sql` — crea restaurante solo al entrar

## 2. Correos bonitos

Sigue `email-templates/README.md` (Confirm signup + Reset password).

## 3. Redirect URLs

Authentication → URL configuration → agrega `/auth/callback`.

## 4. App

```bash
npm install
cp .env.example .env.local
# NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY
npm run dev
```

El cliente solo: crear cuenta → confirmar correo → entrar → panel listo.
