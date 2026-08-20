# Regras de orquestração

Fonte única do fluxo e do roteamento. Importado pelo `CLAUDE.md` —
está no contexto de toda sessão.

## Subagents é o padrão; Agent Teams é exceção
| | Subagents | Agent Teams |
|---|---|---|
| Contexto | Próprio; resultado volta resumido | Próprio; totalmente independente |
| Comunicação | Só reporta ao orquestrador | Conversam entre si |
| **Custo** | **Menor** | **Maior** — cada colega é uma instância Claude |
| Status | Estável | Experimental, desligado por padrão |

"Acordar apenas quem precisa trabalhar" é a definição de **subagent**.
Agent Teams acorda todos e os mantém vivos conversando. Ele só se
justifica em três casos, e sempre com aprovação do diretor: revisão em
paralelo com lentes concorrentes, investigação com hipóteses
competindo, e módulo novo cross-camada sem conflito de arquivo. Fora
disso, subagent. Agent Teams também não resume sessão nem permite time
aninhado — `backend-master` não conseguiria acordar sub-especialistas.

## O fluxo (numeração oficial — cite etapa só a partir daqui)

**1. Intake & Confirmação** — o `navigator-agent` conversa com o
diretor (não é o cliente respondendo direto) a partir do pedido cru,
por mais incompleto que esteja: **uma pergunta objetiva de cada vez**,
sempre dizendo o que ela decide na prática. **Nunca trava** — "não
sei" vira PREMISSA (assume o cenário mais seguro) e a conversa segue
(mesma regra de todo agente, `agent-contracts.md` item 2, só que
aplicada em loop em vez de resposta única). Ao convergir, o
`navigator-agent` fecha com playback de confirmação e devolve o brief
+ recomendação de qual(is) especialista(s) acionar. O `docs-agent`
grava o brief em `docs/clientes/<nome>/brief.md`. O orquestrador
(Claude Code lendo o `CLAUDE.md`, não um subagente — e tecnicamente um
subagente não consegue acordar outro, por isso quem aciona os
especialistas recomendados é sempre o orquestrador) lê o brief,
**registra o entendimento em 3-5 frases no log de delegação (Registro
de delegação, abaixo) e já aciona os especialistas recomendados** —
sem parar pra esperar confirmação nesse ponto (mudança 2026-08-16:
Thiago decidiu auditar no final em vez de aprovar etapa por etapa —
ver Regra de Ouro 1 no `CLAUDE.md`). Gate: nenhum aqui — o registro em
log é o que sustenta a auditoria da Etapa 5/6. `/intake`

*Histórico: até 2026-08-15 esta etapa usava `intake-agent`
(single-shot, sem pergunta) — deprecado, ver
`docs/_quarentena/agents/intake-agent.md` e `docs/decisoes.md`.*

**1b. Conselho** (só em decisão de peso) — 3 conselheiros em paralelo,
**cada um sem ver a resposta do outro**. Depois síntese em 4 blocos:
convergência, divergência real, premissa a verificar, 1 recomendação.

**Checklist de convocação (substitui "decisão cara" — binário, não
impressão):**
1. Reverter isso é `git revert`/rollback de 1 comando, ou exige
   reconstrução manual (reescrever schema, recriar dado, renegociar com
   cliente)? Reconstrução manual = "sim". (proxy estrutural — não
   depende de ticket médio nem custo-hora, que ainda não existem)
2. Afeta o padrão de **todos** os projetos futuros, não só este? (sim/não)
3. Envolve dado real de cliente, compromisso financeiro, ou é
   irreversível em produção? (sim/não)

**Duas ou mais respostas "sim" → convocação automática**, sem eu
julgar "cara" no abstrato. Uma resposta "sim" → decisão do orquestrador,
justificar em 1 linha por que convocou ou não. Zero "sim" → não
convoca. **O diretor pedir explicitamente sempre convoca**, independente
do checklist. Gate: o Conselho recomenda, o diretor decide. `/conselho`

**2. Análise** — só os especialistas que a task exige. Justificar em
uma linha por que cada um entrou e por que os outros ficaram de fora.
Gate: nenhuma edição de arquivo (continua verdade — análise é
só-leitura por natureza, isso nunca dependeu de aprovação, dependia de
escopo). Segue direto pra Etapa 3, sem pausa pra confirmação. `/analyze`

