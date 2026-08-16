-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000004: profiles
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null check (length(btrim(full_name)) between 2 and 120),
  phone      text check (phone is null or phone ~ '^\+?[0-9]{10,15}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.tg_handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), new.email));
  insert into public.user_roles (user_id, role) values (new.id, 'membro');
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.tg_handle_new_user();

