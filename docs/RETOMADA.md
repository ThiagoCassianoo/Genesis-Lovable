# Retomada — 2026-08-16

## Tarefa em curso
task_id: `fabrica-agentes-v1`
Objetivo: fechar o pacote de agentes da Missões Tech (16 agentes,
regras, hooks, comandos) e entregar o zip para o ambiente operacional
(Codespace). O pacote é a fábrica — não é o site nem o sistema de
nenhum cliente.
Etapa do fluxo: fora do ciclo de cliente. É construção da própria
fábrica.

**Visão maior, esclarecida em 2026-08-16:** este repositório (repo 1)
é o cérebro fixo — onde entra o problema cru de qualquer cliente, fica
registrado o histórico (brief, decisões, lições) e sai o brief que dá
origem ao repo 2 (a solução daquele cliente, a que vai pro ar). Thiago
não quer depender só do Claude Code — quer o time de agentes rodando
numa interface própria, funcionando com Claude OU Gemini. O scaffold
v0 disso já existe (`runtime/`) — ver "Feito" e "Próximo passo
imediato" abaixo.

## Feito (com evidência)
- 16 agentes com frontmatter completo → `.claude/agents/*.md`
- Regras consolidadas em 5 arquivos → `.claude/rules/`
- 9 comandos → `.claude/commands/`
- Hooks testados: red lines bloqueia com exit 2, observabilidade grava
  JSONL sanitizado → `.claude/hooks/`
- Arquitetura de referência do agendamento (978 linhas, SQL real) →
  `docs/arquitetura-agendamento.md`
- Conselho rodou de verdade uma vez, na decisão de stack →
  `docs/decisoes.md`, seção "Deliberação do Conselho"
- Memória entre sessões → `docs/decisoes.md`, `docs/conhecimento/`
- Histórico completo do que foi corrigido/criado em 2026-08-16 (fix do
  `business-agent`; criação e depois substituição do `intake-agent`
  pelo `navigator-agent`; `runtime/` v0; fiscalização "Alucinação
  técnica"; proposta de arquitetura repo 1/2) → `docs/decisoes.md`,
  seções datadas 2026-08-16. Não repito a narrativa aqui — fonte
  única é lá.
- `runtime/` — CLI Node.js v0 que carrega `.claude/agents/*.md` e
  conversa com Claude ou Gemini (failover automático, tier por
  agente). Testado nesta sessão de verdade: `npm install` rodou (49
  pacotes, versões reais resolvidas pelo npm, não hardcoded), pipeline
  completo (`agent-loader` → `router` → `sendMessage`) executado contra
  `fiscal-agent` e `implementation-agent` — chegou até a chamada real
  de API, falhou só por falta de chave (esperado, chave é do Thiago).
  Falta só o teste com chave de verdade, no terminal dele. Ver
  `runtime/README.md` pras limitações honestas do v0.
- `.claude/agents/fiscal-agent.md` ganhou a fiscalização "1b.
  Alucinação técnica" (bloqueia entrega, mesma força de GENÉRICO/SEM
  EVIDÊNCIA) e `agent-contracts.md` ganhou o mesmo princípio como regra
  preventiva (item 3).
- `docs/arquitetura-repo1-repo2.md` — proposta de estrutura (repo 2 =
  1 por entregável deployável, não por cliente; banco de dados fica
  pra quando markdown não bastar). Marcada como PREMISSA, não decisão
  fechada — Thiago ainda não confirmou.
- **Tier de modelo por agente** — todo agente tem `model_fallback:
  capaz|economico` no frontmatter agora, ao lado do `model: opus|sonnet`
  que já existia. `runtime/` usa os dois pra escolher o modelo real em
  cada provider. Critério e tabela completa →
  `docs/model-assignment.md`; hipóteses sobre comportamento cross-model
  (não validadas) → `docs/gemini-contract.md`; regras extras de
  auditoria em modo degradado → `docs/fiscal-protocolo-degradado.md`.
  Diverge do que Thiago propôs em 2 pontos (`fiscal-agent` ficou capaz,
  não econômico — motivo em `docs/model-assignment.md`) — ele ainda
  não confirmou se concorda com a divergência.
- **Padrão de excelência always-on** — `quality-gates.md` (já
  `@import`ado sempre pelo `CLAUDE.md`) ganhou seção nova com as 6
  fiscalizações do `fiscal-agent` reescritas em 1ª pessoa, como o que
  cada agente garante antes de devolver, não o que o fiscal acha
  depois. Confirmado por doc oficial nesta sessão: subagente herda
  `CLAUDE.md` inteiro automaticamente (incluindo `@import`s), sem
  precisar de `skills:` nem invocação nenhuma. `fiscal-agent` continua
  na Etapa 5 como rede de segurança. Decisão completa →
  `docs/decisoes.md`, seção "Padrão de excelência always-on".
