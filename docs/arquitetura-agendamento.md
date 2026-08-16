# Arquitetura de referência — Agendamento de espaços/eventos (igreja)

> Produzido pelo `backend-master` em 2026-08-15. **Condicional à
> aprovação formal da stack** (Supabase, instância por cliente,
> pagamento fora do v1) — ver `docs/decisoes.md`.
> Nada foi aplicado: nenhum projeto criado, nenhuma migration rodada.
> Este é o **molde**: o 2º cliente deve ser replay das migrations + rebrand.

---

**Condicional:** todo este desenho pressupõe a aprovação formal do diretor sobre a stack Supabase (uma instância por cliente, sem gateway de pagamento no v1). Nada aqui foi aplicado: nenhum projeto criado, nenhuma migration executada, nenhum arquivo escrito.

---

Arquitetura de dados: Postgres single-tenant (uma instância Supabase por igreja) com o domínio inteiro em `public`, autorização em tabela de papéis lida por funções `security definer` num schema `private` não exposto, e a regra de negócio mais crítica — não existir duas reservas sobrepostas no mesmo espaço — garantida por constraint `EXCLUDE ... USING gist` sobre `tstzrange`, não por código. A agenda pública é a **única** superfície acessível ao papel `anon`, e ela é uma view de colunas mínimas; todas as tabelas base ficam sem `GRANT` para `anon`, de modo que uma falha de RLS vire erro barulhento (`42501`) em vez de vazamento silencioso. Recorrência de evento é materializada em linhas reais de reserva, porque só linhas reais passam pela constraint do banco.

Decisões:
1. **Papel em tabela (`user_roles`), não em custom claim no JWT.** Trade-off aceito: um lookup extra por statement (mitigado por `security definer` + `(select ...)` que vira initPlan) em troca de revogação instantânea. Com claim no JWT, tirar o papel de "líder" de alguém só surte efeito no próximo refresh do token (até 1h) — e o cenário em que se revoga um líder de igreja é exatamente o cenário em que 1h de janela é inaceitável.
2. **Recorrência materializada em linhas de `reservations`, não RRULE virtual.** Trade-off aceito: culto semanal por 12 meses = ~52 linhas por série (irrelevante nessa escala) em troca de que a constraint `EXCLUDE` proteja também os eventos recorrentes. Uma recorrência calculada em runtime é invisível para o banco e reabre o conflito de agendamento pela porta dos fundos.
3. **`anon` não tem `GRANT` em nenhuma tabela base; a agenda pública é uma view `security_invoker = off` com 5 colunas.** Trade-off aceito: a view ignora RLS por definição (é um buraco deliberado, auditado, com filtro fixo no corpo da view e sem coluna de dado pessoal) em troca de reduzir a superfície pública de 8 tabelas para 1 relação — o que torna o teste negativo trivial de escrever e de repetir a cada deploy.

Riscos:
1. **Falha silenciosa de RLS no UPDATE.** Um líder aprova uma reserva, o PostgREST responde `204 No Content` e nada mudou, porque faltou a policy de SELECT correspondente. Detecção precoce: o frontend deve enviar sempre `Prefer: return=representation` e tratar **array vazio em escrita como erro**, nunca como sucesso; e o script de teste negativo faz PATCH cruzado (usuário A na reserva de B) verificando corpo vazio + releitura como admin confirmando que a linha não mudou.
2. **Projeto pausado por inatividade no plano Free.** Isso não é hipótese: consultando a organização do diretor via MCP agora, **4 dos 5 projetos Supabase existentes estão `INACTIVE`** (só `GITHUB-CENTRAL` está `ACTIVE_HEALTHY`) — o modo de falha já está acontecendo hoje. Detecção precoce: health-check externo batendo em `/rest/v1/agenda_publica` diariamente e alertando; e, na prática, a única correção real é o plano Pro por instância de cliente.

Precisa de aprovação: (a) **custo recorrente do Supabase Pro por instância de cliente** — USD [a preencher pelo diretor]/mês × N clientes, decisão de negócio, não técnica; (b) **extensão `btree_gist`** (pré-instalada no Supabase, mas habilitar extensão é decisão de dependência — não consegui validar ao vivo, as três tentativas de conexão ao projeto ativo retornaram *connection timeout*; SQL de verificação abaixo); (c) **pgTAP + supabase-test-helpers** como dependência de desenvolvimento, se quiser o teste de RLS automatizado em CI em vez de shell script; (d) **método de autenticação** — e-mail+senha e magic link são grátis, OTP por SMS/WhatsApp exige provedor pago; (e) **confirmar se o estado `confirmada` existe no fluxo real da igreja** ou se "aprovada" já é o fim da linha (se for, removo o estado antes da primeira migration — depois vira migração destrutiva).

---

# 1. Modelo de dados

## 1.1 Schemas

| Schema | Exposto na API | Conteúdo |
|---|---|---|
| `public` | sim | tabelas do domínio + a view da agenda |
| `private` | **não** (não incluir em *Exposed schemas*) | funções `security definer` de autorização e triggers |
| `extensions` | não | `btree_gist`, `pgcrypto` |

```sql
create schema if not exists private;
revoke all on schema private from anon, authenticated, public;
grant usage on schema private to authenticated;   -- necessário para EXECUTE nas policies
```

`grant usage` no schema **não** o expõe via PostgREST — a exposição é controlada pela configuração *Exposed schemas* do projeto. Se `private` for adicionado lá por engano, as funções de autorização viram RPC público. Ponto de checagem do security-agent.

## 1.2 Extensão e a armadilha do `search_path`

```sql
create extension if not exists btree_gist with schema extensions;
```

`btree_gist` é o que permite `space_id with =` dentro de um índice GiST (GiST nativo não sabe fazer igualdade de `uuid`). Armadilha: a resolução da *operator class* padrão acontece pelo `search_path` **no momento do DDL**. Se `extensions` não estiver no `search_path` da migration, o `ALTER TABLE ... ADD CONSTRAINT EXCLUDE` falha com `data type uuid has no default operator class for access method "gist"`. Por isso a migration deve abrir com:

