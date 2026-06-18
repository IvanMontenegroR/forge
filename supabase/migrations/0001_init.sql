-- ============================================================
-- Forge — schema inicial
-- Separa datos GLOBALES (biblioteca de ejercicios, programas
-- plantilla, catálogo de badges) de datos POR USUARIO.
-- RLS se define en 0002_rls.sql.
-- ============================================================

create extension if not exists "pgcrypto";

-- ─────────────── ENUMS ───────────────
do $$ begin
  create type session_status as enum ('active', 'completed', 'skipped');
exception when duplicate_object then null; end $$;

do $$ begin
  create type cardio_type as enum ('hiit', 'walk', 'steps', 'other');
exception when duplicate_object then null; end $$;

do $$ begin
  create type streak_kind as enum ('workout', 'creatine', 'steps', 'protein');
exception when duplicate_object then null; end $$;

-- ============================================================
-- GLOBAL: biblioteca de ejercicios
-- ============================================================
create table if not exists public.exercises (
  id           uuid primary key default gen_random_uuid(),
  slug         text unique not null,
  name         text not null,
  muscle_group text not null,          -- pecho, espalda, hombros, biceps, ...
  equipment    text not null default 'mancuernas',
  is_unilateral boolean not null default false,
  instructions text,
  created_at   timestamptz not null default now()
);

-- ============================================================
-- GLOBAL: programas (plantillas) y sus días
-- ============================================================
create table if not exists public.programs (
  id            uuid primary key default gen_random_uuid(),
  slug          text unique not null,
  name          text not null,
  description   text,
  days_per_week int not null default 3,
  is_preset     boolean not null default true,
  created_by    uuid references auth.users(id) on delete set null,  -- null = global
  created_at    timestamptz not null default now()
);

create table if not exists public.program_days (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  order_index int not null,                 -- orden dentro del programa
  weekday     int,                           -- 1=lun .. 7=dom (null = flexible)
  name        text not null,                 -- "Torso", "Piernas + Core"...
  focus       text,                          -- breve descripción
  is_optional boolean not null default false,
  notes       text,
  unique (program_id, order_index)
);

create table if not exists public.program_day_exercises (
  id             uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days(id) on delete cascade,
  exercise_id    uuid not null references public.exercises(id) on delete restrict,
  order_index    int not null,
  target_sets    int not null default 3,
  rep_low        int not null default 8,
  rep_high       int not null default 12,
  per_side       boolean not null default false,
  notes          text,
  unique (program_day_id, order_index)
);

-- ============================================================
-- POR USUARIO: perfil (1:1 con auth.users)
-- Las constantes personales son campos configurables, no
-- valores fijos en el código.
-- ============================================================
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  full_name           text,
  age                 int,
  height_cm           numeric,
  start_weight_kg     numeric,
  goal                text,                        -- recomp, bulk, cut...
  goal_notes          text,
  equipment           jsonb not null default '[]'::jsonb,
  training_weekdays   int[] not null default '{1,2,5}',   -- lun, mar, vie
  optional_weekdays   int[] not null default '{7}',       -- dom opcional
  -- nutrición (protein-first)
  protein_goal_g      int not null default 145,
  maintenance_kcal    int,
  target_kcal         int,
  -- cardio
  step_goal           int not null default 9000,
  hiit_per_week       int not null default 2,
  -- sueño
  sleep_goal_hours    numeric not null default 8,
  caffeine_cutoff_hour int not null default 14,
  -- programa activo
  active_program_id   uuid references public.programs(id) on delete set null,
  -- ventana muscle memory
  muscle_memory_start date,
  muscle_memory_days  int not null default 90,
  -- gamificación
  xp                  int not null default 0,
  -- estado
  onboarded           boolean not null default false,
  photo_reminder_days int not null default 14,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- comidas de quick-add por usuario (gramos de proteína por porción)
create table if not exists public.user_foods (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  protein_g   numeric not null default 0,
  kcal        numeric,
  serving     text,                       -- "1 huevo", "100 g", "1 scoop"
  sort_order  int not null default 0,
  created_at  timestamptz not null default now()
);