- **Bug real encontrado e ainda NÃO corrigido, de propósito** —
  `swarm-planner/SKILL.md` e `parallel-task/SKILL.md` usam
  `metadata: invocation: explicit-only`, campo que a doc oficial
  confirma que o Claude Code **não lê** (metadata é livre, sem efeito).
  O campo certo é `disable-model-invocation: true` na raiz do
  frontmatter. Deixado pro Thiago corrigir com a mão — ele pediu pra
  não corrigir sozinho de cara quando algo quebra, quer ser guiado.
  Ver "Próximo passo imediato" abaixo pro passo a passo.
- **Stack de backend aprovada** — Supabase, uma instância por cliente,
  pagamento fora do v1, com as 5 condições. `backend-master.md` e
  `CLAUDE.md` atualizados. `backend-master` desbloqueado: não precisa
  mais recomendar stack a cada projeto, só modelar o domínio
  específico. Decisão completa → `docs/decisoes.md`, seção "Stack de
  backend aprovada".
- **`runtime/src/router.js` ganhou resiliência de verdade** — timeout
  60s por chamada, retry curto com backoff+jitter só pra erro
  transiente, circuit breaker por provider (3 falhas/60s abre por
  30s). Testado nesta sessão sem API key: erro de config falha em ~1ms
  sem retry desperdiçado, e a 4ª chamada ao mesmo provider bate no
  circuito aberto em 0ms. `README.md` e `.env.example` do `runtime/`
  atualizados. Motivo e o que ficou de fora (fila/workers assíncronos,
  por quê) → `docs/conhecimento/principios-natureza-orquestrador.md`.
- **`creative-agent.md` reforçado** — ordem interna obrigatória (não
  pula pra visual antes de entender problema/fluxo/arquitetura), seção
  "Modo verdade (truth mode)", 9 estados de interface (era 3),
  classificação de interação roteando pra `backend-master`/
  `infra-agent`/`security-agent`, contrato de entrada mais completo,
  condições de parada explícitas. Adaptado de documento externo do
  Thiago, com 3 pontos conscientemente descartados por conflito com
  regra existente (agente falando direto com cliente, duplicar
  `reviewer-agent`, "especialista MCP" inexistente no time) — detalhe
  completo em `docs/decisoes.md`, seção "Reforço do creative-agent".
- **Diagnóstico completo do repositório (só leitura) + 4 hooks novos,
  todos testados de verdade nesta sessão.** Achado mais grave: a pasta
  não é repositório git — a trava de commit (`guard-red-lines.sh` +
  marcador do `fiscal-agent`) fica incapaz de distinguir diff mudado
  de diff igual (`git diff --cached` erra fora de repo git). Achado 2:
  `supabase/migrations/` (14 arquivos SQL reais) existe sem nenhum
  registro em `docs/decisoes.md` até esta sessão — origem exata não
  verificável, fica pendente de esclarecimento do Thiago, não é
  acusação. A partir do diagnóstico, construí (com aprovação explícita
  em 3 perguntas):
  - `guard-red-lines.sh` — install/rm/deploy ganharam **desbloqueio
    real** via marcador de uso único (`/aprovar`, novo comando), igual
    ao padrão que o commit já tinha. Antes, essas 3 ações eram
    bloqueio permanente mesmo com aprovação no chat.
  - `guard-retry-loop.sh` (novo) — Regra de ouro 7 mecanizada: mesmo
    comando falhando 2x na sessão bloqueia a 3ª tentativa.
  - `guard-decisoes-lida.sh` (novo) — Regra de ouro 8 mecanizada:
    bloqueia o fim da execução de 7 agentes titulares se não houver
    sinal de terem lido `docs/decisoes.md` (heurística de transcript,
    limitação documentada no próprio hook).
  - `check-retomada-antes-compactar.sh` + `inject-retomada-ao-resumir.sh`
    (novos) — continuidade automática: bloqueia compactação se
    `RETOMADA.md` não foi atualizado hoje, injeta `RETOMADA.md`
    sozinho ao retomar sessão. Não existe "80% exato" — Claude Code
    não expõe isso a hook (confirmado, issue aberto no GitHub
    oficial), este é o sinal nativo mais próximo.
  - Regras 2, 3, 4, 5, 6 ficaram **de propósito sem hook** — julgamento
    semântico, hook erraria mais do que ajudaria; continuam com
    `fiscal-agent`/`reviewer-agent`.
  `.claude/settings.json` registra os 4 hooks novos. `CLAUDE.md`
  (Regras de ouro, marcador 🔒) e `README.md` (comandos, mecânica de
  bloqueio, continuidade, estado atual da stack) atualizados juntos.
  Detalhe completo → `docs/decisoes.md`, 3 seções datadas desta rodada.