```sql
set local search_path = public, extensions;
```

Depois de criada, a constraint guarda a opclass por OID — `search_path` em runtime não importa mais.

Verificação antes de qualquer migration (somente leitura, roda no SQL Editor ou via MCP):

```sql
select name, default_version, installed_version
from pg_available_extensions
where name in ('btree_gist','pgcrypto');
```

## 1.3 Tipos

```sql
-- A ORDEM DO ENUM É A HIERARQUIA. 'admin' > 'lider' > 'membro' nativamente.
create type public.app_role as enum ('membro','lider','admin');

create type public.reservation_status as enum
  ('solicitada','aprovada','confirmada','recusada','cancelada');

create type public.recurrence_freq as enum ('semanal','quinzenal','mensal');
```

Usar a ordem natural do enum como hierarquia elimina uma tabela `role_permissions` e uma função `role_rank` — comparação `ur.role >= 'lider'` já funciona. **Gotcha de migração:** um papel novo (ex.: `secretaria`) exige `alter type public.app_role add value 'secretaria' before 'admin'`, e o valor novo **não pode ser usado na mesma transação** em que foi adicionado. Isso significa: migration N adiciona o valor, migration N+1 usa. Está no plano de migração (§5).

## 1.4 Tabelas

### `profiles` — dado pessoal do membro

```sql
create table public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null check (length(btrim(full_name)) between 2 and 120),
  phone      text check (phone is null or phone ~ '^\+?[0-9]{10,15}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

Não guarda papel. Guarda dado pessoal (LGPD) — ponto de entrada do security-agent. O `on delete cascade` a partir de `auth.users` é o caminho de exclusão para pedido de apagamento.

### `user_roles` — autorização

```sql
create table public.user_roles (
  id      bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  role    public.app_role not null,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  unique (user_id, role)
);
create index user_roles_user_id_idx on public.user_roles (user_id);
```

Tabela separada de `profiles` (e não uma coluna `is_admin`) porque a secretária costuma ser membro **e** líder, e porque separar identidade de permissão é o ponto inteiro de "autenticação ≠ autorização".

### `settings` — linha única, ponto de rebrand/regra

```sql
create table public.settings (
  id                   boolean primary key default true check (id),
  church_name          text not null,
  timezone             text not null default 'America/Sao_Paulo',
  min_advance_hours    integer not null default 0  check (min_advance_hours >= 0),
  max_duration_minutes integer not null default 1440 check (max_duration_minutes > 0),
  updated_at           timestamptz not null default now()
);
```

`id boolean primary key default true check (id)` força fisicamente linha única. Valores concretos de `min_advance_hours` e `max_duration_minutes`: **[a preencher pelo diretor]** com a regra real da igreja. Branding visual (logo, cores) **não** entra aqui — como é uma instância por cliente, isso é build config do frontend, não dado de runtime.

### `spaces` — espaços reserváveis

```sql
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
```

Seed de referência: templo, salão de festas, sala de aula. `requires_approval = false` permite que um espaço de baixo atrito (ex.: sala de aula) pule a fila da secretaria.

**Decisão YAGNI explícita — não existe tabela `space_blackouts`.** Manutenção, feriado e bloqueio administrativo são uma `reservation` criada pelo admin com `title = 'Manutenção'` e `status = 'confirmada'`. DRY: reaproveita a constraint `EXCLUDE`, a agenda, o histórico e as policies já existentes. Uma tabela separada exigiria duplicar a lógica de sobreposição entre duas tabelas — que é precisamente o bug que o `EXCLUDE` existe para prevenir.

### `event_series` — recorrência

```sql
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
```

A série é a **definição**; as ocorrências são linhas reais em `reservations` com `series_id` preenchido. O horizonte de 18 meses evita que alguém gere 10 anos de culto semanal.

### `reservations` — o núcleo

```sql
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
```

Três pontos que importam:

- **`during` é coluna gerada `stored`.** O app escreve `starts_at`/`ends_at` (simples para o PostgREST e para os tipos TypeScript); o banco deriva o range. Não existe caminho em que o range fique dessincronizado dos timestamps. `tstzrange(...)` é imutável, requisito das colunas geradas.
- **Intervalo `'[)'` — semiaberto.** Uma reserva 19:00–21:00 e outra 21:00–23:00 **não** conflitam. Com `'[]'` conflitariam, e a secretaria abriria chamado no primeiro dia.
- **`reservations_decision_consistent` é unidirecional de propósito.** A forma "bonita" (`(status in (...)) = (decided_by is not null)`) quebra na hora que uma reserva aprovada é cancelada: `status='cancelada'` com `decided_by` preenchido faria a igualdade falhar e travaria o cancelamento.

### A constraint que o Conselho exigiu

```sql
alter table public.reservations
  add constraint reservations_no_overlap
  exclude using gist (
    space_id with =,
    during   with &&
  )
  where (status in ('aprovada','confirmada'));
```

O `WHERE` é a parte que quase todo mundo esquece: **`solicitada` não bloqueia agenda**. Três membros podem pedir o salão para o mesmo sábado; a secretaria escolhe. No instante em que o segundo pedido é aprovado, o `UPDATE` falha com `SQLSTATE 23P01 exclusion_violation` — o banco recusa, mesmo se duas secretárias clicarem "aprovar" no mesmo segundo em máquinas diferentes. Isso é o que uma checagem no frontend, ou até um `select ... where overlaps` no backend, não conseguem garantir: entre o `select` e o `insert` existe uma janela de corrida; a constraint GiST não tem essa janela.

**Contrato com o frontend (não negociável):** a tela de aprovação precisa mapear `23P01` para "Este horário já foi aprovado para outra reserva" e recarregar a lista. Se isso não for tratado, o erro sobe como 500 genérico e a secretaria acha que o sistema quebrou.

### Índices

```sql
create index reservations_requested_by_idx on public.reservations (requested_by);
create index reservations_status_starts_idx on public.reservations (status, starts_at);
create index reservations_agenda_idx on public.reservations (starts_at)
  where is_public and status in ('aprovada','confirmada');
