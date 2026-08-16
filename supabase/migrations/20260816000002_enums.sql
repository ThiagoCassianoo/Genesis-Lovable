-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000002: enums
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

-- A ORDEM DO ENUM É A HIERARQUIA. 'admin' > 'lider' > 'membro' nativamente.
create type public.app_role as enum ('membro','lider','admin');

create type public.reservation_status as enum
  ('solicitada','aprovada','confirmada','recusada','cancelada');

create type public.recurrence_freq as enum ('semanal','quinzenal','mensal');

