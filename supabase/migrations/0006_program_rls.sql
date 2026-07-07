-- ============================================================
-- Forge — RLS de programas custom
-- Presets visibles para todos; programas custom solo su dueño.
-- El dueño puede gestionar días/ejercicios de SUS programas.
-- ============================================================

-- programs: lectura scoping (preset o propio) + delete own
drop policy if exists "read programs" on public.programs;
create policy "read programs" on public.programs
  for select to authenticated
  using (is_preset or created_by = auth.uid());

drop policy if exists "delete own programs" on public.programs;
create policy "delete own programs" on public.programs
  for delete to authenticated
  using (created_by = auth.uid());

-- program_days
drop policy if exists "read program_days" on public.program_days;
create policy "read program_days" on public.program_days
  for select to authenticated
  using (exists (
    select 1 from public.programs p
    where p.id = program_days.program_id and (p.is_preset or p.created_by = auth.uid())
  ));

drop policy if exists "write own program_days" on public.program_days;
create policy "write own program_days" on public.program_days
  for all to authenticated
  using (exists (select 1 from public.programs p where p.id = program_days.program_id and p.created_by = auth.uid()))
  with check (exists (select 1 from public.programs p where p.id = program_days.program_id and p.created_by = auth.uid()));

-- program_day_exercises
drop policy if exists "read program_day_exercises" on public.program_day_exercises;
create policy "read program_day_exercises" on public.program_day_exercises
  for select to authenticated
  using (exists (
    select 1 from public.program_days d
    join public.programs p on p.id = d.program_id
    where d.id = program_day_exercises.program_day_id and (p.is_preset or p.created_by = auth.uid())
  ));

drop policy if exists "write own program_day_exercises" on public.program_day_exercises;
create policy "write own program_day_exercises" on public.program_day_exercises
  for all to authenticated
  using (exists (
    select 1 from public.program_days d
    join public.programs p on p.id = d.program_id
    where d.id = program_day_exercises.program_day_id and p.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.program_days d
    join public.programs p on p.id = d.program_id
    where d.id = program_day_exercises.program_day_id and p.created_by = auth.uid()
  ));
