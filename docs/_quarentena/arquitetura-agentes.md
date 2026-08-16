# Arquitetura de agentes — Subagents, Agent Teams e economia de token

Decisão de arquitetura da Missões Tech. Lida antes de propor qualquer
mudança na estrutura do time.

## A correção importante

A intuição natural é "Agent Teams = time completo = melhor". **É o
contrário do que a gente quer como padrão.** Os dois mecanismos são
diferentes na conta de token:

| | Subagents | Agent Teams |
|---|---|---|
| Contexto | Próprio, resultado volta pro orquestrador | Próprio, totalmente independente |
| Comunicação | Só reporta pro orquestrador | Conversam entre si diretamente |
| Coordenação | Orquestrador manda | Auto-coordenação + lista de tarefas compartilhada |
| **Custo de token** | **Menor** — resultado resumido volta | **Maior** — cada colega é uma instância Claude inteira |
| Status | Estável | **Experimental**, desligado por padrão |

"Acordar apenas quem precisa trabalhar" — o princípio que o diretor
definiu — é literalmente a descrição de **subagent**, não de Agent
Team. Agent Team acorda todo mundo e mantém todos vivos conversando.

## Nosso modelo: hierarquia de subagents sob demanda

```
Orquestrador (Claude Code + CLAUDE.md)
  ├─ Intake & Confirmação  ← não gasta subagent, é o próprio orquestrador
  ├─ business-agent        ← acordado só quando a task é de negócio
  ├─ creative-agent        ← acordado só quando a task é visual/copy
  ├─ technical-agent       ← acordado só quando a task é arquitetura
  ├─ backend-master        ← (em desenho) acorda sub-especialistas sob demanda
  ├─ marketing-master      ← (em desenho) acorda sub-especialistas sob demanda
  ├─ implementation-agent  ← único que edita arquivo, uma etapa por vez
  └─ reviewer-agent        ← auditoria final
```

Regra de ouro da economia: **nenhum agente é acordado "por via das
dúvidas"**. O orquestrador decide na etapa de Intake quem entra, e
justifica. Time de 5 acordado inteiro numa task que precisava de 1 é
desperdício de 4 contextos.

## Quando Agent Teams vale a pena (exceção, não padrão)

Só em 3 situações, e sempre com aprovação explícita do diretor por
causa do custo:

1. **Revisão em paralelo com lentes concorrentes** — ex.: 3 revisores
   simultâneos (segurança, performance, conversão) que precisam
   discordar entre si.
2. **Investigação com hipóteses competindo** — bug cuja causa raiz é
   desconhecida; agentes tentam refutar a teoria um do outro.
3. **Trabalho cross-camada de módulo novo** — frontend, backend e
   testes tocados ao mesmo tempo por donos diferentes, sem conflito
   de arquivo.

Fora disso: subagent. Agent Teams também é experimental (precisa de
`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS=1`), não resume sessão
corretamente e não permite time aninhado — não serve como base
estrutural de uma consultoria que roda todo dia.

## Regra de roteamento de output grande

Adotada de padrão de orquestração comprovado: **toda task com output
grande (leitura de muitos arquivos, pesquisa extensa, varredura de
código) vai obrigatoriamente por um subagent, que devolve só o
resumo.** O orquestrador nunca engole output cru — o contexto dele é o
recurso mais caro do sistema, porque é o único que não pode ser
descartado no meio do projeto.

## Planejamento por dependência e execução em ondas

Duas skills em `.claude/skills/` implementam isso na prática:

- **`swarm-planner`** — transforma um pedido em plano com tarefas
  atômicas e `depends_on` explícito. Sem isso, o orquestrador não sabe
  o que pode rodar em paralelo e acaba serializando tudo (lento) ou
  paralelizando errado (conflito de arquivo).
- **`parallel-task`** — lê o plano e acorda **só as tarefas
  desbloqueadas**, em ondas. Tarefa bloqueada não vira subagent, não
  gasta contexto. É a implementação mecânica de "acordar apenas quem
  precisa trabalhar".

O gate de aprovação do diretor continua valendo: cada onda pede
aprovação antes de executar. A skill original não tinha essa trava —
foi adaptada.