## Próximo passo imediato

**`git init` feito, zip entregue.** Branch `main`, primeiro commit
(99 arquivos). Achado ao vivo importante durante isso, registrado em
`docs/decisoes.md`: `.claude/hooks/*` só trava dentro de uma sessão
real do Claude Code CLI — esta sessão (Cowork) não passa por ali, meu
primeiro `git commit` passou sem gate. Quem trava commit de qualquer
lugar (terminal, Codespace) é `.githooks/pre-commit` (hook nativo do
git), que precisa de `git config core.hooksPath .githooks` — **não
vem ativado sozinho ao clonar/copiar o repo, é config local, não
versionada**. Ativado aqui e testado (bloqueia sem marcador de
fiscal). **No Codespace, rodar esse `git config` de novo é obrigatório
— primeira coisa a fazer, senão a trava de commit não existe lá.**

Zip entregue via `SendUserFile`, com `.git` (baseline já commitado) e
sem `runtime/node_modules/` (regenerar com `npm install`).

**Fix guiado — `disable-model-invocation` nos 2 skills.** Passo a passo
pro Thiago (não corrigir por ele):
1. Abrir `.claude/skills/swarm-planner/SKILL.md`.
2. No frontmatter (entre os `---`), apagar o bloco `metadata:` inteiro
   (as 2 linhas `invocation: explicit-only` e `adaptado_de: ...`).
3. Adicionar `disable-model-invocation: true` como campo solto, na
   raiz do frontmatter (mesmo nível de `name:`/`description:`).
4. Repetir os 3 passos em `.claude/skills/parallel-task/SKILL.md`.
5. Se quiser manter o `adaptado_de: am-will/swarms` como referência,
   ele pode continuar dentro de `metadata:` (esse campo é livre, só não
   controla comportamento) — só o `invocation:` precisa sair de lá.

**Zip desatualizado — pendente, aguardando o Thiago pedir.** O zip que
o Thiago tem em mãos (70 arquivos, 2026-08-15) é anterior a tudo que
foi feito em 2026-08-16, incluindo o `runtime/` inteiro. Quando ele
mandar: gerar novo zip com todos os arquivos tocados hoje (ver
`docs/decisoes.md`) e entregar via SendUserFile. **Excluir
`runtime/node_modules/`** do zip (50MB, regenerável com `npm install`,
não deve ir junto).

**Testar de verdade no terminal dele — próximo passo real do Thiago,
não meu.** O pipeline já rodou de verdade nesta sessão até faltar
chave de API (ver "Feito"). O que só ele consegue fazer: colocar as
duas API keys no `.env` e rodar `npm run chat -- --agent=navigator-agent`
pra validar ponta a ponta, incluindo o failover Claude→Gemini de
verdade e o comportamento real de cada tier.

**Testar o Navigator em conversa (aqui no Claude Code) também
continua de pé** — oferecido, ainda não aconteceu. Pode ser feito em
paralelo ao teste do runtime; são validações diferentes (uma testa o
*conteúdo* do agente, a outra testa o *runtime* que o executa fora
daqui).

**Repo 1 / repo 2 — proposta escrita, aguardando confirmação.**
`docs/arquitetura-repo1-repo2.md` tem a recomendação completa (repo 2
= 1 por entregável deployável, histórico centralizado no repo 1,
banco de dados só quando markdown não bastar mais). Registrada como
PREMISSA meu, não decisão fechada. Quando Thiago confirmar ou corrigir,
promover pra `docs/decisoes.md` como decisão de verdade.

**Runtime multi-modelo — v0 construído, falta orquestração entre
agentes.** O scaffold já resolve "conversar com um agente usando
Claude ou Gemini com failover". O que ainda não existe: acordar um
agente a partir da recomendação de outro automaticamente (hoje é
manual — trocar `--order`/`--agent` na mão). Isso é o próximo passo
real do runtime, não deste v0. Continua valendo: não expandir o
runtime pra fazer ações reais (escrever arquivo, chamar API de
terceiro) sem reconstruir a disciplina de aprovação em código — as
red lines do Claude Code não existem lá fora.

