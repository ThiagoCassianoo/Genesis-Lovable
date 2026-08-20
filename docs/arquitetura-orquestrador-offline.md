# Orquestrador offline — arquitetura (proposta, não construída)

**Status: DESENHO aprovado pra construção, ainda sem código.** Thiago
aprovou a ideia em 2026-08-16 ("pode entrar como apoio? 1 rodar o
offline e só deixa os setores mais críticos com modelo de IA pra
confirmar tudo que foi feito e entregar ao cliente") e pediu garantia
de que funciona antes de codar — este documento é essa garantia:
desenho + onde cada peça já existe hoje + o que falta + como eu vou
provar que funciona antes de considerar pronto.

## O problema que isso resolve

Hoje, toda decisão do fluxo — "qual agente entra agora", "essa etapa
pode avançar", "isso já está no formato certo" — depende de um LLM
interpretar `.claude/rules/orchestration.md` de novo a cada chamada.
Isso é caro (token) e é um ponto de falha (se todo provider de IA
cair, o sistema para completamente, mesmo pra decisão que não precisa
de julgamento nenhum).

**Confirmado ao vivo em 2026-08-16, não é só teoria:** Thiago tentou
rodar uma conversa real pelo `runtime/` e o token acabou antes de
chegar no 3º agente. Causa raiz encontrada e corrigida no mesmo dia: o
`cli.js` mandava o **histórico inteiro** da conversa a cada turno, sem
limite — turno 10 pagava o peso de todos os 9 anteriores de novo.
Corrigido com uma janela deslizante (`trimHistory`, `RUNTIME_MAX_HISTORY_TURNS`,
default 6 turnos) — testado em `self-test.mjs` sem precisar de chave
de API. Isso já reduz o sintoma. Mas é só metade do problema: o
histórico cortado ainda manda texto cru; o resto — mandar **contexto
resumido e estruturado**, não a transcrição bruta — é o papel do
Context Engine abaixo, ainda não construído.

## Princípio: separar "sequência" de "conteúdo"

A trilha de agentes (Etapa 1 → 2 → 3..., quem pode escrever onde, gate
de aprovação) é **lógica determinística conhecida** — já está escrita
em `.claude/rules/orchestration.md` como regra fixa, não como algo que
precisa de interpretação nova a cada execução. Isso pode virar código
puro, sem LLM. O que **exige** IA é: entender o pedido cru do Thiago,
gerar conteúdo (copy, código, análise), e confirmar que uma entrega
está correta antes de ir pro cliente.

```
                    ┌─────────────────────────────┐
                    │   orchestrator-core (Node)   │  ← SEM IA, sempre disponível
                    │   runtime/src/orchestrator/  │
                    └───────────┬─────────────────┘
                                │ lê fila de tarefas + estado da etapa
                                │ decide: próximo agente? pode avançar?
                                ▼
              ┌─────────────────────────────────────┐
              │  Ponto crítico? (gate/confirmação)    │
              └───────┬───────────────────┬───────────┘
                  não  │                   │  sim
                       ▼                   ▼
              enfileira e segue      chama IA via router.js
              (zero chamada de IA)   (Claude→Groq→Cerebras→Gemini,
                                      já existe e testado)
```

## O que já existe hoje e a nova peça reaproveita (não recria)

- `runtime/src/router.js` — decide qual IA responde, já com fallback e
  circuit breaker. O orquestrador chama isso SÓ quando decidir que
  precisa de IA — não muda nada aqui.
- `runtime/src/agent-loader.js` — já sabe ler contrato de cada agente.
  O orquestrador usa isso pra saber o `model`/`model_fallback` de quem
  ele vai chamar.
- `.claude/rules/orchestration.md` — já documenta a sequência em
  texto. O orquestrador determinístico é esse mesmo fluxo, convertido
  de "regra que um LLM lê e interpreta" pra "regra que o código já
  sabe sem perguntar pra ninguém".

## Peça nova: `runtime/src/orchestrator/`

- **`fila.js`** — fila de tarefas em disco (JSON simples, mesmo
  espírito do `usage.jsonl`: append-only, sobrevive a reinício). Cada
  item: `{ etapa, agente, input, status: pendente|em-andamento|feito|bloqueado }`.
- **`sequencia.js`** — a máquina de estado determinística: dado o
  status atual, decide o próximo passo, SEM chamar IA. Ex.: "Etapa 1
  (discovery) terminou → próximo é Etapa 2 (análise dos especialistas),
  não Etapa 5". Isso é `if/switch` puro, testável sem rede.
- **`gate.js`** — identifica pontos críticos (aprovação do diretor,
  entrega ao cliente, qualquer ação das Regras de Ouro 1/7/8) e é
  **só aqui** que o orquestrador chama `router.js`. Tudo que não é
  gate roda sem gastar um token de IA.
- **`worker.js`** — loop principal: lê a fila, avança o que pode
  avançar sozinho, chama IA só nos gates, escreve resultado de volta
  na fila. Se toda IA cair (Claude e os 3 fallbacks), ele **não trava
  o sistema** — marca o item como `bloqueado-sem-ia` e continua
  processando qualquer outro item da fila que não dependa de IA nesse
  momento (ex.: reorganizar prioridade, mover item pra próxima etapa
  que só depende de aprovação já dada).
- **`context-engine.js`** — extrai o template compacto da saída de
  cada agente antes de repassar pro próximo (ver seção Context Engine
  abaixo). Reaproveita o mesmo parser de formato fixo que
  `agent-loader.js` já usa pro frontmatter — não inventa um segundo
  jeito de ler estrutura.
- **`decision-record.js`** — grava `runtime/logs/decisions.jsonl` a
  cada decisão do `gate.js` (ver seção Decision Record abaixo). Mesmo
  padrão append-only do `usage-logger.js`, arquivo próprio porque o
  conteúdo é diferente (decisão, não tokens).

## Context Engine — contexto resumido em vez de transcrição crua

**Origem:** ideia trazida por Thiago de outra conversa (com outro
Claude), validada e integrada aqui — não é sistema separado, é
mais uma responsabilidade do `orchestrator-core`, no mesmo pacote de
`fila/sequencia/gate/worker`.

Problema que resolve: mesmo com a janela deslizante do `cli.js`
(corrige o sintoma de hoje), um fluxo real com 5+ agentes ainda reenvia
prosa livre de um agente pro outro — o próximo agente "relê e
repensa" o que o anterior já concluiu, gastando token em coisa que já
estava decidida.

Solução: em vez de repassar a resposta crua do agente anterior, o
`orchestrator-core` preenche um **template estruturado e compacto**
(campos fixos: `objetivo`, `decisões_tomadas`, `pendências`,
`dados_relevantes`) a partir da saída de cada agente — trabalho
determinístico (extrair campos de uma resposta que já segue formato
fixo, ver `agent-contracts.md`), não julgamento. O próximo agente
recebe o template preenchido, não a transcrição inteira. Ele só volta a
receber texto livre quando o template não é suficiente pra decisão
dele — aí sim manda o texto original junto.

```
Agente A responde (formato fixo, já é regra hoje)
        ↓
extrai campos → template compacto      ← determinístico, sem IA
        ↓
Agente B recebe: template + (texto bruto só se necessário)
```

Isso é a mesma ideia do "GenericNameDetector sem ML" que aparece no
material que Thiago trouxe: não usar IA pra tarefa que é extração de
campo de um texto com formato já conhecido.

## Decision Record — rastreabilidade de cada decisão

**Origem:** mesma conversa externa, ideia boa, incorporada aqui em vez
de virar documento à parte.

Cada vez que o `gate.js` decide algo (avançar sozinho vs. chamar IA;
aprovar vs. bloquear), ele grava uma linha — mesmo formato JSONL do
`usage.jsonl`, mesmo espírito (append-only, nunca reescreve) — em
`runtime/logs/decisions.jsonl`:

```json
{"ts":"...","etapa":4,"agente":"implementation-agent","fonte":"ferramenta","evidencia":"self-test.mjs: 42/42 ok","ia_usada":false,"decisao":"avança sozinho"}
{"ts":"...","etapa":5,"agente":"security-agent","fonte":"ia","evidencia":"npm audit: 3 vulnerabilidades","ia_usada":true,"motivo":"classificar severidade e prioridade","decisao":"corrigir 2, aceitar 1 com justificativa"}
```

Regra que isso implementa (do material externo, e concordo): **IA
nunca é a fonte da evidência quando uma ferramenta já produz a
evidência.** `npm audit` encontra a vulnerabilidade (fato); IA
classifica prioridade (julgamento). O Decision Record é o que separa
essas duas coisas de forma auditável — não é só log, é prova pro
cliente de que "essa decisão veio de ferramenta X, essa outra exigiu
julgamento e por quê".

Isso não substitui `docs/decisoes.md` (que é a memória de decisões do
**diretor**, entre sessões) — é a memória de decisões **operacionais**
do sistema, por execução. Complementares, escopos diferentes.

## IA Gate — regra de decisão, aplicada nos 16 agentes reais (Bloco 1, 2026-08-17)

**Origem:** Thiago trouxe de outra conversa o princípio "nível mais
simples que resolve o problema" (Static Analysis → Heurística → ML →
LLM) e pediu que isso virasse regra aplicada de verdade, não teoria.
Abaixo é o mapeamento real, agente por agente — lido de
`.claude/agents/*.md`, não inventado.