**3. Plano** — skill `swarm-planner`: tarefas atômicas com `depends_on`
explícito, ondas, critério de aceite e validação por tarefa. Marcar o
que exige aprovação especial (ex.: uma tarefa que só consegue avançar
tocando numa das 4 ações de `guard-red-lines.sh` — essa sim para e
pede `/aprovar` quando chegar nela). Gate: zero código nesta etapa
(continua verdade — plano não escreve `src/`). Segue direto pra Etapa
4, sem pausa pra confirmação. `/plan`

**4. Implementação** — skill `parallel-task`: acorda **só tarefa
desbloqueada**, em ondas, sem pausar entre ondas pra aprovação geral
(mudança 2026-08-16 — a auditoria acontece na Etapa 5, não onda a
onda). Só `implementation-agent` edita. Gate real que sobra: só as **5**
ações travadas por `guard-red-lines.sh` (instalar dependência, apagar
arquivo, produção/deploy, commit, e descartar trabalho não-commitado) —
o hook bloqueia essas mecanicamente com exit 2, mudança de regra em
texto não desativa a trava física. Desbloqueio: `/aprovar` nas 3
primeiras; commit exige marcador do `fiscal-agent`; descarte de
trabalho não tem desbloqueio automático. Ver a tabela no `CLAUDE.md`.
*(Corrigido 2026-08-17: dizia "4 ações" — o hook sempre bloqueou 5, e a
5ª nunca esteve documentada.)* `/build`

**5. Auditoria** — `qa-agent` (funciona?) → `security-agent` (se houver
login/pagamento/dado pessoal) → `reviewer-agent` (padrão e conversão) →
`fiscal-agent` (a entrega cumpre a documentação?). Gate: veredito
`pass` de todos os aplicáveis. `/audit`

**6. Fechamento** — obrigatório, executado por `docs-agent`: o que
funcionou vira entrada em `docs/conhecimento/`; o que quebrou vira
post-mortem **e a regra nova PROPOSTA** em `docs/decisoes.md`, marcada
`[a aplicar pelo diretor]` com arquivo e seção nomeados; decisão
revogada na prática vira linha em `docs/decisoes.md`. Entrega que não
ensina nada faz o próximo projeto repetir o mesmo erro.
*(Corrigido 2026-08-17: exigia "regra nova NO agente responsável" —
escrita em `.claude/agents/`, que **nenhum dos 16 agentes pode fazer**.
O `fiscal-agent` cobrava como gate e reprovava permanentemente todo
fechamento que tivesse tido falha. Raciocínio em `rules/memory.md`.)*

## Roteamento por linha de produto
`navigator-agent` roda sempre primeiro (Etapa 1), antes de qualquer
linha abaixo — independe do produto. *(Corrigido 2026-08-17: esta
linha dizia `intake-agent`, que foi deprecado em 2026-08-16 e movido
pra `docs/_quarentena/agents/`. Como este arquivo é `@import`ado em
TODA sessão, ele estava ensinando o orquestrador a acionar um agente
que não existe mais em `.claude/agents/`.)*
**Corrigido em 2026-08-17 (auditoria de arquitetura).** A versão
anterior desta tabela tinha três defeitos que travavam o fluxo na
prática: (1) a linha Site/landing não tinha `security-agent` nem
`infra-agent`, contradizendo a regra obrigatória escrita logo abaixo
dela — e toda landing da casa captura lead (dado pessoal) e vai a
deploy; (2) nenhuma linha mostrava a Etapa 3 (Plano), então
`technical → implementation` sugeria pulo direto — mas o
`implementation-agent` tem trava explícita de "sem critério de aceite,
pare e pergunte", e critério de aceite nasce no Plano. O fluxo
"sem pausa" travava no elo mais caro; (3) a linha Marketing não
passava pelo `fiscal-agent`, apesar de ele ser obrigatório antes de
qualquer entrega.

- **Site / landing page** — `navigator-agent` → `business-agent` → `creative-agent` →
  `technical-agent` → **Plano (`swarm-planner`)** → `implementation-agent` →
  `qa-agent`¹ → `security-agent`² → `reviewer-agent` → `infra-agent`³ → `fiscal-agent` → `docs-agent`.
- **Sistema / SaaS** — `navigator-agent` → `business-agent` → `backend-master` →
  `creative-agent`⁴ → `technical-agent` → **Plano (`swarm-planner`)** →
  `implementation-agent` → `qa-agent` → `security-agent` → `reviewer-agent` → `infra-agent`³ →
  `fiscal-agent` → `docs-agent`.
- **Marketing** — `navigator-agent` → `marketing-master` (`business-agent` entra
  se a dúvida for de oferta ou posicionamento) → `fiscal-agent` → `docs-agent`.

