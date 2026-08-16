-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000005: user_roles
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

create table public.user_roles (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role    public.app_role not null,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  unique (user_id, role)
);
create index user_roles_user_id_idx on public.user_roles (user_id);

create or replace function private.tg_protect_last_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    raise exception 'nao e permitido remover o ultimo admin' using errcode = 'check_violation';
  end if;
  return null;
end $$;

create constraint trigger user_roles_protect_last_admin
after delete or update on public.user_roles
deferrable initially deferred
for each row execute function private.tg_protect_last_admin();