create index reservations_series_idx on public.reservations (series_id)
  where series_id is not null;
```

Não existe índice manual para busca por sobreposição: a constraint `EXCLUDE` **já cria** um índice GiST sobre `(space_id, during)`, e é ele que responde tanto à checagem de conflito quanto às queries de disponibilidade. Criar outro seria duplicação pura.

`reservations_requested_by_idx` existe porque `requested_by` é usado na policy de RLS — colunas de policy sem índice são o item nº1 da lista de performance de RLS da Supabase (171 ms → <0,1 ms no benchmark deles).

### `reservation_events` — histórico de decisão

```sql
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
```

Justificativa contra YAGNI: "quem liberou o salão para esse casamento?" é a pergunta política mais frequente numa igreja, e responder isso custa uma tabela de 6 colunas preenchida por trigger. Escrita exclusivamente por trigger `security definer`; **nenhuma** policy de INSERT/UPDATE/DELETE para `authenticated`.

## 1.5 Diagrama de relações

```
auth.users ─1:1─ profiles
     │
     ├─1:N─ user_roles (user_id, role)  ← autorização
     │
     ├─1:N─ reservations.requested_by
     └─0:N─ reservations.decided_by

spaces ─1:N─ reservations ─1:N─ reservation_events
   │             ▲
   └─1:N─ event_series ─(materializa)─┘

reservations ──(view, colunas mínimas)──> agenda_publica  ← única relação visível a anon
```

## 1.6 Triggers de invariante de domínio

Separação explícita de responsabilidades: **RLS decide QUEM**; **trigger decide QUAL TRANSIÇÃO é legal**. Tentar codificar máquina de estados em `WITH CHECK` não funciona, porque `WITH CHECK` não enxerga a linha `OLD`.

```sql
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
```

`decided_by` é atribuído pelo servidor, não aceito do payload. Estados `recusada` e `cancelada` são terminais.

Provisionamento de novo usuário:

```sql
create or replace function private.tg_handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), new.email));
  insert into public.user_roles (user_id, role) values (new.id, 'membro');
  return new;
end $$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.tg_handle_new_user();
```

**Aviso operacional:** se este trigger levantar exceção, o *signup* inteiro falha com 500 e o membro não consegue se cadastrar — é a causa nº1 de "Database error saving new user" em projetos Supabase. Todo campo lido de `raw_user_meta_data` precisa de `coalesce`.

Proteção contra auto-lockout:

```sql
create or replace function private.tg_protect_last_admin()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    raise exception 'nao e permitido remover o ultimo admin' using errcode = 'check_violation';
  end if;
  return null;
end $$;

create constraint trigger user_roles_protect_last_admin
after delete or update on public.user_roles
deferrable initially deferred
for each row execute function private.tg_protect_last_admin();
```

## 1.7 Geração de ocorrências recorrentes

```sql
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
```

Duas escolhas deliberadas: (a) a função **relata** conflitos em vez de abortar o lote inteiro — o líder vê "49 ocorrências criadas, 3 conflitaram" e resolve as três; (b) o `at time zone s.timezone` converte hora local de São Paulo para `timestamptz` corretamente. `d + s.start_time` produz `timestamp` sem fuso; o `at time zone` o ancora. Fazer o contrário (gravar `timestamp` puro) é o caminho para culto às 18:00 na agenda de quem abrir o site de outro fuso.

A data inicial da série deve já cair no dia da semana correto — não há cálculo de "próxima quarta-feira". É uma simplificação consciente: o formulário do frontend escolhe a data do primeiro culto, e o dia da semana decorre dela.

---

# 2. Autenticação e autorização

## 2.1 Autenticação (quem é você)

Supabase Auth, e-mail + senha, com confirmação de e-mail **ligada**. Magic link como alternativa recomendada para o perfil de membro de igreja (menos senha esquecida, menos chamado para a secretaria). OTP por SMS/WhatsApp exige provedor pago — fora do v1 sem aprovação do diretor.

Configuração que o security-agent precisa auditar: confirmação de e-mail obrigatória, tamanho mínimo de senha, *leaked password protection*, rate limit de signup, e a URL de redirect allowlist (redirect aberto é vetor de phishing).

`service_role` key: nunca no frontend, nunca no repositório. Se algum dia houver job administrativo, ele mora em Edge Function com a chave em *secrets*. Custódia de chave = security-agent.

## 2.2 Autorização (o que você pode)

Papel em tabela, lido por função `security definer` num schema não exposto:

```sql
create or replace function private.has_min_role(p_role public.app_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and ur.role >= p_role          -- ordem do enum = hierarquia
  );
$$;

