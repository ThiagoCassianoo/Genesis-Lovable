-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000003: authz_functions
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

create or replace function private.has_min_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role >= p_role          -- ordem do enum = hierarquia
  );
$$;

revoke execute on function private.has_min_role(public.app_role) from anon, public;
grant  execute on function private.has_min_role(public.app_role) to authenticated;

