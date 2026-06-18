# 🔥 Forge

Tracker de entrenamiento con gamificación. **React + Vite** (estático, GitHub Pages) ·
**Supabase** (Postgres + Auth + RLS) · **Edge Function** que hace de proxy a la API de Claude.

Multiusuario desde el día uno: cada usuario ve solo sus datos (Row Level Security).
El split, la nutrición y los suplementos del plan vienen como **preset global** que
cualquier usuario puede adoptar; tus datos personales se cargan con un **seed**.

---

## Arquitectura

```
React (Vite, static)  ──►  GitHub Pages           (base /forge/)
        │
        ├── Supabase Postgres + Auth + RLS         (datos)
        │
        └── Edge Function "coach"  ──►  API de Claude
                    (ANTHROPIC_API_KEY vive SOLO acá)
```

**Seguridad:**
- La API key de Claude va **solo** en la Edge Function, como secreto de entorno. Nunca en el front ni en el repo.
- `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` **sí** van en el frontend (son públicas por diseño). La protección real son las políticas **RLS**.
- La `service_role` key solo se usa en tu terminal para correr el seed. Nunca se commitea.

---

## 1. Requisitos

- Node 20+ y npm
- Una cuenta de [Supabase](https://supabase.com) (plan free alcanza)
- Una API key de [Claude](https://console.anthropic.com) para el coach
- (Opcional) [Supabase CLI](https://supabase.com/docs/guides/cli) para desplegar la Edge Function

---

## 2. Crear el proyecto de Supabase

1. En [supabase.com](https://supabase.com) → **New project**. Anotá la contraseña de la DB.
2. Cuando termine, andá a **Project Settings → API** y copiá:
   - **Project URL** → `VITE_SUPABASE_URL`
   - **anon public** → `VITE_SUPABASE_ANON_KEY`
   - **service_role** (¡secreta!) → para el seed más abajo

---

## 3. Correr las migraciones (schema + RLS + seed global)

Las migraciones están en [`supabase/migrations/`](supabase/migrations/). Corrélas **en orden**.

**Opción A — SQL Editor (la más simple):** abrí Supabase → **SQL Editor** y pegá/ejecutá,
uno por uno y en orden:

1. `0001_init.sql` — tablas, tipos, triggers
2. `0002_rls.sql` — Row Level Security
3. `0003_seed_global.sql` — ejercicios, programa preset, badges (datos globales, sin datos personales)

**Opción B — Supabase CLI:**

```bash
supabase link --project-ref TU_REF      # el ref está en la URL del proyecto
supabase db push                        # aplica supabase/migrations/*
```

> El trigger `on_auth_user_created` crea automáticamente una fila en `profiles`
> cada vez que alguien se registra.

---

## 4. Configurar el frontend y correr local

```bash
cp .env.example .env
# editá .env con tu VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY
npm install
npm run dev
```

Abrí http://localhost:5173, **registrate** con tu email y contraseña.

---

## 5. Seedear MI cuenta (Ivan)

Los usuarios de Auth se crean al registrarse, así que el seed se corre **después** de
que te registres, atando tus datos a tu `user_id`.

1. Registrate en la app (paso 4).
2. En Supabase → **Authentication → Users**, copiá tu **User UID**.
3. Creá el archivo de credenciales del seed:

   ```bash
   cp scripts/.env.seed.example scripts/.env.seed
   # completá SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY
   ```

4. Corré el seed con tu UID:

   ```bash
   npm run seed -- TU_USER_UID
   ```

Esto carga tu perfil, programa activo (el preset), suplementos con su metadata,
comidas del quick-add, metas (proteína 145 g, pasos, sueño) y arranca la ventana
**muscle memory** de 90 días. Tu cuenta queda con `onboarded = true`, así que se
saltea el onboarding.

> Un usuario nuevo cualquiera **no** corre este seed: arranca vacío y pasa por el
> onboarding mínimo (objetivo, equipo, días, programa).

---

## 6. Desplegar la Edge Function del coach

Necesitás la [Supabase CLI](https://supabase.com/docs/guides/cli).

```bash
supabase link --project-ref TU_REF
supabase functions deploy coach
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...        # tu key de Claude
supabase secrets set CLAUDE_MODEL=claude-sonnet-4-6      # opcional (default)
```

La función verifica el JWT del usuario, arma el prompt con tus datos recientes y
llama a Claude. El modelo también se puede elegir desde la pantalla del Coach.

---

## 7. Desplegar a GitHub Pages

El workflow [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) buildea y
publica en cada push a `main`.

1. En el repo de GitHub → **Settings → Pages → Build and deployment → Source:** elegí **GitHub Actions**.
2. En **Settings → Secrets and variables → Actions → Variables**, agregá (como *Variables*, no secrets):
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
3. Push a `main`. La Action buildea con esas variables y deja la app en:

   ```
   https://ivanmontenegror.github.io/forge/
   ```

> El `base` de Vite ya está en `/forge/`. Si cambiás el nombre del repo, actualizá
> `base` en [`vite.config.js`](vite.config.js) o pasá `VITE_BASE` al build.

---

## Estructura

```
src/
  pages/        Today (dashboard), Workout (logger), Progress, Metrics,
                Nutrition, Supplements, Sleep, Cardio, Coach, Achievements,
                Profile, Auth, Onboarding, SetupScreen
  components/   Layout, ui (Card, Ring, Stepper, ProgressBar…)
  context/      AuthContext, ToastContext
  data/         db (acceso Supabase), hooks (React Query), awards
                (XP/badges/quests), bootstrap (filas base)
  lib/          supabase, gamification (niveles/XP), dates
supabase/
  migrations/   0001_init, 0002_rls, 0003_seed_global
  functions/    coach/index.ts  (proxy a Claude)
scripts/
  seed-ivan.mjs Seed de mi cuenta (recibe user_id + service_role)
```

## Modelo de datos (resumen)

- **Global:** `exercises`, `programs`, `program_days`, `program_day_exercises`, `badges`.
- **Por usuario:** `profiles`, `user_foods`, `user_supplements`, `sessions`, `set_logs`,
  `body_metrics`, `nutrition_logs`, `supplement_logs`, `sleep_logs`, `cardio_logs`,
  `xp_events`, `streaks`, `user_badges`, `weekly_quests`.

Todo lo "por usuario" tiene RLS `user_id = auth.uid()` (o `id = auth.uid()` en `profiles`).
Lo global es de solo lectura para usuarios autenticados.

## Gamificación

- **XP** por acciones reales (sesión, PR, proteína, suplementos, sueño, pasos, métricas, descanso).
- **Niveles y rangos** (Novato → Leyenda).
- **Rachas** que respetan el split (la de entreno cuenta días *programados*) + un "perdón" por racha.
- **Muscle Memory**: 90 días con multiplicador de XP x1.5.
- **Misiones semanales** y **badges** por hitos. Se premia consistencia y recuperación, nunca sobreentrenar.