revoke execute on function private.has_min_role(public.app_role) from anon, public;
grant  execute on function private.has_min_role(public.app_role) to authenticated;
```

Quatro detalhes obrigatórios, cada um resolvendo um bug conhecido:

1. **`security definer`** — a função lê `user_roles` **contornando** a RLS de `user_roles`. Sem isso, a policy de `reservations` consultaria `user_roles`, cuja policy consultaria `user_roles`, e o Postgres devolve `infinite recursion detected in policy`.
2. **`stable`** — habilita o cache de initPlan quando chamada dentro de `(select ...)`.
3. **`set search_path = ''`** — função `security definer` sem `search_path` fixo é escalada de privilégio via shadowing de schema. É também um lint do Supabase Advisor (`function_search_path_mutable`). Como consequência, tudo dentro precisa ser qualificado (`public.user_roles`, `auth.uid()`).
4. **schema `private` fora dos *Exposed schemas*** — impede chamada por RPC via API.

## 2.3 A armadilha específica: custom claims / JWT vs tabela

O caminho alternativo é o *Custom Access Token Auth Hook*, que injeta `user_role` no JWT e permite policies sem nenhum acesso a tabela. É mais rápido. **Não é o que estou recomendando**, por três motivos concretos:

- **Staleness.** O JWT não é "fresco". Remover alguém de `lider` só surte efeito quando o token for renovado (padrão: até 1h, e enquanto a sessão estiver ativa). No contexto de igreja, a hora em que se revoga um papel de liderança é uma hora de crise — 1h de janela é risco, não detalhe.
- **`user_metadata` é editável pelo próprio usuário.** Uma policy que lê `auth.jwt() -> 'user_metadata' -> 'role'` é escalada de privilégio direta: o membro chama `supabase.auth.updateUser({ data: { role: 'admin' } })` e vira admin. Se algum dia claim for usado, tem que ser `raw_app_meta_data`, nunca `raw_user_meta_data`. Este é o erro que mais aparece em código gerado por IA — e o diretor constrói por prompt, então o risco é estruturalmente maior aqui.
- **Complexidade operacional.** O hook exige `grant` para `supabase_auth_admin`, policy específica na `user_roles` para esse papel, e ativação manual no dashboard (configuração fora do git — drift). Para uma igreja com dezenas ou centenas de usuários, o ganho de performance é ruído estatístico.

**Reavaliar se, e somente se,** o Advisor apontar `auth_rls_initplan` como gargalo real medido com `explain analyze` — não por suposição.

## 2.4 A armadilha do `auth.uid()` sem `(select ...)`

`using ( auth.uid() = requested_by )` reavalia a função **por linha**. `using ( (select auth.uid()) = requested_by )` vira initPlan e roda **uma vez por statement**. Benchmark oficial: 179 ms → 9 ms; em policy com função `security definer` de papel, 178.000 ms → 12 ms. Regra da casa: **toda** chamada a `auth.uid()`, `auth.jwt()` ou `private.has_min_role()` numa policy vem dentro de `(select ...)`.

Exceção: função que recebe **coluna da linha** como argumento (ex.: `private.space_is_bookable(space_id)`) **não** pode ser embrulhada — o resultado varia por linha. Nesses casos, usar apenas em `WITH CHECK` de INSERT (linha única), nunca em `USING` de SELECT.

Adicionalmente, `auth.uid()` retorna `null` quando não autenticado, e `null = requested_by` é `null` (não `true`), então a policy "falha para o lado seguro" — mas silenciosamente. Por isso toda policy declara `to authenticated`: o Postgres nem executa a expressão para `anon`, e o erro de configuração aparece como negação limpa.

---

# 3. Desenho das policies RLS

## 3.1 Princípios aplicados a todas

- `alter table ... enable row level security` em **todas** as tabelas de `public`, sem exceção.
- Toda policy declara `to authenticated` (ou `to anon` quando for público deliberado). Nunca `to public`.
- Toda chamada de função de auth dentro de `(select ...)`.
- **GRANTs mínimos.** Isto é defesa em profundidade com um efeito colateral valioso: RLS e GRANT são portas independentes; se a RLS estiver errada mas o GRANT estiver ausente, o resultado é `42501 permission denied` — **barulhento**. Se o GRANT estiver largo e a RLS errada, o resultado é vazamento **silencioso**. Manter GRANT apertado converte a falha silenciosa em falha ruidosa.

```sql
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
```

## 3.2 Matriz por tabela × operação

| Tabela | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | dono OU `lider+` | — (trigger) | dono OU `admin` | — |
| `user_roles` | dono OU `admin` | `admin` | `admin` | `admin` |
| `settings` | `authenticated` | — | `admin` | — |
| `spaces` | `authenticated` | `admin` | `admin` | `admin` |
| `event_series` | `authenticated` | `lider+` | `lider+` | `lider+` |
| `reservations` | dono OU `lider+` | dono, forçando `solicitada` | dono (limitado) OU `lider+` | `admin` |
| `reservation_events` | dono da reserva OU `lider+` | — (trigger) | — | — |
| `agenda_publica` (view) | `anon` + `authenticated` | — | — | — |

"—" significa **nenhuma policy**, ou seja, negado por padrão. Ausência de policy é negação; não é preciso escrever policy de negação.

## 3.3 SQL das policies

```sql
alter table public.profiles           enable row level security;
alter table public.user_roles         enable row level security;
alter table public.settings           enable row level security;
alter table public.spaces             enable row level security;
alter table public.event_series       enable row level security;
alter table public.reservations       enable row level security;
alter table public.reservation_events enable row level security;
```

### profiles

```sql
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
```

Sem policy de INSERT: o perfil nasce do trigger `security definer`. Sem policy de DELETE: apagamento vem em cascata de `auth.users`.

### user_roles — a tabela que impede escalada

```sql
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
```

Sem a policy de INSERT restrita a admin, qualquer membro faz `POST /rest/v1/user_roles {"user_id": "<meu id>", "role": "admin"}` e o sistema acabou. Item obrigatório do teste negativo.

### spaces

```sql
create policy spaces_select on public.spaces
for select to authenticated using ( true );

