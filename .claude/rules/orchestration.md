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
**reafirma o entendimento em 3-5 frases e espera confirmação**, e só
então monta a tabela de delegação. Gate: confirmação do diretor.
`/intake`

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
Gate: nenhuma edição de arquivo. `/analyze`

**3. Plano** — skill `swarm-planner`: tarefas atômicas com `depends_on`
explícito, ondas, critério de aceite e validação por tarefa. Marcar o
que exige aprovação especial. Gate: zero código. `/plan`

**4. Implementação** — skill `parallel-task`: acorda **só tarefa
desbloqueada**, em ondas. Gate: aprovação do diretor **por onda**, não
uma aprovação geral. Só `implementation-agent` edita. `/build`

**5. Auditoria** — `qa-agent` (funciona?) → `security-agent` (se houver
login/pagamento/dado pessoal) → `reviewer-agent` (padrão e conversão) →
`fiscal-agent` (a entrega cumpre a documentação?). Gate: veredito
`pass` de todos os aplicáveis. `/audit`

**6. Fechamento** — obrigatório, executado por `docs-agent` (único
autorizado a escrever fora de `src/`): o que funcionou vira entrada em
`docs/conhecimento/`; o que quebrou vira post-mortem **e** regra nova
no agente responsável; decisão revogada na prática vira linha em
`docs/decisoes.md`. Entrega que não ensina nada faz o próximo projeto
repetir o mesmo erro.

## Roteamento por linha de produto
`intake-agent` roda sempre primeiro (Etapa 1), antes de qualquer linha
abaixo — independe do produto.
- **Site / landing page** — business → creative → technical →
  implementation → reviewer → fiscal.
- **Sistema / SaaS** — business → backend-master → technical →
  implementation → qa → security → infra → reviewer → fiscal.
- **Marketing** — marketing-master (business entra se a dúvida for de
  oferta ou posicionamento).

`security-agent` é obrigatório com login, pagamento, dado pessoal ou
integração externa. `infra-agent` é obrigatório antes do primeiro
deploy. `fiscal-agent` é obrigatório antes de qualquer entrega sair.

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
| Especialista → implementação direto | Só o orquestrador libera, após aprovação |
| Agente → diretor direto | O orquestrador sintetiza; 5 relatórios crus é o problema que o sistema resolve |
| Agente aprovando ação de outro | Permissão é do diretor, via gate |

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
