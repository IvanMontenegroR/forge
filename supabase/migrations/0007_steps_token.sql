-- ============================================================
-- Forge — token personal para ingestar pasos (Apple Shortcuts → webhook)
-- Cada usuario tiene un steps_token; la Edge Function ingest-steps
-- (verify_jwt=false) lo usa para escribir sus pasos en cardio_logs.
-- ============================================================
alter table public.profiles add column if not exists steps_token uuid not null default gen_random_uuid();
create unique index if not exists idx_profiles_steps_token on public.profiles(steps_token);