create policy spaces_write_admin on public.spaces
for all to authenticated
using      ( (select private.has_min_role('admin')) )
with check ( (select private.has_min_role('admin')) );
```

`for all` cobre insert/update/delete numa policy só — aceitável aqui porque a condição é idêntica nas quatro operações. Onde as condições divergem, policies separadas, sempre.

### reservations — o caso que mais erra

```sql
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
```

### O cuidado do UPDATE, explicitamente

`UPDATE` no Postgres avalia **duas** expressões e depende de uma terceira:

1. `USING` — quais linhas existentes podem ser tocadas (a linha `OLD`);
2. `WITH CHECK` — como a linha resultante pode ficar (a linha `NEW`);
3. **uma policy de `SELECT` correspondente** — sem ela, o `UPDATE` não encontra a linha e afeta 0 linhas, **sem erro**.

Consequências práticas neste schema:

- `reservations_select` cobre dono e `lider+`, portanto ambas as policies de UPDATE têm SELECT correspondente. Se alguém "otimizar" a policy de SELECT depois (por exemplo, restringindo o líder a ver só reservas futuras), a aprovação de reservas passadas passa a falhar silenciosamente. Qualquer alteração em `reservations_select` obriga a rodar o teste de UPDATE de novo.
- Se `WITH CHECK` for omitido, o Postgres reaproveita o `USING` para checar a linha nova. Em `reservations_update_owner` isso seria catastrófico: `USING` permite `status = 'aprovada'`, então o dono poderia gravar `status = 'aprovada'` em si mesmo. **`WITH CHECK` explícito e mais restrito que o `USING` é o que fecha a auto-aprovação.**
- Policies permissivas se combinam com **OR**. Um líder que também é dono passa pelas duas — sem problema. Mas isso significa que uma policy frouxa adicionada depois **amplia** o acesso, não o restringe. Para restringir de fato, é preciso `as restrictive`.

### reservation_events e event_series

```sql
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
```

### O problema "membro precisa saber se está ocupado sem ver de quem é"

Membro não enxerga reserva de terceiro (LGPD e política interna), mas precisa saber que o salão está tomado no sábado. Resolver isso afrouxando a policy de SELECT seria vazar `requested_by` e `decision_note`. Resolve-se com RPC que devolve **só o bloco de horário**:

```sql
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
```

Duas colunas, zero identificação, e usa o índice GiST da constraint. Este é um dos pontos que o security-agent revisa: qualquer coluna adicionada a esse retorno é uma decisão de privacidade.

### A view pública

```sql
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
```

Por que `security_invoker = off` (o padrão) e não `on`, que parece mais seguro: com `security_invoker = on`, a view executa como `anon`, o que exigiria conceder `GRANT SELECT` a `anon` em `reservations` **e** `spaces` — reabrindo o acesso direto às tabelas base, com todas as colunas. A escolha é entre "uma view definer de 5 colunas com filtro fixo" e "duas tabelas base concedidas a `anon`". A view é estritamente menor.

Contrapartida honesta: o Supabase Advisor vai marcar isso como `security_definer_view`. É um **alerta esperado**, documentado no `comment on view`, e o security-agent precisa aceitá-lo formalmente uma vez — não silenciá-lo globalmente.

Risco de LGPD que o security-agent tem que decidir **antes** do go-live: `r.title` é texto livre e vira público. "Casamento de Fulano e Ciclana" é dado pessoal exposto na internet aberta. Opções: (a) coluna `public_title` separada, preenchida pela secretaria; (b) aviso no formulário de que o título fica público; (c) `is_public` default `false` e só a secretaria promove (é o default que estou propondo). Decisão do diretor + security-agent.

---

# 4. Teste negativo de isolamento — como fazer, concretamente

## 4.1 O que o teste realmente afirma

A regra "qualquer linha retornada = exposto" precisa de uma ressalva precisa, senão o teste fica impossível de passar: existe **exatamente uma** relação em que `anon` deve ver linhas — `agenda_publica`. A afirmação correta é:

> Para `anon` deslogado: toda tabela base retorna `[]`; `agenda_publica` retorna apenas linhas com `is_public = true` e status aprovado/confirmado, e apenas as 5 colunas da allowlist. Qualquer desvio = exposto.

## 4.2 Script (roda a cada deploy, não uma vez)

```bash
#!/usr/bin/env bash
# tests/rls_negative.sh — falha o deploy se algo vazar
set -uo pipefail

URL="${SUPABASE_URL:?}"          # https://<ref>.supabase.co
ANON="${SUPABASE_ANON_KEY:?}"    # chave anon / publishable (sb_publishable_...)
FAIL=0

echo "== FASE 1: anon deslogado nao ve NADA nas tabelas base"
for t in profiles user_roles settings spaces event_series reservations reservation_events; do
  body=$(curl -s "$URL/rest/v1/$t?select=*&limit=1" \
           -H "apikey: $ANON" -H "Authorization: Bearer $ANON")
  if [ "$body" = "[]" ]; then
    echo "  OK    $t -> []"
  else
    echo "  FALHA $t -> $body"; FAIL=1
  fi
done
```

Nota importante sobre o resultado: `[]` significa **RLS negou**. `{"code":"42501",...}` significa **GRANT negou** — também é aprovação, e na verdade é o sinal mais forte, porque é barulhento. O único resultado reprovado é um array com linhas.

```bash
echo "== FASE 2: agenda publica devolve so o permitido"
agenda=$(curl -s "$URL/rest/v1/agenda_publica?select=*&limit=5" \
           -H "apikey: $ANON" -H "Authorization: Bearer $ANON")
# nenhuma coluna sensivel pode aparecer
for col in requested_by decided_by decision_note notes attendees is_public status; do
  echo "$agenda" | grep -q "\"$col\"" && { echo "  FALHA coluna $col exposta"; FAIL=1; }
done

echo "== FASE 3: INSERT anonimo tem que ESTOURAR (unica op que erra alto)"
ins=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$URL/rest/v1/reservations" \
        -H "apikey: $ANON" -H "Authorization: Bearer $ANON" \
        -H "Content-Type: application/json" \
        -d '{"space_id":"00000000-0000-0000-0000-000000000000","title":"invasao",
             "starts_at":"2030-01-01T10:00:00Z","ends_at":"2030-01-01T11:00:00Z",
             "requested_by":"00000000-0000-0000-0000-000000000000"}')
[ "$ins" = "401" ] || [ "$ins" = "403" ] || { echo "  FALHA insert anon devolveu $ins"; FAIL=1; }
```

## 4.3 Fase 4 — o teste que realmente pega o bug: usuário autenticado contra usuário autenticado

O `anon` deslogado é o teste fácil. O vazamento real acontece entre membros logados.

```bash
login() {  # $1=email $2=senha -> access_token
  curl -s "$URL/auth/v1/token?grant_type=password" \
    -H "apikey: $ANON" -H "Content-Type: application/json" \
    -d "{\"email\":\"$1\",\"password\":\"$2\"}" | jq -r .access_token
}

TOK_A=$(login "$MEMBRO_A_EMAIL" "$MEMBRO_A_PASS")
TOK_B=$(login "$MEMBRO_B_EMAIL" "$MEMBRO_B_PASS")

