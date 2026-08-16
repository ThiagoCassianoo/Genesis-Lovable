# Grafo de agentes — nós, arestas e o que é proibido

O time não é uma lista, é um **grafo dirigido**. Aresta que não está
aqui não existe: agente não conversa com quem não deve, e não recebe
contexto fora do seu escopo.

## Nós
- **Orquestrador** (não é agente — é o Claude Code com o `CLAUDE.md`).
  Único nó com permissão de acordar outros. Acumula o papel de Mestre
  do Conselho.
- **Conselho (3)** — deliberação.
- **Especialistas (9)** — análise.
- **Implementação (1)** — único que escreve.

## Arestas permitidas

```
                        ┌──────────────────┐
   diretor ────────────▶│   ORQUESTRADOR   │◀──── resumo de todos
                        └────────┬─────────┘
                                 │ (acorda sob demanda)
        ┌────────────────┬───────┼────────┬─────────────────┐
        ▼                ▼       ▼        ▼                 ▼
   ┌─────────┐     ┌──────────┐ ┌───────────┐        ┌─────────────┐
   │CONSELHO │     │ ANÁLISE  │ │ EXECUÇÃO  │        │  VALIDAÇÃO  │
   │otimista │     │ business │ │implement. │        │ qa-agent    │
   │diabo    │     │ creative │ │  (opus)   │        │ security    │
   │neutro   │     │ technical│ └───────────┘        │ reviewer    │
   │(paralelo│     │ backend  │                      │ infra       │
   │ e cego) │     │ marketing│                      └─────────────┘
   └─────────┘     └──────────┘
```

**Regra das arestas:** toda comunicação passa pelo orquestrador. Não
existe aresta agente↔agente direta. Isso é decisão, não limitação:
- Evita que um agente polua o contexto do outro com opinião fora de
  escopo.
- Mantém o orquestrador como único ponto que enxerga o todo.
- É o que torna a economia possível — cada agente recebe só o recorte
  que precisa, não a conversa inteira.

## Arestas proibidas (explícito)
| Proibido | Por quê |
|---|---|
| Conselheiro ↔ conselheiro | Ancoragem. A independência é o que dá valor às 3 leituras. |
| Especialista → implementação (direto) | Só o orquestrador libera execução, e só após aprovação do diretor. |
| Qualquer agente → diretor (direto) | O orquestrador sintetiza. Diretor recebendo 5 relatórios crus é o problema que o sistema existe pra resolver. |
| Agente → agente pedindo permissão | Agente não aprova ação de outro. Permissão é do diretor, via gate. |

## Sequências obrigatórias (arestas com ordem)
- **Site/landing:** business → creative → technical → implementation → reviewer
- **Sistema/SaaS:** business → backend-master → technical → implementation → qa → security → infra → reviewer
- **Marketing:** marketing-master (business entra se a dúvida for de oferta)
- **Decisão de peso:** Conselho (3 em paralelo) → síntese → decisão

`security-agent` é obrigatório com login/pagamento/dado pessoal.
`infra-agent` é obrigatório antes do primeiro deploy. `qa-agent` roda
antes do `reviewer-agent` em sistema.

## Sincronização de contexto
O que cada agente recebe do orquestrador:
1. **O recorte da task** — não o histórico da conversa.
2. **Os inputs obrigatórios do contrato dele** (ver o arquivo de cada
   agente).
3. **O que já foi decidido** que afeta a task (`docs/decisoes.md`).
4. **O que já existe no banco de conhecimento** sobre aquilo.

O que ele **não** recebe: opinião de outro especialista sobre assunto
fora do escopo dele, histórico de decisões revogadas, e output cru de
ferramenta. Isso é o que mantém a resposta em contexto — agente com
contexto demais responde sobre o que não é dele.

## Volta ao orquestrador
Todo agente devolve **resumo no formato fixo dele**, nunca output cru.
O orquestrador é o recurso mais caro do sistema: é o único contexto
que não pode ser descartado no meio do projeto.