¹ `qa-agent` na linha Site/landing entra **se houver formulário ou
integração** (WhatsApp, e-mail, agendamento) — o que na prática é
quase sempre. Sem ele, ninguém dono de "funciona?" olha o formulário;
sobra o item 6 do checklist do `reviewer`, que é auditoria visual
fazendo trabalho funcional.
² `security-agent` é obrigatório com login, pagamento, **dado pessoal**
ou integração externa. Captura de lead É dado pessoal — por isso ele
está na linha Site/landing agora.
³ `infra-agent` é obrigatório **antes do primeiro deploy** — vem
depois do `reviewer` porque deploy é a última coisa antes de sair.
⁴ `creative-agent` entrou na linha Sistema/SaaS: o contrato dele
especifica os 9 estados de interface (vazio, carregando, erro,
sessão expirada, conflito de horário...), que são exatamente o que um
sistema precisa e uma landing não. Sem ele ali, o `reviewer` reprovava
depois pelo bloco "Estados de interface" — retrabalho embutido no
roteamento.

`fiscal-agent` é obrigatório antes de qualquer entrega sair, nas três
linhas. `docs-agent` fecha (Etapa 6) nas três — ele e os
`conselho-*` não apareciam em nenhuma linha antes, o que deixava 4 dos
16 agentes fora da estrutura que o `fiscal-agent` usa pra auditar
roteamento. Os `conselho-*` continuam fora da tabela de propósito:
são acionados pelo checklist binário da Etapa 1b, não pela linha de
produto.

Pedido que dependa de decisão pendente (`docs/decisoes.md`): avisar
antes de aceitar prazo. Não prometer o que ainda não foi decidido.

## Grafo — arestas permitidas e proibidas
Toda comunicação passa pelo orquestrador. **Não existe aresta
agente↔agente.** Isso é decisão, não limitação: evita que um agente
polua o contexto do outro com opinião fora de escopo, mantém o
orquestrador como único ponto que enxerga o todo, e é o que torna a
economia possível.

| Proibido | Por quê |
|---|---|
| Conselheiro ↔ conselheiro | Ancoragem mata o valor das 3 leituras |
| Especialista → implementação direto | Só o orquestrador libera (a passagem é dele, não do especialista — não é mais questão de aprovação do diretor desde 2026-08-16, é questão de quem enxerga o todo) |
| Agente → diretor direto | O orquestrador sintetiza; 5 relatórios crus é o problema que o sistema resolve |
| Agente aprovando ação de outro | As 4 ações irreversíveis (`guard-red-lines.sh`) são do diretor, via `/aprovar` — nenhum agente libera outro |

## Registro de delegação
Ao acordar alguém, o orquestrador declara em uma linha:
`agente · objetivo · contexto enviado · output esperado · **motivo da
escolha** (por que este e não outro)`. Ao voltar: `resultado ·
veredito`. O motivo é o que torna o roteamento auditável.

## Economia de contexto
Task de output grande (varredura de código, pesquisa extensa, leitura
de muitos arquivos) vai **obrigatoriamente** por subagent, que devolve
só o resumo. O contexto do orquestrador é o recurso mais caro do
sistema — é o único que não pode ser descartado no meio do projeto.

Ninguém é acordado "por via das dúvidas". Onda com mais de 4-5 tarefas
simultâneas normalmente indica plano mal fatiado: avisar antes.

## Falha durante a execução
Tarefa que falha **não é retentada em silêncio**. A onda para, o erro
literal vai pro `log` da tarefa no plano, as dependentes seguem
bloqueadas, e o diretor é avisado com o estado parcial e 2 opções de
saída. Retry, rollback ou mudança de abordagem é decisão dele. Duas
tentativas iguais que falham = para e escala. Ação irreversível nunca
tem retry automático.

**Escalar não fecha o ciclo sozinho.** Depois de "para e escala", o
orquestrador **cria o arquivo de post-mortem** em
`docs/conhecimento/post-mortem/` (usar `TEMPLATE.md`) antes de
considerar a falha tratada — mesmo que o diretor ainda não tenha
decidido retry/rollback. O post-mortem registra o que já se sabe (o
que quebrou, as 2 tentativas, a causa raiz até aqui); o campo "Correção
aplicada" fica `[a preencher]` até a decisão do diretor. Falha
escalada sem post-mortem aberto é falha que o sistema vai repetir —
mesmo erro, mesmo agente, próxima task.
