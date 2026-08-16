# 20 princípios de sistemas distribuídos/natureza — mapeados contra o orquestrador real

Origem: Thiago trouxe um texto com 20 princípios de sistemas
distribuídos (consistência eventual, CAP, backpressure, gossip,
heartbeat, circuit breaker, event sourcing etc.), cada um com analogia
de colmeia/corpo/natureza, propondo virar "coordenador fraco" (fila +
workers assíncronos) em vez de orquestrador central. Pediu pra
verificar onde isso aperfeiçoa o sistema real. Decisão completa e
motivo → `docs/decisoes.md`, 2026-08-16, "Padrão de excelência
always-on" em diante.

**Por que este arquivo existe:** próxima vez que uma analogia de
sistema distribuído/natureza aparecer, conferir aqui antes de
reavaliar do zero — ou aplicar de novo os itens do grupo B, ou lembrar
por que o grupo C fica em espera.

## Como ler os 3 grupos
Nem todo princípio "bom" cabe aqui do jeito que foi descrito — a forma
literal (fila persistente + workers lendo sozinhos) pressupõe um
processo rodando fora do turno do orquestrador, que o Claude Code não
tem (subagente só existe dentro do turno de quem o chamou). Confundir
"o princípio é válido" com "a implementação literal cabe aqui" é o
erro fácil de cometer com esse tipo de analogia.

## Grupo A — já existe, com outro nome (nenhuma ação)
| # | Princípio | Onde já vive |
|---|---|---|
| 7 | Consenso distribuído | Conselho: 3 conselheiros cegos um do outro + diretor desempata (`orchestration.md`, 1b); `fiscal-agent` tem veto (`pass/revise/escalate`) |
| 14 | Limite central / enxame | O próprio Conselho — várias leituras independentes, síntese por convergência/divergência, não por autoridade única |
| 15 | Lei de Conway | "Não existe aresta agente↔agente" já é regra dura em `orchestration.md` — toda comunicação passa pelo orquestrador |
| 17 | Sharding / especialização | Os 16 agentes já são isso: fronteira estreita e declarada por agente, roteamento por especialidade |
| 18 | Teorema de halting | Regra de ouro 7 do `CLAUDE.md`: "duas tentativas iguais que falham = para e escala", ação irreversível sem retry automático — só não era timeout de relógio em código (isso virou item do Grupo B, ver `runtime/src/router.js`) |
| 8 | Degradação graciosa (parcial) | `docs/RETOMADA.md` garante continuidade entre sessões — mas é continuidade **assistida** (o Thiago reabre a sessão e ela retoma do ponto exato), não autonomia de workers rodando sem ninguém. Diferença importa: não prometer o que a plataforma não entrega. |

## Grupo B — baratos, aplicados em 2026-08-16 sem mudar arquitetura
Implementado em `runtime/src/router.js` (código real, testado nesta
sessão — 3 chamadas sem API key confirmaram: erro de config falha
rápido sem retry, e a 4ª chamada ao mesmo provider bate no circuito
aberto em 0ms, sem tentar a API):

| # | Princípio | O que entrou |
|---|---|---|
| 10 | Timeout + backoff | `RUNTIME_PROVIDER_TIMEOUT_MS` (60s default) por chamada; retry curto (2 tentativas, 300ms→2s, jitter ±20%) só pra erro transiente (rede/429/5xx), nunca pra erro de config |
| 11 | Circuit breaker | 3 falhas em 60s abre o circuito daquele provider por 30s — próximas mensagens pulam ele sem tentar de novo |
| 19 | Localidade/cache (leve) | Estado do breaker fica em memória do processo — evita reprocessar "esse provider tá bom?" a cada mensagem |

Deliberadamente diferente do texto original em um ponto: o backoff
proposto lá (1s→32s) é pensado pra um worker de fundo, não pra chat de
terminal interativo — usar aquilo aqui deixaria o Thiago encarando o
terminal parado. Adaptado pro contexto real (evolução cirúrgica, não
cópia literal).

**Ainda não feito, candidato a próxima rodada se o `runtime/` crescer:**
- #9 Idempotência (ID determinístico por tarefa) — só faz sentido
  quando existir tarefa reexecutável de verdade; hoje é chat 1:1, não
  há o que duplicar.
- #6 Amdahl/Gustafson formalizado — já existe como regra solta em
  `orchestration.md` ("onda com mais de 4-5 tarefas indica plano mal
  fatiado"); formalizar limiar por tamanho de tarefa no
  `swarm-planner` quando o volume de planos justificar.

## Grupo C — exige fila persistente + workers assíncronos = outro sistema, não regra nova
| # | Princípio | Por que não cabe hoje |
|---|---|---|
| 1 | Consistência eventual | Pressupõe orquestrador "descobrindo" estado que mudou enquanto não olhava — só existe se algo escreve nesse estado sem o orquestrador estar rodando |
| 2 | CAP (cenário "fila cai") | Não há fila; não há o que cair |
| 3 | Backpressure | Precisa de fila com profundidade mensurável pra "parar de aceitar" fazer sentido |
| 4 | Gossip protocol | Pressupõe workers publicando/lendo de um meio compartilhado persistente, não um retorno síncrono ao orquestrador |
| 5 | Heartbeat | Só detecta "worker morto" se o worker for um processo vivo rodando sozinho — subagente Claude Code não é isso |
| 13 | Event sourcing | Reconstruir estado de um log pressupõe processo que reinicia e precisa recuperar — hoje quem "reinicia" é o Thiago abrindo sessão nova, e `docs/RETOMADA.md` já cumpre esse papel em texto |
| 16 | Anti-entropy | Scan periódico de reparo pressupõe algo rodando em intervalo fixo sem gatilho humano — não existe hoje |
| 20 | Evolução darwiniana automática | Precisa de volume repetido e comparável pra testar configs e medir — hoje cada task é conduzida manualmente pelo Thiago, sem esse volume ainda |
| — | "Weak coordinator" (rainha pode morrer, colmeia continua) | Contradiz a mecânica de base: sem sessão ativa (Claude Code ou um processo do `runtime/` rodando como serviço), nada processa. Trocar Claude por Gemini não resolve isso — o problema é "quem está rodando", não "qual modelo" |

**O que isso exigiria de verdade:** um processo separado rodando como
serviço (não CLI interativo), uma fila persistente (banco/Redis/
arquivo), workers que leem essa fila sozinhos. É, na prática, o
"framework de orquestração concorrente" que o Conselho já avaliou e
rejeitou em 2026-08-15 (`docs/decisoes.md`: "NeMo Guardrails rejeitado
como framework... Conceito serve, framework não"). Não é dizer que a
ideia do Thiago é ruim — é dizer que adotar isso é decisão de
arquitetura nova, não um ajuste que encaixa no que já existe.

**Gatilho pra revisitar (2026-08-16, registrado por pedido do
Thiago):** volume real de tarefas simultâneas que o modelo síncrono
atual não aguenta mais — hoje não existe esse volume (nenhum projeto
de cliente rodando ainda). Quando aparecer, convocar o Conselho de
novo com esse volume real em mãos, não decidir no abstrato.
