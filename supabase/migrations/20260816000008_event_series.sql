-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000008: event_series
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

create table public.event_series (
  id         uuid primary key default gen_random_uuid(),
  space_id   uuid not null references public.spaces(id) on delete restrict,
  title      text not null,
  freq       public.recurrence_freq not null,
  starts_on  date not null,
  ends_on    date not null,
  start_time time not null,
  end_time   time not null,
  timezone   text not null default 'America/Sao_Paulo',
  is_public  boolean not null default true,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  constraint event_series_window   check (ends_on >= starts_on),
  constraint event_series_daypart  check (end_time > start_time),
  constraint event_series_horizon  check (ends_on <= starts_on + interval '18 months')
);

