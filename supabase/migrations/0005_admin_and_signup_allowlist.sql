-- ============================================================
-- Forge — rol admin + allowlist de registro
-- Solo los emails en public.allowed_emails pueden crear cuenta.
-- Gestión desde el panel admin de la app (rol 'admin' en profiles).
-- ============================================================

-- 1) Rol en profiles
alter table public.profiles add column if not exists role text not null default 'user';

-- 2) Tabla de emails autorizados a registrarse
create table if not exists public.allowed_emails (
  email      text primary key,
  note       text,
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.allowed_emails enable row level security;

-- Solo admins pueden ver/gestionar la allowlist.
-- (La subconsulta lee el propio perfil del usuario, permitido por su RLS; sin recursión.)
drop policy if exists "admin manage allowed_emails" on public.allowed_emails;
create policy "admin manage allowed_emails" on public.allowed_emails
  for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- 3) Trigger que bloquea el registro de emails no autorizados
create or replace function public.enforce_signup_allowlist()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.email is null or not exists (
    select 1 from public.allowed_emails a where lower(a.email) = lower(new.email)
  ) then
    raise exception 'Email no autorizado para registrarse en Forge';
  end if;
  return new;
end $$;

revoke execute on function public.enforce_signup_allowlist() from public, anon, authenticated;

drop trigger if exists on_auth_user_allowlist on auth.users;
create trigger on_auth_user_allowlist
  before insert on auth.users
  for each row execute function public.enforce_signup_allowlist();
