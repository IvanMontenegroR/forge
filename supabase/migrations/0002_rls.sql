-- ============================================================
-- Forge — Row Level Security
--
-- Regla general:
--   * Tablas GLOBALES (exercises, programs, program_days,
--     program_day_exercises, badges): lectura para cualquier
--     usuario autenticado; escritura solo service_role (seed).
--   * Tablas POR USUARIO: cada quien ve/escribe SOLO sus filas
--     (auth.uid() = user_id, o id en profiles).
--
-- Nota: el cliente usa la anon key. Sin política que matchee,
-- RLS niega por defecto. service_role saltea RLS (seed/edge).
-- ============================================================

-- Activar RLS en todo
alter table public.exercises             enable row level security;
alter table public.programs              enable row level security;
alter table public.program_days          enable row level security;
alter table public.program_day_exercises enable row level security;
alter table public.badges                enable row level security;

alter table public.profiles          enable row level security;
alter table public.user_foods        enable row level security;
alter table public.user_supplements  enable row level security;
alter table public.sessions          enable row level security;
alter table public.set_logs          enable row level security;
alter table public.body_metrics      enable row level security;
alter table public.nutrition_logs    enable row level security;
alter table public.supplement_logs   enable row level security;
alter table public.sleep_logs        enable row level security;
alter table public.cardio_logs       enable row level security;
alter table public.xp_events         enable row level security;
alter table public.streaks           enable row level security;
alter table public.user_badges       enable row level security;
alter table public.weekly_quests     enable row level security;

-- ─────────────── GLOBALES: lectura para autenticados ───────────────
drop policy if exists "read exercises" on public.exercises;
create policy "read exercises" on public.exercises
  for select to authenticated using (true);

drop policy if exists "read programs" on public.programs;
create policy "read programs" on public.programs
  for select to authenticated using (true);

drop policy if exists "read program_days" on public.program_days;
create policy "read program_days" on public.program_days
  for select to authenticated using (true);

drop policy if exists "read program_day_exercises" on public.program_day_exercises;
create policy "read program_day_exercises" on public.program_day_exercises
  for select to authenticated using (true);

drop policy if exists "read badges" on public.badges;
create policy "read badges" on public.badges
  for select to authenticated using (true);

-- (Permitir que un usuario cree SUS propios programas custom)
drop policy if exists "insert own programs" on public.programs;
create policy "insert own programs" on public.programs
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "update own programs" on public.programs;
create policy "update own programs" on public.programs
  for update to authenticated using (created_by = auth.uid()) with check (created_by = auth.uid());

-- ─────────────── PROFILES (1:1 con auth.users) ───────────────
drop policy if exists "select own profile" on public.profiles;
create policy "select own profile" on public.profiles
  for select to authenticated using (id = auth.uid());

drop policy if exists "insert own profile" on public.profiles;
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

-- ─────────────── Helper: política owner estándar ───────────────
-- (Postgres no tiene macros; se repite el patrón user_id = auth.uid())

-- user_foods
drop policy if exists "own user_foods" on public.user_foods;
create policy "own user_foods" on public.user_foods
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- user_supplements
drop policy if exists "own user_supplements" on public.user_supplements;
create policy "own user_supplements" on public.user_supplements
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- sessions
drop policy if exists "own sessions" on public.sessions;
create policy "own sessions" on public.sessions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- set_logs
drop policy if exists "own set_logs" on public.set_logs;
create policy "own set_logs" on public.set_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- body_metrics
drop policy if exists "own body_metrics" on public.body_metrics;
create policy "own body_metrics" on public.body_metrics
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- nutrition_logs
drop policy if exists "own nutrition_logs" on public.nutrition_logs;
create policy "own nutrition_logs" on public.nutrition_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- supplement_logs
drop policy if exists "own supplement_logs" on public.supplement_logs;
create policy "own supplement_logs" on public.supplement_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- sleep_logs
drop policy if exists "own sleep_logs" on public.sleep_logs;
create policy "own sleep_logs" on public.sleep_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- cardio_logs
drop policy if exists "own cardio_logs" on public.cardio_logs;
create policy "own cardio_logs" on public.cardio_logs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- xp_events
drop policy if exists "own xp_events" on public.xp_events;
create policy "own xp_events" on public.xp_events
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- streaks
drop policy if exists "own streaks" on public.streaks;
create policy "own streaks" on public.streaks
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- user_badges
drop policy if exists "own user_badges" on public.user_badges;
create policy "own user_badges" on public.user_badges
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- weekly_quests
drop policy if exists "own weekly_quests" on public.weekly_quests;
create policy "own weekly_quests" on public.weekly_quests
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
