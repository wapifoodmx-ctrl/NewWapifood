# Deploy de NewWapifood

Producción hoy: Vercel `new-wapifood` y Supabase `bdimvrykjcvccbjczqkh` (plan free). Las variables de Vercel Production ya existen. Preview de Vercel no tiene ninguna: el build no las exige.

## 1. Secrets de GitHub (los crea Hugo)

En el repo, Settings → Secrets and variables → Actions. Nombres exactos, sin otros:

| Secret | Qué es |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | Token personal de Supabase (Account → Access Tokens) |
| `SUPABASE_DB_PASSWORD` | Contraseña de la base del proyecto |
| `SUPABASE_PROJECT_ID` | `bdimvrykjcvccbjczqkh` |

No están en Vercel. El workflow `.github/workflows/supabase-deploy.yml` los usa solo en GitHub Actions.

## 2. Historial

`20261103230000` y `20261103231000` ya están aplicadas en producción. El workflow, después de `supabase link`, corre `supabase db push --remote` sin repetir el id del proyecto: en CLI 3 `--remote` sin valor usa el proyecto enlazado. `db push` sin esa opción es solo local.

En una máquina con el CLI, el repo de este PR y los tres secrets:

```bash
npx supabase link --project-ref bdimvrykjcvccbjczqkh --yes
npx supabase migration repair --status applied 20261103230000 --remote -p "$SUPABASE_DB_PASSWORD"
```

CLI 3: el push remoto usa `--remote` y `-p`. El workflow hace lo mismo con los secrets.

Eso solo escribe el historial. No corre el SQL. Confirma con `npx supabase migration list`.

Después, el push a `main` aplica únicamente `20261103231000_security_indexes_extras.sql` (grants, índices, adicionales, firma única de las RPC).

El job de deploy aborta si la baseline no está marcada.

## 3. Qué no se autoejecuta

`supabase/legacy/` son los SQL sueltos 002–034 que ya se corrieron a mano. El CLI solo lee `supabase/migrations/`.

Nunca pases a `migrations/`:

- `002_seed_demo.sql`
- `012_wipe_all_data.sql`

## 4. Vercel

Production ya tiene las variables de Supabase y Mercado Pago. No hace falta `NEXT_PUBLIC_SITE_URL`: el retorno de Mercado Pago sale del origen de la petición.

Preview no tiene env. El build debe pasar igual; el preview no opera contra la base.

## 5. Orden seguro

1. Merge del PR (el código deja de llamar `activate_plan` desde el browser).
2. `migration repair` de la baseline, si aún no se hizo.
3. Push a `main` (o re-run del workflow) para el `db push` de la migración de seguridad.
4. Hasta ese `db push`, `activate_plan` sigue ejecutable por un usuario autenticado si alguien llama la RPC a mano. El botón “Activar sin pago” ya no está en la UI.
