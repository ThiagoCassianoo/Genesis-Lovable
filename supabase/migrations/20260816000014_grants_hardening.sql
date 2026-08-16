-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000014: grants_hardening
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

revoke all on all tables in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;

grant select, update                 on public.profiles           to authenticated;
grant select, insert, update, delete on public.user_roles         to authenticated; -- RLS restringe a admin
grant select                         on public.spaces             to authenticated;
grant select                         on public.settings           to authenticated;
grant select                         on public.event_series       to authenticated;
grant select, insert, update         on public.reservations       to authenticated;
grant select                         on public.reservation_events to authenticated;
grant select                         on public.agenda_publica     to anon, authenticated;
-- spaces/event_series/settings: escrita de admin passa por RPC ou GRANT extra
-- deliberadamente NÃO concedido a authenticated no v1 se o admin operar via SQL Editor.

