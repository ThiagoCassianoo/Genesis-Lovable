-- Molde v1 — Missões Tech / Agendamento de espaços
-- Migration 20260816000013: rls_policies
-- Extraído de docs/arquitetura-agendamento.md (backend-master, 2026-08-15)
-- Aprovação de stack: docs/decisoes.md, 2026-08-16 (Thiago)

alter table public.profiles           enable row level security;
alter table public.user_roles         enable row level security;
alter table public.settings           enable row level security;
alter table public.spaces             enable row level security;
alter table public.event_series       enable row level security;
alter table public.reservations       enable row level security;
alter table public.reservation_events enable row level security;

create policy profiles_select on public.profiles
for select to authenticated
using ( (select auth.uid()) = id or (select private.has_min_role('lider')) );

create policy profiles_update_self on public.profiles
for update to authenticated
using      ( (select auth.uid()) = id )
with check ( (select auth.uid()) = id );

create policy profiles_update_admin on public.profiles
for update to authenticated
using      ( (select private.has_min_role('admin')) )
with check ( (select private.has_min_role('admin')) );

create policy user_roles_select on public.user_roles
for select to authenticated
using ( user_id = (select auth.uid()) or (select private.has_min_role('admin')) );

create policy user_roles_insert_admin on public.user_roles
for insert to authenticated
with check ( (select private.has_min_role('admin')) );

create policy user_roles_update_admin on public.user_roles
for update to authenticated
using      ( (select private.has_min_role('admin')) )
with check ( (select private.has_min_role('admin')) );

create policy user_roles_delete_admin on public.user_roles
for delete to authenticated
using ( (select private.has_min_role('admin')) );

create policy spaces_select on public.spaces
for select to authenticated using ( true );

create policy spaces_write_admin on public.spaces
for all to authenticated
using      ( (select private.has_min_role('admin')) )
with check ( (select private.has_min_role('admin')) );

-- SELECT: dono vê as suas; líder e admin veem todas.
create policy reservations_select on public.reservations
for select to authenticated
using (
  requested_by = (select auth.uid())
  or (select private.has_min_role('lider'))
);

-- INSERT: só para si mesmo, e obrigatoriamente no estado inicial.
create policy reservations_insert_self on public.reservations
for insert to authenticated
with check (
  requested_by = (select auth.uid())
  and status = 'solicitada'
  and decided_by is null
  and decided_at is null
);

-- UPDATE (dono): pode editar enquanto solicitada, e pode cancelar.
-- O WITH CHECK é o que impede auto-aprovação.
create policy reservations_update_owner on public.reservations
for update to authenticated
using      ( requested_by = (select auth.uid())
             and status in ('solicitada','aprovada','confirmada') )
with check ( requested_by = (select auth.uid())
             and status in ('solicitada','cancelada') );

-- UPDATE (líder/admin): aprova, recusa, cancela.
create policy reservations_update_staff on public.reservations
for update to authenticated
using      ( (select private.has_min_role('lider')) )
with check ( (select private.has_min_role('lider')) );

-- DELETE: só admin, e só para atender pedido de apagamento LGPD.
create policy reservations_delete_admin on public.reservations
for delete to authenticated
using ( (select private.has_min_role('admin')) );

create policy reservation_events_select on public.reservation_events
for select to authenticated
using (
  (select private.has_min_role('lider'))
  or exists (
    select 1 from public.reservations r
    where r.id = reservation_events.reservation_id
      and r.requested_by = (select auth.uid())
  )
);

create policy event_series_select on public.event_series
for select to authenticated using ( true );

create policy event_series_write_staff on public.event_series
for all to authenticated
using      ( (select private.has_min_role('lider')) )
with check ( (select private.has_min_role('lider')) );

