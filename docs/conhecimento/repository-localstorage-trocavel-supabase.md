# Arquitetura — Repository assíncrono sobre localStorage, trocável por Supabase

Domínio: SPA front-only (Vite/React 18/TS) que precisa funcionar com dado local agora e trocar pra Supabase depois sem reescrever telas.
Origem: `projetos/cafe-teste/` (diário de lavoura, teste fictício da fábrica, 2026-10-21, sem dado de cliente). Brief em `docs/clientes/cafe-teste/brief.md`.

Reutilizável para: qualquer protótipo/MVP de CRUD simples onde o backend (Supabase, uma instância por cliente) ainda não existe, mas a troca é esperada.

## 1. Interface Repository assíncrona
Métodos: `listTalhoes`, `createTalhao`, `getTalhao`, `listAtividades`, `createAtividade`, `removerExemplos`, `recomecar`. Tudo retorna Promise, mesmo sobre localStorage síncrono, para que a UI já trate loading/erro como com rede.

## 2. Implementação localStorage
- Chave versionada `cafe:v1` + campo `schemaVersion` no payload.
- Leitura passa por `zod.safeParse`. Dado corrompido gera erro tipado, exibido num `ErrorState` com ação "recomeçar".
- Injeção por React Context. Trocar por Supabase = nova classe que implementa a mesma interface, sem tocar nas telas.

## 3. Data local sem `toISOString`
`hojeLocal()` monta a data com os componentes locais. `toISOString()` converte para UTC: às 21h em UTC-3 o "hoje" viraria amanhã e a regra "data não-futura" erraria. Testado com `vi.stubEnv('TZ')` + `vi.setSystemTime`.

## 4. Exemplos fictícios
Dados de demonstração levam flag `ficticio`, prefixo `[EXEMPLO]` e badge visível. `removerExemplos` apaga os talhões fictícios e TODAS as atividades deles — inclusive atividades reais registradas num talhão de exemplo —, por isso a interface avisa antes; desde 2026-10-21 o botão também pede confirmação (achado não-bloqueante do fiscal-agent, corrigido). Ao reaproveitar o padrão, decidir explicitamente se isso é desejado.

## Lições de falha intermediária
Corrigidas na 1ª tentativa, sem escalada, portanto sem post-mortem.
- `process` não existe no tsconfig do app: usar `vi.stubEnv` em vez de `process.env`.
- Dois `role="status"` simultâneos quebram `getByRole`: usar asserção específica.

## Observação do fiscal-agent (resolvida)
"Remover exemplos" agia sem confirmação; corrigido em 2026-10-21 (agora pede confirmação, mesmo padrão do "Recomeçar do zero").