**A régua (4 níveis, do mais barato pro mais caro):**
1. **Determinístico** — hash, parser, comando de shell, lint, teste.
   Mesma entrada → mesma saída, sempre. Zero token.
2. **Heurístico** — regra com limiar (nome de função > 40 caracteres é
   "suspeito de genérico"; arquivo > 300 linhas é "candidato a
   quebrar"). Zero token, mas pode errar — por isso vira **sinal pra
   IA olhar**, não veredito sozinho.
3. **IA sobre evidência já extraída** — a IA recebe achado de
   ferramenta (não o projeto inteiro) e julga: prioridade, risco,
   adequação ao negócio. É onde token é bem gasto.
4. **IA sem ferramenta nenhuma** — hoje é o padrão de quase todo
   agente titular (business, creative, technical...). É caro porque a
   IA "pensa em voz alta" sobre algo que às vezes já está decidido em
   `docs/decisoes.md` ou é extraível por regra.

**Mapeamento agente por agente — o que dá pra empurrar pra nível 1/2
antes de chamar IA:**

| Agente | Hoje (nível 4, só IA) | Empurra pra determinístico/heurístico | Fica em IA (nível 3) |
|---|---|---|---|
| `navigator-agent` | Toda a conversa de intake | Nada — é conversa com humano, natureza é julgamento | Tudo (correto ficar aqui) |
| `business-agent` | Diagnóstico de oferta/público do zero toda vez | Ler `docs/decisoes.md`/`docs/clientes/<nome>/manifest.md` primeiro (grep, não IA) e só mandar pra IA o que NÃO está lá ainda | Diagnóstico real, novo |
| `creative-agent` | Revisão de copy/UX inteira | Linter de anti-padrão (Regra 4 do `CLAUDE.md`: "gradiente roxo", "hero centralizado" — busca de string/regex nos arquivos) roda ANTES; IA só julga o que passou no filtro | Julgamento de direção de arte |
| `technical-agent` | Arquitetura + performance + SEO + a11y, tudo em prosa | Lighthouse/bundle-analyzer/axe-core rodam primeiro (determinístico, números reais); IA interpreta o resultado, não estima | Trade-off de arquitetura |
| `backend-master` | Modelagem de dado do zero | `Supabase Advisor` (já mencionado em `docs/decisoes.md`) roda primeiro — RLS disabled, tabela sem policy são fatos, não opinião | Decisão de schema nova |
| `marketing-master` | Jornada inteira em prosa | Nada de determinístico óbvio ainda — é diagnóstico de negócio, natureza é julgamento | Tudo (correto ficar aqui) |
| `infra-agent` | Checklist de deploy em prosa | Boa parte já é checklist fixo (`model_fallback: economico` no frontmatter já reconhece isso) — pode virar script de verificação (`curl` de healthcheck, `dig` de DNS) que só reporta pra IA o que falhou | Decisão de rollback/incidente |
| `implementation-agent` | Escreve código com IA sozinha decidindo | Lint/type-check/test rodam DEPOIS de cada edição, automaticamente — hoje isso já é prática mas não está automatizado no fluxo | Escrever o código em si |
| `docs-agent` | Registra decisão em prosa | É quase tudo mecânico (copiar campo pra template) — candidato mais forte a virar 100% determinístico com IA só formatando texto livre | Resumo em prosa de post-mortem |
| `qa-agent` | Testa fluxo "pensando" | Rodar `npm test`/Playwright primeiro (fato: passou/falhou); IA só entra pra desenhar caso de borda novo que o teste não cobre | Desenho de caso de teste novo |
| `security-agent` | Analisa vulnerabilidade em prosa | `npm audit` + `Semgrep` + secret scanner rodam primeiro (evidência real); IA classifica severidade/prioridade, não "acha que tem vulnerabilidade" | Classificação de risco e prioridade |
| `reviewer-agent` | Revisão visual/conversão em prosa | Screenshot + Lighthouse + axe-core geram números; IA julga o que número sozinho não julga (ex.: "essa copy converte?") | Julgamento de conversão |
| `fiscal-agent` | Compara entrega com documentação, em prosa | Boa parte é grep — "essa etapa prometeu X em `docs/`? existe evidência de X no output?" é comparação de texto, não julgamento | Achar genérico/vago que grep não pega |
| `conselho-*` (3) | Deliberação em prosa | Nada — é o ponto do sistema desenhado pra ser 3 julgamentos independentes | Tudo (correto ficar aqui, por design) |

**Regra geral extraída da tabela:** todo agente que audita/verifica
contra um padrão fixo (`qa`, `security`, `reviewer`, `fiscal`,
`docs-agent`) tem alta % de trabalho empurrável pra determinístico —
são "compliance-bound" segundo `docs/model-assignment.md`, o mesmo
critério que já existe no sistema, só que ainda não tinha sido
aplicado pra decidir "IA ou ferramenta", só "IA cara ou barata".
Agentes de diagnóstico/estratégia (`navigator`, `marketing-master`,
`conselho-*`) são "judgment-bound" de verdade — não têm gordura pra
cortar, e não tem problema nenhum nisso.

**O que isso implica pra arquitetura (liga com o resto do documento):**
cada linha "empurra pra determinístico" da tabela vira uma ferramenta
concreta chamada pelo `context-engine.js` ANTES do agente ser
acordado — o agente recebe evidência já extraída (nível 3), não
projeto cru (nível 4). Isso é o Context Engine aplicado, não conceito
solto.

**Números que EU NÃO VOU AFIRMAR sem medir** (mesmo cuidado que o
"conselheiro cético" da conversa externa trouxe, e concordo): não vou
dizer "isso corta 80% do token" até existir `usage.jsonl` de verdade
mostrando antes/depois. O que afirmo com confiança, sem precisar
medir: toda linha da coluna "empurra pra determinístico" acima é
trabalho que HOJE vira token de IA e amanhã vira 0 token — é fato
estrutural (regex não cobra por chamada de API), não estimativa.

## Políticas anti-erro (Bloco 2, 2026-08-17)

**Origem do bloco:** o travamento de ontem (histórico sem limite
zerando token antes do 3º agente) não foi um bug isolado — é um
representante de uma classe de erro: **estado que cresce sem limite e
é reenviado por inteiro**. Este bloco generaliza pra não precisar
descobrir a próxima instância "ao vivo" de novo.

### Classes de erro que já sabemos que existem nesse tipo de sistema

| Classe | Exemplo real já encontrado | Onde mais pode aparecer | Defesa |
|---|---|---|---|
| **Estado sem limite, reenviado inteiro** | `cli.js` history (corrigido 2026-08-16) | Context Engine se o template crescer por agente sem poda; `decisions.jsonl`/`usage.jsonl` se um dia forem lidos inteiros a cada chamada em vez de agregados | Janela deslizante + agregação, nunca "manda tudo de novo" |
| **Config ausente descoberta em runtime, não antes** | `GROQ_API_KEY ausente` só aparece quando o provider é chamado | Qualquer variável de ambiente nova adicionada sem checagem no `self-test.mjs` | Toda env var nova ganha checagem no autoteste no MESMO commit que a introduz — regra, não lembrete |
| **Silêncio quando devia falhar alto** | Se `usage.input`/`usage.output` vier `undefined` de um provider novo, o log grava `0` sem avisar (já mitigado com `?? 0`, mas vale registrar o padrão) | Qualquer parser que usa `?? valorPadrão` sem log — esconde dado ausente atrás de um número plausível | Prefira falhar alto (`throw`) a `?? 0` quando o dado ausente muda decisão; `?? 0` só quando o default é seguro de verdade |
| **Dois arquivos que deveriam concordar, divergem** | `CLAUDE.md` × `orchestration.md` depois da mudança de aprovação (2026-08-16, pendência ainda aberta) | Qualquer par de docs que descreve a mesma regra em dois lugares | Ou existe 1 fonte única + o outro só referencia, ou o autoteste compara os dois |
| **Custo que só aparece depois de bater no teto** | Free tier de provider grátis — hoje só sabemos que bateu quando a chamada falha | Qualquer limite externo (rate limit, teto de disco, teto de fila) | Contador local comparado ao limite conhecido (`docs/custos.md`), aviso ANTES de bater, não só depois |
| **Ferramenta nova sem teste, vira ponto cego** | Cada provider novo (Groq, Cerebras) só foi validado por causa do `self-test.mjs` já existir — sem ele, ninguém saberia se `groq-provider.js` exporta a função certa | Toda peça nova do Bloco 1 (linters, Lighthouse, Semgrep, etc.) chamada pelo Context Engine | Toda ferramenta nova entra no sistema já com 1 teste offline no `self-test.mjs`, no mesmo PR/zip que a introduz — nunca depois |

### Checklist pré-voo (rodar antes de qualquer sessão real, não só uma vez)

Isto vira literalmente uma seção nova do `self-test.mjs` (`npm test`
já é o lugar certo, não um script novo):

1. Toda env var referenciada em `process.env.*` no código tem entrada
   correspondente (comentada ou não) no `.env.example`? (detecta
   "esqueci de documentar a chave nova")
2. Todo `history`/estado que cresce em loop tem limite explícito
   (`.slice`, `.length` comparado a um teto)? — checagem estática:
   grep por `while (true)` ou loop com `.push` sem `.slice`/`.shift`
   por perto é sinal de alerta, não prova, mas pega o caso óbvio.
3. Toda decisão registrada em `decisions.jsonl` tem os dois campos
   obrigatórios (`ia_usada`, `evidencia`)? — mesmo espírito do teste
   que já existe pra `usage.jsonl`.
4. `CLAUDE.md` e `orchestration.md` mencionam o mesmo texto pra cada
   Regra de Ouro que tem trava mecânica (🔒)? — comparação simples de
   presença de string-chave, não prova semântica, mas pega divergência
   grosseira como a de ontem.

### O que isso NÃO é

Não é um sistema de QA genérico "detecta todo bug possível" — seria
promessa vaga, proibida pela Regra 4/6 do próprio `CLAUDE.md`. É a
lista concreta e crescente de classes de erro que **já mordeu este
projeto específico**, uma vez cada, virando checagem permanente pra
nunca morder duas vezes — mesmo espírito da Regra de Ouro 7
("duas tentativas iguais que falham = escala e vira registro").

## Modo offline de verdade (sem IA nenhuma disponível)

Quando `worker.js` detecta que os 4 providers falharam (mesmo erro que
hoje já derruba o `router.js` com "Todos os provedores falharam"), ele:
1. Não trava o processo — grava o item como pendente com motivo.
2. Continua processando a fila (fila e sequência não dependem de IA).
3. Ao terminar a passada, imprime um resumo: quantos itens avançaram
   sem IA, quantos ficaram esperando IA voltar.
4. Na próxima execução (`npm run orquestrar`, por exemplo), ele
   retoma sozinho de onde parou — mesmo princípio de continuidade que
   já existe pro Claude Code (`docs/RETOMADA.md`), agora pro runtime.

## Stack poliglota — qual linguagem pra qual camada (Bloco 3, 2026-08-17)

**Aviso direto antes da tabela:** Thiago pediu explicitamente "não
quero usar só uma linguagem" — mas o próprio `CLAUDE.md` deste projeto
manda aplicar YAGNI por padrão. Isso não é contradição: a resposta
certa não é "adiciona linguagem porque sim", é "cada linguagem que já
está aqui tem um motivo real, e só entra linguagem nova quando o
motivo aparecer de verdade". Reflete o próprio material que você
trouxe: "não migraria pra Python nem TypeScript imediatamente... só
depois de existir necessidade real."

**Regra de decisão (pergunta antes de escrever uma linha):**
1. Já existe ferramenta pronta, testada e mantida por terceiros que
   resolve isso? → usa via subprocess/CLI a partir do orquestrador,
   **não reescreve em nenhuma linguagem**. (ESLint, Semgrep, Lighthouse,
   axe-core, npm audit, Supabase Advisor — todas se encaixam aqui.)
2. O problema é sobre o CÓDIGO-ALVO (o site em React/TS que a
   Missões Tech entrega pro cliente)? → fica em TypeScript. Ferramenta
   que entende TS entende melhor código TS (AST real, não regex frágil).
3. O problema é dado/estatística/ML/embeddings? → Python, e só quando
   esse problema aparecer de verdade (ver critério abaixo).
4. É automação de sistema operacional/infra (healthcheck, hook de
   git, verificação de DNS)? → Bash, porque já é o padrão em
   `.claude/hooks/` — introduzir outra linguagem aqui fragmentaria sem
   ganho.

### Mapa por camada

| Camada | Linguagem | Por quê | Status |
|---|---|---|---|
| **Frontend do produto** (site que a Missões Tech entrega ao cliente) | TypeScript + React 18 + Vite | Já decidido no `CLAUDE.md`, stack madura, ecossistema gigante | Já existe, sem mudança |
| **Backend/dado do produto** | SQL declarativo via Supabase | Decisão do Conselho 2026-08-15: RLS/schema é a competência que Thiago já tem como Data Engineer | Já existe, sem mudança |
| **Orquestração/runtime** (router, agent-loader, usage-logger, futuro orchestrator-core, backend da web UI do Bloco 4) | TypeScript + Node | Já existe (`runtime/`); SDKs oficiais de Anthropic/Google/Groq/OpenAI são todos maduros em Node; mesma linguagem do agent-loader evita context-switch | Já existe, cresce |
| **Engines de análise do código-alvo** (duplicação, AST, nome genérico, complexidade) | TypeScript, via `ts-morph` ou TypeScript Compiler API | O alvo (código do produto) já é TS — ferramenta na mesma linguagem entende a árvore de sintaxe de verdade, regex por fora é frágil e já é anti-padrão citado no material externo | Novo, mas mesma linguagem do resto — não é "linguagem nova" de fato |
| **Ferramentas de terceiros chamadas via CLI** | O que cada uma já for (Semgrep é Go compilado, Lighthouse é Node, npm audit é nativo) | Regra 1 acima — nunca reescrever o que já existe e é mantido por terceiros | A adotar conforme Bloco 1 indicar necessidade |
| **Scripts de infra/glue** | Bash | Já é o padrão em `.claude/hooks/` (8 hooks hoje); consistente, sem ganho em trocar | Já existe, sem mudança |
| **Dado/estatística/ML/embeddings** | Python | Só quando aparecer necessidade real — ver critério abaixo | **Não existe ainda, de propósito** |

### Critério explícito pra quando o Python entra (não "algum dia", uma condição concreta)

Qualquer um destes, quando acontecer de verdade:
- `decision-record.js` acumular volume real (o material externo citou
  "depois de milhares de casos" — não é hoje) e Thiago quiser treinar
  algo em cima pra prever "que correção costuma ser rejeitada".
- Precisar comparar duas funções/textos por similaridade semântica
  (embeddings) porque regex/AST não resolve mais ("são quase a mesma
  coisa" é o exemplo do próprio material trazido).
- Processar volume de dado que faça sentido em pandas/numpy em vez de
  array em memória do Node.

Até um desses acontecer, Python fica de fora — não por dogma, por
"YAGNI" mesmo: cada linguagem a mais no repo é mais `self-test.mjs`
pra manter, mais `.env.example` pra documentar, mais superfície de
erro (Bloco 2, classe "ferramenta nova sem teste").

### O que isso significa pra "conseguir usar outras linguagens também"

Você já usa mais de uma: TypeScript (produto + runtime), SQL
(Supabase), Bash (hooks). Isso já é poliglota de verdade — cada
linguagem resolvendo o problema que ela resolve melhor, não uma
coleção de linguagens por variedade. O que eu recomendo NÃO fazer:
escrever o `orchestrator-core` em Python só pra "ter Python no
projeto" — isso reintroduziria o mesmo problema que
`docs/decisoes.md` já registrou e rejeitou (NeMo Guardrails
rejeitado por "runtime Python exigiria proxy na frente do Claude
Code").

### Padrão alto-ticket aplicado à própria stack (esclarecido 2026-08-17)

Thiago confirmou que "alto ticket" aqui não é sobre trocar linguagem
por moda — é sobre **o sistema interno ser confiável o bastante pra
sustentar sistemas de qualidade pro cliente**. O `CLAUDE.md` já define
alto-ticket pro produto entregue (R3F, GSAP+ScrollTrigger, Lenis,
Framer Motion, orçamento de performance numérico). Isso só se sustenta
se a fábrica que produz isso for confiável — senão o padrão vira sorte,
não processo. Tabela de rigor por camada, amarrada no que já existe:

| Camada | Padrão alto-ticket exigido | Por quê é isso e não "código funciona" | Já existe / falta |
|---|---|---|---|
| **Orquestração/runtime** (`router.js`, `agent-loader.js`, etc.) | Todo módulo novo entra com teste offline no `self-test.mjs` no mesmo commit/zip — não depois | Sistema que decide qual IA responde e quanto custa não pode ter zona cega; um bug aqui (como o do histórico) já custou uma sessão de trabalho real | **Já existe como prática** desde ontem — falta só virar regra escrita (fazendo agora, abaixo) |
| **Decision Record** (`decisions.jsonl`) | Todo campo obrigatório (`ia_usada`, `evidencia`, `motivo`) — decisão sem os três não é gravada, é erro | É a peça que você mostra pro cliente pra justificar preço alto ("essa vulnerabilidade veio de ferramenta X, não achismo de IA") — registro incompleto derruba a credibilidade que ele existe pra sustentar | Desenhado no Bloco anterior, falta codar |
| **Engines determinísticos** (linters, AST, scanners) | Rodar em CI/pre-commit, não só quando alguém lembrar — mesmo padrão do `.githooks/pre-commit` que já existe e trava commit sem marcador de fiscal | Alto ticket não admite "esquecemos de rodar o Lighthouse dessa vez" — se a ferramenta existe e não roda automaticamente, ela não existe de verdade | `.githooks/pre-commit` já existe — falta estender pros engines novos do Bloco 1 |
| **Observabilidade** (`usage.jsonl`, futuro `decisions.jsonl`) | Agregação lida por relatório (`npm run custos` já existe), nunca arquivo lido inteiro por humano | Cliente de alto ticket não aceita "não sabemos onde foi o gasto" — o painel web do Bloco 4 é a cara disso pro Thiago, e depois pro cliente | Metade existe (`usage.jsonl` + relatório); falta o painel visual |
| **Frontend do produto** (React/TS) | Já tem orçamento numérico (LCP < 2.5s, bundle < 200KB, etc.) no `CLAUDE.md` — não muda, só reforça que a stack interna precisa provar esses números, não estimar | Sem `technical-agent` rodando Lighthouse de verdade (Bloco 1), o orçamento vira meta na parede, não gate real | Orçamento já existe no `CLAUDE.md`; falta o Bloco 1 automatizar a medição |
| **Backend/dado** (Supabase) | As 5 condições que o Conselho já impôs em 2026-08-15 (Supabase Pro, teste negativo de RLS, `EXCLUDE` de agendamento, monitor de uptime, pagamento fora do v1) | Já é o padrão alto-ticket desta camada — nada novo, só reafirmando que continua valendo | Já existe, `docs/decisoes.md` |

**A regra que amarra tudo:** alto ticket na stack não é "linguagem
chique" — é **nada acontece sem prova**. Cada linha acima já tinha
prova em algum lugar (teste, hook, decisão registrada) ou ganhou uma
agora. Isso é literalmente o mesmo princípio do IA Gate (Bloco 1):
evidência de ferramenta, não opinião — só que aplicado à própria
fábrica, não ao produto que ela entrega.

## Página web — substitui o terminal (Bloco 4, 2026-08-17)

**Regra de decisão que já vale antes de desenhar:** pelo Bloco 3, a
web UI não introduz linguagem nova — é TypeScript + React, mesma
stack do produto e do `runtime/`. Reaproveita `router.js`,
`agent-loader.js`, `usage-logger.js`, `history.js` (extraído de
`cli.js` nesta mesma rodada, pra já servir os dois consumidores sem
duplicar) — a página web troca **só** a camada de entrada (HTTP em
vez de `readline` de terminal), o motor por baixo é o mesmo.

### Arquitetura (2 partes, mesmo repositório)

```
runtime/
├── src/            (já existe — router, agent-loader, history, usage-logger)
├── server/         (NOVO — API HTTP fina, chama o que já existe)
│   └── index.js    Express/Fastify: POST /chat, GET /agents, GET /usage
└── web/            (NOVO — React + Vite + TS, painel visual)
    └── src/
        ├── ChatPanel.tsx      conversa por agente (substitui cli.js)
        ├── AgentPicker.tsx    lista os 16 agentes (lê o mesmo agent-loader via API)
        ├── CustosPanel.tsx    gráfico de gasto por agente/provider (consome usage-logger)
        └── DecisionLog.tsx    quando decision-record.js existir, mostra o rastro
```

`server/index.js` é deliberadamente fino — não reimplementa nada, só
expõe HTTP:

```
POST /chat        { agent, message, history } → chama sendMessage() do router.js,
                     corta histórico com trimHistory(), grava com logUsage() —
                     mesmíssima sequência que cli.js já faz, só trocando
                     readline por HTTP.
GET  /agents       lista .claude/agents/*.md via agent-loader.js
GET  /usage/summary  chama summarizeUsage() de usage-logger.js — mesmo dado
                     que hoje só existe em texto no `npm run custos`
```

### O que a página mostra (pensado pro caso de uso real: "falo um
problema, ela traz a solução")

1. **Seletor de agente** — os 16, com a descrição de quando usar cada
   um (já está no frontmatter, não precisa reescrever).
2. **Chat** — igual ao `cli.js` hoje, mas visual: mensagens, indicador
   de qual provider respondeu (Claude/Groq/Cerebras/Gemini) e quantos
   tokens custou aquela resposta especificamente — visível em tempo
   real, não só no relatório depois.
3. **Painel de custo** — o `npm run custos` de hoje, mas como gráfico
   (barra por agente, por provider), atualizado a cada resposta.
4. **Aviso de contexto cortado** — quando `trimHistory` descarta
   mensagens antigas, a página mostra isso visualmente (hoje é só uma
   linha de log no terminal) — resolve exatamente o "eu não sabia que
   isso ia acontecer" de ontem.

### Por que isso resolve o "eu preciso que atente todos os detalhes,
não quero passar por isso de novo"

O travamento de ontem só foi visível DEPOIS — o terminal mostrava
texto correndo, sem sinal de que o histórico estava crescendo até
estourar. A página web torna esse estado **visível durante**, não só
depurável depois: contador de tokens da conversa atual sempre à vista,
antes de mandar a próxima mensagem — se está perto do limite, a
pessoa vê antes de perder a conversa, não depois.

### O que NÃO muda

- Regra de Ouro 1 continua: a web UI não pula nenhum gate — ela é
  interface pro mesmo fluxo, não um caminho novo que ignora
  `orchestration.md`.
- Nenhum dado sensível novo — `.env`/chaves continuam só no
  `server/`, nunca expostas pro `web/` (frontend nunca vê chave de
  API, só fala com o próprio backend do `runtime/`).

### Status

Desenho, não construído — mesma regra dos blocos anteriores: só codo
depois de "pode codar". A extração de `history.js` (feita nesta
rodada) já é a preparação real pra isso — não é desenho solto, é
refactor que a web API vai usar de verdade quando for construída.

## O que fica igual (não muda com isto)

- Regra de ouro 1 do `CLAUDE.md` continua valendo — **mas com o escopo
  que ela tem hoje, não o de antes**. *(Corrigido 2026-08-17: esta
  linha dizia "gate de aprovação nunca é pulado", redação da política
  ANTERIOR a 2026-08-16. Escrita depois da mudança, ela especificava o
  `gate.js` contra uma regra já revogada — risco real de codar a peça
  com a semântica errada, que é exatamente o tipo de erro que este
  documento existe pra evitar.)*
  O que o `gate.js` checa: as **5 ações irreversíveis** de
  `guard-red-lines.sh` (instalar dependência, apagar arquivo,
  produção/deploy, commit, descartar trabalho). O que ele **não** faz:
  parar entre etapas ou entre agentes pedindo confirmação — isso foi
  removido de propósito, a auditoria do diretor acontece nas Etapas
  5/6.
- Conteúdo de cada agente (o `.md`) continua sendo a única fonte de
  system prompt — o orquestrador não duplica isso.

## Como vou provar que funciona antes de considerar pronto

1. Teste de unidade em `sequencia.js` sem rede: dado cada estado
   possível da Etapa 1-8 (ver `CLAUDE.md`), a próxima etapa decidida
   bate com o que `.claude/rules/orchestration.md` descreve.
2. Teste de integração simulando "todos os providers falharam"
   (mock, sem gastar token real): confirma que o `worker.js` não
   trava — processa o que pode, marca o resto como pendente, sai
   com código 0 (não é erro do sistema, é estado normal esperado).
3. `context-engine.js`: teste sem rede — dado um output de agente em
   formato fixo conhecido, o template extraído tem os campos certos;
   dado um output fora do formato esperado, cai pro texto bruto em vez
   de inventar campo vazio.
4. `decision-record.js`: teste sem rede — decisão determinística grava
   `ia_usada:false`; decisão que passou por IA grava `ia_usada:true` +
   motivo; nunca grava decisão sem os dois.
5. Adiciona essas checagens no `self-test.mjs` que já existe — mesmo
   autoteste, ampliado (é o que já fizemos com `trimHistory` nesta
   mesma rodada), não um sistema de teste paralelo.
6. Só depois disso passar de verdade eu considero a etapa "pronta" —
   antes disso é desenho, não entrega.

## O que preciso de Thiago pra começar a codar isto

Nada além do que já foi aprovado nesta conversa — este desenho
reaproveita 100% do que já existe (`router.js`, `agent-loader.js`,
`usage-logger.js`) e só adiciona a camada de fila/sequência/gate. Esse
grupo de arquivos entra na próxima atualização de zip, do mesmo jeito
que esta rodada (só o que muda, não recria o pacote inteiro).

**Aguardando sua confirmação pra codar** — este documento é só o
desenho. Me avisa "pode codar" que eu construo `fila.js`, `sequencia.js`,
`gate.js`, `worker.js` com os testes descritos acima, e entrego no
próximo zip incremental.

## Auditoria final (Bloco 5, 2026-08-17) — feita aqui dentro, não em outro chat

Thiago pediu explicitamente que a auditoria rodasse dentro desta
mesma conversa, não fosse mandada pra outro lugar conferir. Revisei
os 4 blocos acima contra `docs/decisoes.md` inteiro (187 linhas, lido
de novo agora) e contra o resto do repositório — risco real, não
genérico, com veredito claro no final.

### Riscos encontrados, por severidade

**Alto — bloqueia "pode codar" até resolver:**
- Nenhum. Não achei risco que impeça começar a construir
  `fila.js`/`sequencia.js` (as duas peças mais simples e testáveis
  isoladamente).

**Médio — não bloqueia, mas precisa de decisão explícita antes do
Bloco que depende disso:**
1. **`supabase/migrations/` (14 arquivos, 482 linhas) existe no disco
   sem registro de decisão em `docs/decisoes.md`** (achado da
   auditoria de 2026-08-16, linha 152, nunca esclarecido). Isso é
   RISCO REAL pro Context Engine: se o `backend-master` vai extrair
   fato do schema pra passar contexto compacto pros próximos agentes
   (Bloco 1), e o schema em si tem origem não confirmada, o "fato"
   extraído herda a incerteza. **Não impede Bloco 5 nem começar a
   codar fila/sequência**, mas impede o Context Engine ler schema como
   fonte confiável até isso ser esclarecido.
2. **Consistência `CLAUDE.md` × `orchestration.md` ainda não é
   checagem automática** (pendência registrada 2026-08-16, linha 182).
   O `gate.js` do orquestrador vai ler `orchestration.md` como fonte
   de sequência — se ele divergir do `CLAUDE.md` de novo no futuro
   (como já aconteceu uma vez), o orquestrador executa a versão
   desatualizada sem avisar ninguém. **Vira item concreto do
   `self-test.mjs`** antes de `sequencia.js` ser considerado "pronto"
   — adiciono ao critério de prova da seção acima.
3. **Contagem de uso não soma contra o teto do free tier em tempo
   real** (pendência de 2026-08-16, linha 172) — o painel de custo do
   Bloco 4 mostra gasto passado, não avisa "Groq vai bater no limite
   em N chamadas". Não bloqueia construir o painel — só significa que
   a primeira versão é retrovisor, não alerta preventivo. Registro
   como v2 do painel, não trava v1.

**Baixo — observação, não muda nada agora:**
4. O Decision Record (`decisions.jsonl`) e o `docs/decisoes.md`
   existente têm nomes parecidos e propósitos diferentes (operacional
   vs. do diretor) — já deixei isso explícito na seção própria, mas
   registro aqui que é um ponto real de confusão futura se alguém
   (inclusive eu, em sessão futura) não ler a distinção com atenção.

### Consistência entre os 4 blocos (auditoria cruzada)

- Bloco 1 (IA Gate) alimenta o Context Engine do desenho original —
  consistente, sem contradição.
- Bloco 2 (anti-erro) inclui checagem de divergência `CLAUDE.md`×
  `orchestration.md` — resolve o risco médio #2 acima, já embutido.
- Bloco 3 (stack) não introduz nada que contradiga o Bloco 4 (web UI
  é TS, mesma decisão) — consistente.
- Bloco 4 (web UI) reaproveita `history.js`, que já existe e está
  testado — não é promessa, é fato verificável (`npm test` passou
  nesta mesma rodada).

### Veredito

**Pode codar `fila.js` e `sequencia.js` agora** — são determinísticos,
testáveis sem rede, sem dependência dos riscos médios acima.

**`gate.js` espera 1 item**: a checagem de consistência
`CLAUDE.md`×`orchestration.md` entra no `self-test.mjs` ANTES dele,
não depois — é rápido de fazer e fecha o risco médio #2 na raiz, em
vez de deixar pra descobrir ao vivo de novo.

**Context Engine espera esclarecimento sobre `supabase/migrations/`**
(risco médio #1) — não é bloqueio duro, é "não trate schema como fato
confirmado até isso ser resolvido".

**`worker.js`, `context-engine.js`, `decision-record.js` e a Web UI
completa** entram depois de `fila.js`/`sequencia.js`/`gate.js`
provados — é a ordem que já estava na seção "Como vou provar que
funciona", esta auditoria só confirma que não achei motivo pra mudar
essa ordem.

Este bloco fecha o ciclo de planejamento. Próximo passo é seu: "pode
codar" (o quê, na ordem acima) ou mais alguma correção antes disso.