# 4.1 A lista reservas -> nenhuma linha pode ter requested_by != A
curl -s "$URL/rest/v1/reservations?select=id,requested_by" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOK_A" \
  | jq -e --arg a "$UID_A" 'all(.[]; .requested_by == $a)' >/dev/null \
  || { echo "  FALHA A enxerga reserva de terceiro"; FAIL=1; }

# 4.2 A tenta alterar reserva de B -> corpo VAZIO (falha silenciosa) + linha intacta
resp=$(curl -s -X PATCH "$URL/rest/v1/reservations?id=eq.$RESERVA_DE_B" \
        -H "apikey: $ANON" -H "Authorization: Bearer $TOK_A" \
        -H "Content-Type: application/json" -H "Prefer: return=representation" \
        -d '{"title":"sequestrada"}')
[ "$resp" = "[]" ] || { echo "  FALHA PATCH cruzado retornou $resp"; FAIL=1; }
# CONFIRMACAO OBRIGATORIA: reler como admin e checar que o titulo nao mudou.

# 4.3 A tenta se auto-aprovar -> tem que estourar 42501 (WITH CHECK)
curl -s -X PATCH "$URL/rest/v1/reservations?id=eq.$RESERVA_DE_A" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOK_A" \
  -H "Content-Type: application/json" \
  -d '{"status":"aprovada"}' | grep -q '42501' \
  || { echo "  FALHA auto-aprovacao nao foi bloqueada"; FAIL=1; }

# 4.4 A tenta virar admin -> tem que estourar 42501
curl -s -X POST "$URL/rest/v1/user_roles" \
  -H "apikey: $ANON" -H "Authorization: Bearer $TOK_A" \
  -H "Content-Type: application/json" \
  -d "{\"user_id\":\"$UID_A\",\"role\":\"admin\"}" | grep -q '42501' \
  || { echo "  FALHA escalada de privilegio possivel"; FAIL=1; }

exit $FAIL
```

O item **4.2 é o coração do teste**. `PATCH` sem `Prefer: return=representation` devolve `204 No Content`, que o cliente HTTP interpreta como sucesso. Com `return=representation`, RLS negando devolve `[]` — distinguível. Este é o comportamento que "RLS falha em silêncio" descreve, e é o único jeito de observá-lo pela API.

## 4.4 Teste da constraint de agendamento

```sql
-- em transação, no ambiente local/branch — nunca em produção
begin;
insert into public.reservations
  (space_id, requested_by, title, starts_at, ends_at, status, decided_by)
values
  ('<space>', '<user>', 'Culto',   '2030-03-02 19:00-03', '2030-03-02 21:00-03', 'aprovada', '<user>');

-- deve falhar com 23P01
insert into public.reservations
  (space_id, requested_by, title, starts_at, ends_at, status, decided_by)
values
  ('<space>', '<user>', 'Casamento', '2030-03-02 20:00-03', '2030-03-02 22:00-03', 'aprovada', '<user>');

-- deve PASSAR: encosta mas não sobrepõe (intervalo '[)')
insert into public.reservations
  (space_id, requested_by, title, starts_at, ends_at, status, decided_by)
values
  ('<space>', '<user>', 'Ensaio', '2030-03-02 21:00-03', '2030-03-02 22:00-03', 'aprovada', '<user>');

