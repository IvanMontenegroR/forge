-- ============================================================
-- Forge — endurecer funciones (advisors de Supabase)
-- ============================================================

-- Fijar search_path en set_updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end $$;

-- handle_new_user es solo trigger: revocar EXECUTE del API expuesto
revoke execute on function public.handle_new_user() from public, anon, authenticated;
