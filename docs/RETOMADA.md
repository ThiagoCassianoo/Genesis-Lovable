# Retomada — 2026-08-20 16:20

## Tarefa em curso
task_id: `fabrica-agentes-v1-runtime-fix`
Objetivo: fábrica de 16 agentes com camada determinística (`runtime/`)
funcionando de ponta a ponta, versionada no GitHub, com pelo menos 1
agente provado rodando com chamada real de IA. Não é projeto de
cliente — é a construção da própria fábrica.
Etapa do fluxo: fora do ciclo de cliente (construção de ferramenta
interna). Dentro da fábrica em si, equivalente à Etapa 6 (Fechamento)
de um ciclo de manutenção — 3 bugs reais corrigidos, testados,
auditados e commitados.

## Feito (com evidência)
- 3 bugs reais corrigidos nesta sessão, todos com causa raiz
  confirmada por execução, não por leitura de comentário:
  1. `.claude/hooks/guard-red-lines.sh` — `command -v python3` dava
     positivo no "App execution alias" fantasma do Windows Store, que
     falha silenciosamente na execução; o hook nunca caía pro `node`
     (que funciona) e a trava de commit/install/rm saía com exit 0 em
     vez de exit 2. Corrigido: checa o status real do interpretador,
     cai pro próximo em qualquer falha inesperada.
  2. `runtime/src/providers/groq-provider.js` — os dois tiers
     (`capaz` e `economico`) usavam modelos desligados pela Groq em
     2026-08-16. Trocados por `openai/gpt-oss-120b`/`gpt-oss-20b`.
  3. Rename órfão `agent-loader.js` → `agentloader.js` — 5 imports
     quebrados corrigidos, `npm test` não rodava antes disso.
  → `docs/decisoes.md`, 4 entradas datadas 2026-08-20.
- `npm test` em `runtime/`: **173/173 checagens verdes** (106
  self-test + 26 router + 41 orchestrator), incluindo 2 guardas de
  regressão novas (Groq morto, `git ls-files` do bit +x).
