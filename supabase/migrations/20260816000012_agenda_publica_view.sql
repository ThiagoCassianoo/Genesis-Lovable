-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000012: agenda_publica_view
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

create view public.agenda_publica
with (security_invoker = off) as
select r.id,
       s.name      as espaco,
       r.title     as evento,
       r.starts_at,
       r.ends_at
from public.reservations r
join public.spaces s on s.id = r.space_id
where r.is_public
  and r.status in ('aprovada','confirmada');

comment on view public.agenda_publica is
  'BURACO PUBLICO DELIBERADO. Roda como owner e ignora RLS por desenho. '
  'Nenhuma coluna de dado pessoal. Toda alteracao exige revisao do security-agent.';

revoke all on public.agenda_publica from anon, authenticated;
grant select on public.agenda_publica to anon, authenticated;

