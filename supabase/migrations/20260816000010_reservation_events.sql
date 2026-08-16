-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000010: reservation_events
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

create table public.reservation_events (
  id             bigint generated always as identity primary key,
  reservation_id uuid not null references public.reservations(id) on delete cascade,
  from_status    public.reservation_status,
  to_status      public.reservation_status not null,
  actor_id       uuid references auth.users(id),
  note           text,
  created_at     timestamptz not null default now()
);
create index reservation_events_reservation_idx
  on public.reservation_events (reservation_id, created_at desc);

create or replace function private.tg_reservation_transition()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_actor uuid := (select auth.uid());
begin
  if new.space_id is distinct from old.space_id
     or new.requested_by is distinct from old.requested_by then
    raise exception 'espaco e solicitante sao imutaveis; abra nova solicitacao'
      using errcode = 'check_violation';
  end if;

  if (new.starts_at, new.ends_at) is distinct from (old.starts_at, old.ends_at)
     and old.status <> 'solicitada' then
    raise exception 'horario so pode ser alterado enquanto a reserva esta solicitada'
      using errcode = 'check_violation';
  end if;

  if new.status is distinct from old.status then
    if not (
      (old.status = 'solicitada' and new.status in ('aprovada','recusada','cancelada')) or
      (old.status = 'aprovada'   and new.status in ('confirmada','cancelada'))          or
      (old.status = 'confirmada' and new.status = 'cancelada')
    ) then
      raise exception 'transicao invalida: % -> %', old.status, new.status
        using errcode = 'check_violation';
    end if;

    if new.status in ('aprovada','recusada') then
      new.decided_by := v_actor;      -- nunca confiar no cliente
      new.decided_at := now();
    end if;
    if new.status = 'cancelada' then
      new.cancelled_at := now();
    end if;

    insert into public.reservation_events
      (reservation_id, from_status, to_status, actor_id, note)
    values (new.id, old.status, new.status, v_actor, new.decision_note);
  end if;

  new.updated_at := now();
  return new;
end $$;

create trigger reservations_transition
before update on public.reservations
for each row execute function private.tg_reservation_transition();

