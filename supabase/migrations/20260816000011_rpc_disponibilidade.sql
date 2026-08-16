-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000011: rpc_disponibilidade
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

create or replace function public.horarios_ocupados(
  p_space_id uuid, p_from timestamptz, p_to timestamptz
)
returns table (starts_at timestamptz, ends_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.starts_at, r.ends_at
  from public.reservations r
  where r.space_id = p_space_id
    and r.status in ('aprovada','confirmada')
    and r.during && tstzrange(p_from, p_to, '[)')
  order by r.starts_at;
$$;

revoke execute on function public.horarios_ocupados(uuid, timestamptz, timestamptz) from anon, public;
grant  execute on function public.horarios_ocupados(uuid, timestamptz, timestamptz) to authenticated;

create or replace function public.gerar_ocorrencias(p_series_id uuid)
returns table (reservation_id uuid, ocorrencia_em timestamptz, conflito text)
language plpgsql security definer set search_path = '' as $$
declare
  s public.event_series;
  d date; v_start timestamptz; v_end timestamptz; v_id uuid; v_step interval;
begin
  if not private.has_min_role('lider') then
    raise exception 'sem permissao' using errcode = '42501';
  end if;

  select * into strict s from public.event_series where id = p_series_id;

  v_step := case s.freq
              when 'semanal'    then interval '7 days'
              when 'quinzenal'  then interval '14 days'
              when 'mensal'     then interval '1 month'
            end;

  for d in select g::date from generate_series(s.starts_on, s.ends_on, v_step) g loop
    v_start := (d + s.start_time) at time zone s.timezone;
    v_end   := (d + s.end_time)   at time zone s.timezone;
    begin
      insert into public.reservations
        (space_id, series_id, requested_by, title, starts_at, ends_at,
         status, is_public, decided_by, decided_at)
      values
        (s.space_id, s.id, s.created_by, s.title, v_start, v_end,
         'confirmada', s.is_public, (select auth.uid()), now())
      returning id into v_id;
      return query select v_id, v_start, null::text;
    exception when exclusion_violation then
      return query select null::uuid, v_start, 'conflito com reserva ja aprovada'::text;
    end;
  end loop;
end $$;

revoke execute on function public.gerar_ocorrencias(uuid) from anon, public;
grant  execute on function public.gerar_ocorrencias(uuid) to authenticated;

