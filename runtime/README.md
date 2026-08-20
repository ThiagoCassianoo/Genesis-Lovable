# Runtime multi-modelo (v0) — Missões Tech

Scaffold mínimo pra rodar qualquer agente de `.claude/agents/*.md`
fora do Claude Code, com failover Claude → Gemini, timeout, retry com
backoff e circuit breaker por provider (ver "Resiliência do router"
abaixo). **Isso é v0**: sem persistência, sem interface web, sem
orquestração automática entre agentes — só o suficiente pra testar no
terminal e evoluir a partir daqui. Clean Architecture no tamanho que o
problema pede agora (YAGNI): 3 responsabilidades separadas (carregar
agente, falar com provider, loop de chat), nada além disso.

## Setup
1. `cd runtime && npm install @anthropic-ai/sdk @google/genai dotenv`
   — isso fixa as versões atuais no `package.json`. Não travei nenhuma
   versão de propósito, pra não te entregar algo já desatualizado no
   dia em que você rodar.
2. `cp .env.example .env` e preencha `ANTHROPIC_API_KEY` e
   `GEMINI_API_KEY`. **Nunca commite `.env`** — já está no
   `.gitignore` da raiz do repo.
3. `npm run chat -- --agent=navigator-agent`

## Como funciona
- `src/agentloader.js` lê o `.md` do agente — o mesmo arquivo que o
  Claude Code usa — e separa frontmatter do corpo. O corpo vira o
  system prompt. Reaproveita 100% do trabalho já feito nos 16 agentes;
  nenhum agente foi reescrito pra isso funcionar. Também lê
  `model: opus|sonnet` (tier no Claude) e `model_fallback:
  capaz|economico` (tier no Gemini) — o mesmo frontmatter decide o
  tier nos dois providers, sem mapeamento duplicado em outro lugar
  (ver `docs/model-assignment.md` pro critério de quem é o quê).
- `src/providers/claude-provider.js` e `gemini-provider.js` — mesma
  assinatura de função pras duas, cada uma só sabe falar com o próprio
  provider, e cada uma resolve o tier do agente pro nome de modelo real
  daquele provider.
- `src/router.js` — tenta o primeiro provider da ordem
  (`--order=claude,gemini`, padrão), se falhar tenta o próximo. Nunca
  derruba o chat por causa de um provider fora do ar — mesmo princípio
  de "nunca travar" que os agentes já seguem no conteúdo, aplicado
  aqui na camada de infra.
- `src/cli.js` — loop de chat no terminal. `sair` encerra.

## Exemplo de uso
```
npm run chat -- --agent=navigator-agent --order=claude,gemini
[runtime v0] agente: navigator-agent — ordem de provider: claude → gemini
tier: Claude=sonnet · Gemini=capaz
Você: cliente quer um site pro salão dele, 15k, 30 dias
navigator-agent (claude/sonnet): Entendido. Esse salão é dele único ou
ele quer vender pra vários salões depois? (se não souber, diga "não sei")
```
Se o Claude falhar (token acabou, rate limit), a mesma pergunta cai
pro Gemini automaticamente — no tier certo pro agente (`fiscal-agent`
continua "capaz" mesmo em fallback; `docs-agent` vai de "econômico").
Ver `docs/model-assignment.md` e `docs/fiscal-protocolo-degradado.md`.

## Resiliência do router (2026-08-16)
`src/router.js` não só cai pro próximo provider — antes disso:
- **Timeout duro** por chamada (`RUNTIME_PROVIDER_TIMEOUT_MS`, default
  60s) — um provider lento não trava o chat pra sempre.
- **Retry curto com backoff+jitter**, só pra erro transiente (rede,
  429, 5xx, sobrecarga) e só dentro do mesmo provider
  (`RUNTIME_RETRY_ATTEMPTS`, default 2 tentativas, 300ms→2s). Erro de
  config (chave ausente, modelo inválido) não tenta de novo — vai
  direto pro failover, não adianta insistir.
- **Circuit breaker por provider** — 3 falhas em 60s
  (`RUNTIME_BREAKER_THRESHOLD`/`RUNTIME_BREAKER_WINDOW_MS`) abre o
  circuito por 30s (`RUNTIME_BREAKER_COOLDOWN_MS`): próximas mensagens
  pulam esse provider direto, sem gastar tempo tentando algo que já se
  provou fora do ar. Fecha sozinho quando o cooldown passa.

Estado do breaker é só em memória, por processo — reinicia o CLI,
reseta. É resiliência de uma sessão de chat, não coordenação entre
processos; isso é decisão consciente, não limitação esquecida — ver
`docs/conhecimento/principios-natureza-orquestrador.md` pro porquê de
não ir além disso agora (exigiria fila persistente e workers
assíncronos — outro sistema, YAGNI enquanto não houver o volume que
justifique).

## Limitações honestas (v0 não finge que não existem)
- **Sem orquestração automática entre agentes.** Um subagente do
  Claude Code não consegue acordar outro subagente — e este runtime,
  fora do Claude Code, também não simula isso ainda. Cada
  `npm run chat -- --agent=X` roda só aquele agente; se o
  `navigator-agent` recomendar acionar `business-agent`, você troca de
  `--agent=` manualmente. Automatizar essa costura é o próximo passo
  real deste runtime — não faz parte deste v0.
- **Sem as red lines mecânicas do Claude Code.** `guard-red-lines.sh`
  e companhia não existem aqui. Se este runtime crescer pra fazer
  ações reais (escrever arquivo, chamar API externa), a disciplina de
  aprovação explícita do diretor precisa ser reconstruída em código —
  não presuma que ela "vem junto".
- **Sem persistência.** Histórico da conversa vive só na memória do
  processo; fechar o terminal apaga tudo. `docs/clientes/<nome>/brief.md`
  continua sendo o registro permanente — grave manualmente por enquanto.
- **Nomes de modelo por tier** (`CLAUDE_MODEL_OPUS`, `CLAUDE_MODEL_SONNET`,
  `GEMINI_MODEL_CAPAZ`, `GEMINI_MODEL_ECONOMICO` — todos opcionais,
  cada um com default no código) verificados contra doc oficial de
  cada provider em 2026-08-16. Confirme de novo antes de confiar —
  isso muda com frequência, e um scaffold parado numa gaveta por meses
  vai ficar com modelo desatualizado.
- **Tier "econômico" não testado empiricamente ainda** — a hipótese
  (instrução rígida fecha a maior parte do gap de capacidade em tarefa
  compliance-bound) está em `docs/model-assignment.md`, mas ninguém
  rodou os 5 agentes econômicos em Gemini de verdade e comparou saída.
  Ver `docs/gemini-contract.md`.
