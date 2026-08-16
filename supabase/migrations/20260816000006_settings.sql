-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000006: settings
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

create table public.settings (
  id                   boolean primary key default true check (id),
  church_name          text not null,
  timezone             text not null default 'America/Sao_Paulo',
  min_advance_hours    integer not null default 0  check (min_advance_hours >= 0),
  max_duration_minutes integer not null default 1440 check (max_duration_minutes > 0),
  updated_at           timestamptz not null default now()
);