-- suplementos configurados por usuario + metadata para recordatorios
create table if not exists public.user_supplements (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  dose            text,                    -- "5 g", "2000 IU"
  timing          text,                    -- "con comida", "antes de dormir"
  schedule        text not null default 'daily',  -- daily | training_days
  active          boolean not null default true,
  is_optional     boolean not null default false,
  loading_phase   boolean not null default false, -- creatina: fase de carga on/off
  cutoff_hour     int,                     -- ej. lipo6 nunca después de 16h
  track_streak    boolean not null default false, -- creatina: racha aparte
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- POR USUARIO: entrenamiento
-- ============================================================
create table if not exists public.sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  program_day_id  uuid references public.program_days(id) on delete set null,
  date            date not null default current_date,
  title           text,
  status          session_status not null default 'active',
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  total_volume_kg numeric not null default 0,
  notes           text
);
create index if not exists idx_sessions_user_date on public.sessions(user_id, date desc);

create table if not exists public.set_logs (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references public.sessions(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number  int not null,
  weight_kg   numeric not null default 0,
  reps        int not null default 0,
  is_warmup   boolean not null default false,
  rir         int,                         -- reps in reserve
  done        boolean not null default true,
  created_at  timestamptz not null default now()
);
create index if not exists idx_setlogs_user_ex on public.set_logs(user_id, exercise_id, created_at desc);
create index if not exists idx_setlogs_session on public.set_logs(session_id);

-- ============================================================
-- POR USUARIO: métricas y hábitos
-- ============================================================
create table if not exists public.body_metrics (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null default current_date,
  weight_kg  numeric,
  waist_cm   numeric,
  arm_cm     numeric,
  notes      text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.nutrition_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  date        date not null default current_date,
  food_id     uuid references public.user_foods(id) on delete set null,
  name        text not null,
  protein_g   numeric not null default 0,
  kcal        numeric,
  qty         numeric not null default 1,
  created_at  timestamptz not null default now()
);
create index if not exists idx_nutrition_user_date on public.nutrition_logs(user_id, date);

create table if not exists public.supplement_logs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users(id) on delete cascade,
  user_supplement_id uuid not null references public.user_supplements(id) on delete cascade,
  date               date not null default current_date,
  taken              boolean not null default true,
  taken_at           timestamptz not null default now(),
  unique (user_supplement_id, date)
);
create index if not exists idx_supplog_user_date on public.supplement_logs(user_id, date);

create table if not exists public.sleep_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  date       date not null default current_date,
  hours      numeric,
  quality    int,                          -- 1..5
  notes      text,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

create table if not exists public.cardio_logs (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  date         date not null default current_date,
  type         cardio_type not null default 'steps',
  duration_min int,
  steps        int,
  distance_km  numeric,
  notes        text,
  created_at   timestamptz not null default now()
);
create index if not exists idx_cardio_user_date on public.cardio_logs(user_id, date);

-- ============================================================
-- POR USUARIO: gamificación
-- ============================================================
create table if not exists public.xp_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,               -- session_complete, pr, protein_goal...
  xp          int not null,
  multiplier  numeric not null default 1,
  description text,
  ref_date    date not null default current_date,
  created_at  timestamptz not null default now()
);
create index if not exists idx_xp_user on public.xp_events(user_id, created_at desc);

create table if not exists public.streaks (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  kind            streak_kind not null,
  current_count   int not null default 0,
  longest_count   int not null default 0,
  last_date       date,
  freeze_available boolean not null default true,  -- "un perdón" por racha
  freeze_used_on  date,
  unique (user_id, kind)
);

-- catálogo GLOBAL de badges
create table if not exists public.badges (
  id          uuid primary key default gen_random_uuid(),
  code        text unique not null,
  name        text not null,
  description text not null,
  icon        text not null default 'medal',
  category    text not null default 'general',
  xp_reward   int not null default 0,
  sort_order  int not null default 0
);

create table if not exists public.user_badges (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  badge_id  uuid not null references public.badges(id) on delete cascade,
  earned_at timestamptz not null default now(),
  unique (user_id, badge_id)
);

create table if not exists public.weekly_quests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  week_start  date not null,               -- lunes de la semana
  code        text not null,               -- sessions, hiit, protein, creatine, sleep
  title       text not null,
  target      int not null,
  progress    int not null default 0,
  xp_reward   int not null default 0,
  completed   boolean not null default false,
  unique (user_id, week_start, code)
);

-- ============================================================
-- updated_at trigger en profiles
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_profiles_updated on public.profiles;
create trigger trg_profiles_updated before update on public.profiles
for each row execute function public.set_updated_at();

-- ============================================================
-- Crear fila de profile automáticamente al registrarse
-- ============================================================
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