## Bloqueado, aguardando decisão
- **Ticket e custo mensal por cliente** → decide: Thiago → sem isso o
  `infra-agent` não fecha conta de margem.
- **Estrutura repo 1 / repo 2** → decide: Thiago → confirmar ou
  corrigir `docs/arquitetura-repo1-repo2.md`.

## Plano combinado pro Codespace (2026-08-16)
Thiago definiu a sequência de quando ele subir o repo no Codespace —
registrado aqui pra a sessão de lá seguir sem reperguntar:
- **Chaves de API** — não pedir agora. Pedir `ANTHROPIC_API_KEY` e
  `GEMINI_API_KEY` só no momento em que ele estiver montando o
  `runtime/.env` de verdade no terminal do Codespace (resolve também o
  antigo pendente "chave do Gemini: AI Studio vs Vertex" — ele decide
  isso na hora, ao gerar a chave).
- **Teste do chat** — não vai ser só terminal. Depois de subir o
  Codespace e dar o primeiro commit lá, o plano é gerar uma página
  visual (frontend simples) pra testar o `runtime/` por ali, não só
  via `npm run chat` no terminal. Ainda não desenhado — é trabalho novo
  quando chegar a hora, não existe hoje nenhum HTML/servidor no
  `runtime/`.

## Decisões desta sessão ainda não registradas
Nada pendente — tudo foi para `docs/decisoes.md` conforme aconteceu.

## Arquivos tocados
Ver `docs/roadmap-time.md` (histórico até 2026-08-15) e
`docs/decisoes.md` (2026-08-16 em diante) — registro cronológico
completo do que foi construído e por quê.

## Contexto mínimo para retomar
Missões Tech é consultoria profissional cristã (tecnologia para
igrejas, ministérios e empreendedores). O diretor constrói por prompt,
não escreve código à mão. Subagents são o padrão, Agent Teams é
exceção cara. O orquestrador nunca é agente — subagente não acorda
subagente. Nenhum projeto de cliente existe ainda: só a fábrica.

## O que NÃO fazer ao retomar
- Não instalar framework de orquestração (ECC, superpowers inteiro,
  LangChain, NeMo Guardrails). Já avaliados e rejeitados: são runtimes
  ou sistemas concorrentes. Conceito serve, framework não.
- Não criar agente para produto — sobrepõe o `business-agent`.
- Não apagar `docs/_quarentena/` ainda (nem `docs/_quarentena/agents/`,
  onde está o `intake-agent` deprecado): aguarda uma rodada de uso.
- Não reabrir a numeração do fluxo: fonte única é
  `.claude/rules/orchestration.md`.
- Não assumir stack de backend antes do "aprovado" do diretor.
- Não tratar `docs/arquitetura-repo1-repo2.md` como decisão fechada —
  é proposta/PREMISSA até Thiago confirmar.
- Não expandir `runtime/` pra fazer ação real (escrever arquivo,
  chamar API externa, gastar dinheiro) sem antes reconstruir em
  código a disciplina de aprovação que os hooks do Claude Code dão de
  graça aqui — lá fora isso não vem junto.

---
**[AVISO AUTOMÁTICO — session-end.sh]** Sessão encerrada em 2026-08-20T12:31:12Z (motivo: other).
O cabeçalho deste arquivo não é de hoje — provável que `/retomar` não
rodou nesta sessão. Trate o conteúdo acima como potencialmente
desatualizado. Transcript bruto desta sessão: `C:\\Users\\Lenovo\\.claude\\projects\\c--Users-Lenovo-Desktop-Thiago-Aux-Nova-pasta-missoes-tech-agentes\\b546cb18-5430-4c85-8168-2ffad66a13c3.jsonl`.
Próxima sessão: confira `git log --oneline -5` antes de assumir que
este arquivo reflete o estado real do repositório.

---
**[AVISO AUTOMÁTICO — session-end.sh]** Sessão encerrada em 2026-08-20T12:32:02Z (motivo: other).
O cabeçalho deste arquivo não é de hoje — provável que `/retomar` não
rodou nesta sessão. Trate o conteúdo acima como potencialmente
desatualizado. Transcript bruto desta sessão: `C:\\Users\\Lenovo\\.claude\\projects\\c--Users-Lenovo-Desktop-Thiago-Aux-Nova-pasta-missoes-tech-agentes\\83c37ea3-b9fe-4a80-8a8d-2766666d8662.jsonl`.
Próxima sessão: confira `git log --oneline -5` antes de assumir que
este arquivo reflete o estado real do repositório.
