-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000007: spaces
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

create table public.spaces (
  id                uuid primary key default gen_random_uuid(),
  name              text not null unique check (length(btrim(name)) between 2 and 80),
  description       text,
  capacity          integer check (capacity is null or capacity > 0),
  requires_approval boolean not null default true,
  is_active         boolean not null default true,
  display_color     text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

