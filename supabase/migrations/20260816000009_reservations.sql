-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000009: reservations
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

set local search_path = public, extensions;

create table public.reservations (
  id            uuid primary key default gen_random_uuid(),
  space_id      uuid not null references public.spaces(id) on delete restrict,
  series_id     uuid references public.event_series(id) on delete cascade,
  requested_by  uuid not null references auth.users(id) on delete restrict,
  title         text not null check (length(btrim(title)) between 3 and 120),
  notes         text check (notes is null or length(notes) <= 1000),
  starts_at     timestamptz not null,
  ends_at       timestamptz not null,
  during        tstzrange generated always as
                  (tstzrange(starts_at, ends_at, '[)')) stored,
  status        public.reservation_status not null default 'solicitada',
  is_public     boolean not null default false,
  attendees     integer check (attendees is null or attendees > 0),
  decided_by    uuid references auth.users(id),
  decided_at    timestamptz,
  decision_note text,
  cancelled_at  timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  constraint reservations_period_valid check (ends_at > starts_at),
  constraint reservations_decision_consistent check (
    status not in ('aprovada','confirmada','recusada') or decided_by is not null
  )
);

alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (
    space_id with =,
    during   with &&
  )
  where (status in ('aprovada','confirmada'));

create index reservations_requested_by_idx on public.reservations (requested_by);
create index reservations_status_starts_idx on public.reservations (status, starts_at);
create index reservations_agenda_idx on public.reservations (starts_at)
  where is_public and status in ('aprovada','confirmada');
create index reservations_series_idx on public.reservations (series_id)
  where series_id is not null;