- `.claude/commands/rodar.md` criado — 1 comando que encadeia as
  Etapas 1-6 sem pausa entre elas (regra vigente desde 2026-08-16), pra
  reduzir input manual do diretor. `fiscal-agent` reprovou a 1ª versão
  (faltava Conselho, `infra-agent`, gravação do brief, log de
  delegação por agente; afirmava incorretamente que "descartar
  trabalho" tem desbloqueio) — corrigido nos 5 pontos, confirmado por
  releitura. Listado em `CLAUDE.md` § Comandos.
- `CLAUDE.md` ganhou seção "Regras de ouro — economia de sessão" (7
  regras de uso pessoal). 2 delas colidiam com regras 🔒 existentes —
  ajustadas com precedência explícita, registrada em `docs/decisoes.md`.
- **Commit `c7b86df` feito** (65 arquivos) — 1º commit desde
  2026-08-16, com marcador do `fiscal-agent` validado 3x (2 reprovações
  reais corrigidas no meio do caminho, não maquiadas).
- **Remoto configurado e sincronizado**: `origin` →
  `https://github.com/ThiagoCassianoo/Genesis-Lovable.git`. Merge com
  histórico não-relacionado (o repo já tinha conteúdo de um projeto
  Lovable — `.lovable/`, `bun.lock`, `AGENTS.md` etc.) resolvido pelo
  próprio Thiago no terminal, commit `0b6249d`. `git status -sb`
  confirma `main...origin/main` sem divergência.
- **Prova real de agente funcionando**: `npm run testar:navigator`
  (dentro de `runtime/`) rodou o `navigator-agent` de ponta a ponta com
  cliente fictício, 5 turnos, via Groq→Cerebras (chave grátis, **não**
  consome limite do Claude Code), resultado `✅ PASSOU`. Transcript em
  `runtime/logs/testes/navigator-agent-2026-08-20T14-20-41-185Z.txt`.

## Feito nesta 2ª rodada (economia de sessão, 2026-08-20 ~16h)
- `CLAUDE.md` reduzido de 222 → 131 linhas: cortadas 3 narrativas
  históricas (ficaram só em `docs/decisoes.md`), o exemplo ilustrativo
  do fim, tabelas enxutas. As 8 Regras de Ouro numeradas e os 🔒
  ficaram intactos (citados por número em outros arquivos). Regra 1 de
  economia de sessão reforçada pra cobrir "pasta", não só "arquivo".
- **Status line configurada** (`~/.claude/settings.json`, via agente
  `statusline-setup`) — mostra contexto da sessão + rate limit semanal
  (`rate_limits.seven_day`) + janela de 5h (`rate_limits.five_hour`;
  não existe campo "diário" no schema — por isso "5h", não "Dia").
  Formato: `Contexto: X% usado (Y% livre) . Semana: Z% . 5h: W%`.
  **Não confirmado visualmente ainda** — o comando depende de `jq`, e
  o `fiscal-agent` não achou `jq` no PATH do bash local (pode ser só o
  shell dele, não o do Claude Code — checar de verdade antes de
  assumir que funciona). Ajuste futuro passa pelo agente
  `statusline-setup`, não editar `settings.json` na mão.
- Descoberto e explicado ao diretor: limite semanal ≠ diário (janelas
  de reset diferentes) — não é bug, é a soma acumulada dos 7 dias vs.
  o dia corrente.
- Recomendado (não feito ainda): `/mcp` pra desativar server MCP
  parado — ação do próprio diretor no terminal, zero custo de token,
  não precisa de mim.
- Adiado por decisão do diretor (orçamento): hook de filtro de output
  verboso — item mais caro da lista original de economia, ainda não
  criado.

## Próximo passo imediato
1. Confirmar visualmente que a status line nova está aparecendo certo
   no terminal (abrir uma sessão nova do Claude Code e olhar).
2. Rodar `/mcp` pra desativar server(s) MCP parado(s) — ação do
   diretor, zero custo, ainda não feita.
3. Se/quando quiser: hook de filtro de output verboso — adiado por
   orçamento, é o item mais caro que sobrou da lista de economia.

Independente disso, pro trabalho de fábrica em si (não economia de
sessão): `npm run testar:navigator` já provou 1 agente funcionando de
ponta a ponta grátis; o passo seguinte é repetir esse teste (ou
`npm run chat -- --agent=<nome>`) pros outros 15, um a um — não existe
hoje orquestração automática entre eles fora do Claude Code. Rodar
isso não passa pelo Claude Code, não gasta limite.

## Bloqueado, aguardando decisão
- **Orquestração automática entre agentes no `runtime/`** → decide:
  Thiago (quando quiser voltar a investir nisso) → recomendação padrão:
  não é urgente, o `runtime/` já prova o conceito (1 agente, chave
  grátis, sem tocar no limite do Claude Code); expandir pra 16 é
  trabalho novo, não bug.
- **Conteúdo do repositório Genesis-Lovable pré-existente** → o merge
  trouxe um projeto Lovable inteiro (`.lovable/`, `PROJECT_STATE.md`,
  `AGENTS.md`) pra dentro deste repo da fábrica de agentes. Não avaliei
  se isso é intencional (2 projetos no mesmo repo) ou se deveria ter
  ficado separado → decide: Thiago → sem isso, não dá pra saber se
  `docs/arquitetura-repo1-repo2.md` (proposta de repo 1 = fábrica /
  repo 2 = entregável por cliente) ainda faz sentido do jeito que foi
  desenhada.

## Decisões desta sessão ainda não registradas
Nada — a entrada sobre o enxugamento do `CLAUDE.md` e o uso de
`--no-verify` acabou de ser gravada em `docs/decisoes.md` (mesma
rodada deste registro).

## Arquivos tocados
Commit `c7b86df` (65 arquivos, `git show --stat c7b86df`). Commit
`0b6249d` — merge do histórico não-relacionado do GitHub, feito por
Thiago diretamente no terminal, arquivos não revisados por mim.
Commit `567f3c7` — `CLAUDE.md` + `docs/RETOMADA.md` (enxugamento),
feito por Thiago com `git commit --no-verify` (rotina de
infraestrutura, sem entrega de agente — uso previsto pelo próprio
`.githooks/pre-commit`). Resumo por tema em `docs/decisoes.md`.

## Contexto mínimo para retomar
Este repositório agora tem 2 históricos de origem diferente mesclados:
a fábrica de 16 agentes (o que este projeto sempre foi) + um projeto
Lovable pré-existente que morava no GitHub remoto
(`Genesis-Lovable`) antes do primeiro push. `runtime/` roda com chave
de API própria (Groq/Cerebras grátis, Anthropic/Gemini pagas),
separada do limite de uso do Claude Code — testar agentes por ali não
gasta o limite semanal/5h da sessão (não existe janela "diária" real,
só 5h e 7 dias — ver status line).

## O que NÃO fazer ao retomar
- Não assumir que `docs/arquitetura-repo1-repo2.md` (proposta repo 1 /
  repo 2) ainda reflete a realidade — o merge com o Genesis-Lovable
  pode ter mudado a pergunta. Confirmar com Thiago antes de tratar como
  decisão fechada (já era PREMISSA antes disso).
- Não reabrir os 3 bugs corrigidos nesta sessão sem ler
  `docs/decisoes.md` primeiro — a causa raiz de cada um já está
  documentada com evidência, inclusive uma revogação registrada (o
  bit de execução dos hooks "consertado" que na verdade não tinha sido,
  achado pelo próprio `fiscal-agent` numa 2ª auditoria).
- Não gastar o próximo `npm test`/`npm run testar:*` achando que precisa
  confirmar de novo o que já passou — só rerrode se algo em
  `runtime/src/` ou `.claude/hooks/` mudar depois deste registro.

---
**[AVISO AUTOMÁTICO — session-end.sh]** Sessão encerrada em 2026-08-20T15:58:50Z (motivo: other).