-- deve PASSAR: duas SOLICITADAS sobrepostas são legais por desenho
rollback;
```

Teste de concorrência (o que diferencia constraint de checagem no frontend): duas sessões `psql`, ambas com `begin`, ambas fazendo `update ... set status='aprovada'` em reservas sobrepostas. A segunda fica bloqueada até o commit da primeira e então falha com `23P01`. Uma checagem `select`-antes-de-`insert` no backend passaria nas duas.

## 4.5 Camada automática, além do script

Após **cada** migration, rodar o Advisor do Supabase (disponível via MCP `get_advisors`) e tratar como bloqueante:

- `rls_disabled_in_public` — tabela em `public` sem RLS. **Nunca aceitar.**
- `policy_exists_rls_disabled` — policy escrita mas RLS desligada. Falsa sensação de segurança; o pior estado possível.
- `security_definer_view` — esperado **apenas** para `agenda_publica`; qualquer outra ocorrência é bug.
- `function_search_path_mutable` — nunca aceitar em função `security definer`.
- `auth_rls_initplan` — `auth.uid()` sem `(select ...)`.

Opção formal (exige aprovação de dependência): pgTAP + `supabase-test-helpers`, rodando com `supabase test db`, o que permite escrever os mesmos testes em SQL, impersonando papéis via `set local role authenticated; set local request.jwt.claims = '...'`. Mais robusto que o shell script, custo: mais uma dependência de dev.

---

# 5. Multi-tenant: o que preparar agora e o que não preparar

## 5.1 O que já fica pronto, a custo zero

1. **PK `uuid` em todas as tabelas**, nunca `bigserial`. É a preparação mais barata e mais valiosa: se um dia duas instâncias forem consolidadas, não há colisão de chave. Efeito colateral elegante: como `space_id` é globalmente único, a constraint `EXCLUDE` **já é multi-tenant-safe sem alteração** — dois espaços de igrejas diferentes nunca colidem porque nunca compartilham `space_id`.
2. **Migrations sem dado de cliente.** Schema em `supabase/migrations/`, dados específicos em `supabase/seed/<cliente>.sql`. É isso que faz o cliente #2 ser replay e não projeto novo.
3. **Autorização centralizada em `private.has_min_role`.** Adicionar predicado de tenant no futuro é editar 1 função + N policies, não caçar `if (user.role === 'admin')` espalhado pelo React.
4. **`created_at`/`updated_at` em tudo.** Custo desprezível, e habilita qualquer ETL futuro de consolidação — território natural do diretor como engenheiro de dados.
5. **Frontend sempre com filtro explícito** (`.eq('space_id', x)`), nunca dependendo da RLS como filtro. Já é a recomendação de performance da Supabase (171 ms → 9 ms) e desacopla a query da forma da policy.
6. **Branding fora do banco.** Nome, logo e cor no build do frontend; o schema não sabe qual igreja é.

## 5.2 O que NÃO vale preparar — YAGNI com justificativa

- **`tenant_id` em todas as tabelas.** Não. Uma instância por cliente já dá isolamento **físico**, que é estritamente mais forte que qualquer `tenant_id` filtrado por RLS: um bug de policy num modelo compartilhado vaza dados de outra igreja; aqui, no pior caso, vaza dados da mesma igreja. Carregar `tenant_id` hoje custa uma coluna em cada índice, uma condição em cada policy, uma constante em cada insert e um erro a mais possível — para um cenário que talvez nunca aconteça. Se acontecer, a migração é mecânica e conhecida: `add column tenant_id`, backfill com constante, incluir nas unique/EXCLUDE, incluir nas policies.
- **Tabela `organizations`, modelo de usuário cross-tenant, seletor de tenant na UI.** Nada disso. É a arquitetura que só se paga com dezenas de clientes num plano compartilhado — modelo de negócio que não foi decidido.
- **Schema-por-tenant.** O pior dos dois mundos: complexidade de multi-tenant sem o isolamento de instância separada, e migrations que precisam varrer N schemas.
- **Row-level "soft delete" com `deleted_at` em tudo.** `status = 'cancelada'` já é o soft delete do domínio. Duas semânticas de exclusão convivendo é fonte garantida de bug de agenda (linha cancelada aparecendo como ocupada, ou pior, deletada aparecendo).

## 5.3 O custo real da decisão de uma instância por cliente

Deve ficar registrado, porque é a contrapartida direta do isolamento: **N clientes = N projetos Supabase Pro = N × USD [a preencher pelo diretor]/mês**, mais N deploys de migration e N conjuntos de credenciais para custodiar. O custo de deploy é quase nulo (`supabase db push` replay). O custo financeiro é linear e é decisão de negócio — gate do diretor, revisitável se e quando a margem por cliente for conhecida.

---

# 6. Plano de migração e versionamento de schema

## 6.1 Ferramenta e disciplina

Supabase CLI, migrations versionadas em `supabase/migrations/<timestamp>_<nome>.sql`, tudo em git. Regras inegociáveis:

- **Proibido rodar DDL pelo SQL Editor em produção.** Toda mudança feita pelo dashboard é drift invisível que quebra o replay no cliente #2. Verificação: `supabase db diff --linked` tem que sair **vazio**. Se sair com conteúdo, alguém mexeu por fora.
- **Policies de RLS são schema.** Vivem em migration, nunca clicadas na UI.
- **Migration já aplicada nunca é editada.** O CLI rastreia por versão; editar um arquivo aplicado faz o histórico do cliente A divergir do cliente B e mata o modelo de molde. Correção = nova migration.
- Fluxo: `supabase start` (local, Docker) → aplica → roda `tests/rls_negative.sh` contra o local → `supabase db push` para o remoto → roda o teste negativo **de novo** contra o remoto → `get_advisors` → `supabase gen types typescript --linked > src/types/database.ts` e commit.

## 6.2 Ordem das migrations do molde v1

| # | Arquivo | Conteúdo |
|---|---|---|
| 0001 | `extensions_and_private_schema` | `btree_gist`, schema `private`, `search_path` da migration |
| 0002 | `enums` | `app_role`, `reservation_status`, `recurrence_freq` |
| 0003 | `authz_functions` | `private.has_min_role` + grants |
| 0004 | `profiles` | tabela + trigger `handle_new_user` |
| 0005 | `user_roles` | tabela + guarda do último admin |
| 0006 | `settings` | tabela linha-única |
| 0007 | `spaces` | tabela |
| 0008 | `event_series` | tabela |
| 0009 | `reservations` | tabela + coluna gerada + **EXCLUDE** + índices |
| 0010 | `reservation_events` | tabela + trigger de transição/auditoria |
| 0011 | `rpc_disponibilidade` | `horarios_ocupados`, `gerar_ocorrencias` |
| 0012 | `agenda_publica_view` | view + comment + grants |
| 0013 | `rls_policies` | `enable rls` + todas as policies |
| 0014 | `grants_hardening` | revokes, grants mínimos, default privileges |
| — | `seed/<cliente>.sql` | **não é migration**: espaços, settings, primeiro admin |

Tag git `molde-agendamento-v1.0.0` no conjunto. Cliente #2 = clonar o template, `supabase link`, `supabase db push`, aplicar o seed próprio, rebrand no frontend.

## 6.3 Divergência entre clientes

Se a igreja B precisar de algo que a A não tem: **jamais** editar a migration compartilhada. Duas saídas legítimas: (a) *feature flag* como coluna em `settings` (preferida — mantém uma migration só e o molde íntegro); (b) migration adicional `9xxx_cliente_b_<coisa>.sql` que só existe no fork daquele cliente, documentada no README. Se o padrão (b) aparecer três vezes, a feature volta para o molde como flag — aí é sinal de que é requisito comum, não exceção.

## 6.4 Migração destrutiva: plano de rollback obrigatório

Nenhuma migration que faça `drop column`, `drop table`, `alter type` de coluna com dado, ou renomeação, entra em produção sem os quatro itens abaixo **escritos e testados antes**:

1. **Dump prévio das tabelas afetadas.** `supabase db dump --data-only --table public.reservations -f backup_pre_0021.sql`, retenção e verificação de integridade sob responsabilidade do infra-agent.
2. **Padrão expand/contract, nunca big-bang.** Renomear `notes` → `observacoes` são **três** releases: (i) adiciona `observacoes`, backfill, trigger de escrita dupla; (ii) frontend passa a ler/escrever `observacoes`, sai um release inteiro no ar; (iii) migration separada remove `notes` e o trigger. Cada etapa é reversível sozinha. Renomear e dropar no mesmo deploy é irreversível na prática.
3. **Script de rollback escrito no mesmo PR**, em `supabase/rollback/0021_down.sql`, **testado contra uma cópia** (Supabase Branching, que é recurso Pro, ou stack local restaurada do dump) antes de a migration forward tocar produção. Migration sem `down` testado = não sobe.
4. **Janela e sinal de aborto definidos:** quem executa, qual métrica indica falha (taxa de erro 5xx no PostgREST, `42501`/`23P01` fora do normal), e em quanto tempo se decide rollback.

Casos específicos deste schema que exigem cuidado extra:

- **`alter type public.app_role add value ...`** — o valor novo não pode ser usado na mesma transação. Sempre duas migrations: uma adiciona, a seguinte usa. E não existe `drop value` em enum: remover um papel exige recriar o tipo, com dump obrigatório.
- **Alterar o `WHERE` da constraint `EXCLUDE`** (por exemplo, passar a bloquear em `solicitada`) — é `drop constraint` + `add constraint`, e o `add` **falha** se já houver dados sobrepostos em produção. Rollback = recriar a constraint antiga, o que também pode falhar se dados novos já violarem. Procedimento: rodar antes, em produção, o `select` que lista sobreposições sob a regra nova; só migrar depois de zerar os conflitos existentes.
- **Alterar a lista de colunas de `agenda_publica`** — `create or replace view` não permite remover ou reordenar colunas; exige `drop view` + `create view`, com janela em que a agenda pública fica fora do ar. E toda alteração dessa view passa pelo security-agent por definição.

## 6.5 Contrato com o frontend

`supabase gen types typescript --linked` roda em todo deploy de schema e o arquivo gerado é commitado. Assim o React 18 + TS quebra em tempo de compilação quando o schema muda — que é exatamente onde se quer que quebre, e não em produção diante da secretaria. Isso é o único ponto de acoplamento formal entre banco e frontend, e é gerado, não escrito à mão (DRY).

---

# 7. Handoffs

## 7.1 O que o infra-agent precisa saber (backup/monitoramento não são meus)

- **Plano Pro é pré-requisito funcional, não conforto.** Evidência observada agora na organização do diretor: 4 dos 5 projetos Supabase estão `INACTIVE`. Um sistema de agendamento de igreja que dorme após uma semana de baixa atividade falha justamente no feriado longo.
- Backup diário do Pro cobre o caso comum; **PITR é add-on separado** — decisão de custo: [a preencher pelo diretor]. Sem PITR, a granularidade de recuperação é de um dia.
- **Ensaio de restore obrigatório antes do go-live.** Backup não testado não é backup.
- **Dump pré-migration destrutiva** é etapa dele no pipeline (§6.4).
- **Métricas que valem alerta**, todas obteníveis dos logs do PostgREST/Postgres:
  - contagem de `23P01` — tentativas de dupla reserva. Alta = problema de UX no frontend (não está mostrando disponibilidade direito), não de banco.
  - contagem de `42501` — negações de permissão. Pico súbito = alguém sondando a API.
  - falhas de autenticação por IP.
  - latência p95 do endpoint `/rest/v1/agenda_publica` (é o único caminho anônimo, portanto o único exposto a tráfego não autenticado).
- CI precisa de `SUPABASE_ACCESS_TOKEN` e credenciais dos usuários de teste em secrets; **nunca** `service_role` em job que rode código de terceiros.

## 7.2 Onde o security-agent tem que entrar — dado de cliente é responsabilidade

1. **Aprovar formalmente a view `agenda_publica`**: lista exata de colunas e o alerta `security_definer_view` do Advisor, que é esperado e precisa ser aceito por escrito, não silenciado.
2. **Decidir o tratamento de `reservations.title` na agenda pública** — texto livre exposto na internet pode conter nome de pessoa ("Casamento de X"). Risco LGPD concreto.
3. **Inventário de dado pessoal**: `profiles.full_name`, `profiles.phone`, `auth.users.email`. Definir retenção, base legal e o caminho de atendimento a pedido de exclusão (hoje: `delete` em `auth.users` cascateia `profiles` e `user_roles`; `reservations` usa `on delete restrict` de propósito — o histórico não some sozinho, tem que haver decisão explícita de anonimizar vs apagar).
4. **Revisar toda função `security definer`** — são 6 no desenho (`has_min_role`, `tg_handle_new_user`, `tg_reservation_transition`, `tg_protect_last_admin`, `horarios_ocupados`, `gerar_ocorrencias`). Cada uma roda com privilégio elevado; cada uma precisa de `set search_path = ''` e de `revoke execute from anon, public`.
5. **Custódia de chaves**: `service_role` nunca no frontend nem no repositório; rotação definida.
6. **Configuração de Auth**: confirmação de e-mail, política de senha, leaked password protection, allowlist de redirect, rate limits.
7. **Confirmar que `private` não está em *Exposed schemas*** — checagem de um minuto que, se falhar, transforma as funções de autorização em RPC público.

---

# 8. Limitação desta entrega

Não consegui validar `btree_gist` ao vivo: as três tentativas de conexão ao único projeto ativo do diretor (`GITHUB-CENTRAL`, `tufzqlxqgwuqtjfyfzwt`, Postgres 17.6, `ca-central-1`) retornaram `Connection terminated due to connection timeout` — tanto via `list_extensions` quanto via `execute_sql`. `btree_gist` faz parte do contrib padrão do Postgres e consta da lista pré-configurada do Supabase, mas a confirmação empírica fica pendente: rodar `select name, default_version, installed_version from pg_available_extensions where name = 'btree_gist';` na instância do cliente **antes** da migration 0001. Se, contra a expectativa, não estiver disponível, o plano B é um trigger `before insert or update` usando `pg_advisory_xact_lock(hashtext(space_id::text))` seguido de checagem `&&` — correto, porém mais lento e com mais código para revisar, o que é exatamente o trade-off que a constraint declarativa evita.agentId: a0ae86b6da145d968 (use SendMessage with to: 'a0ae86b6da145d968', summary: '<5-10 word recap>' to continue this agent)
<usage>subagent_tokens: 127777
tool_uses: 12
duration_ms: 646040</usage>