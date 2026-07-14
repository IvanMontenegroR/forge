-- ============================================================
-- Forge — GIF de demostración por ejercicio.
-- Los GIFs se sirven desde jsDelivr (ExerciseGymGifsDB). Se completan
-- por dato (no en esta migración); acá solo se agrega la columna.
-- ============================================================
alter table public.exercises add column if not exists demo_url text;
