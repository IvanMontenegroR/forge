-- ============================================================
-- Forge — meta de entrenos por semana (racha por frecuencia).
-- La rutina pasa a ser rotativa (sin días fijos); la racha de entreno
-- cuenta semanas seguidas que cumplen esta meta.
-- ============================================================
alter table public.profiles add column if not exists weekly_workout_goal int not null default 3;
