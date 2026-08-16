# Classificação e matriz de destino dos 13 agentes

Dois usos: entender o **tipo dominante** de cada agente (evita criar
agente novo pra função que já existe) e registrar a **decisão de
destino** de cada um a cada rodada de evolução.

Classificação é analítica. Nenhum agente foi alterado pra caber numa
categoria — híbrido que funciona continua híbrido.

## Tipo dominante

| Agente | Tipo dominante | Por quê | Híbrido com |
|---|---|---|---|
| Orquestrador (não é agente) | Hierárquico | Coordena, delega e sintetiza; único que acorda os outros | Orientado a utilidade (aplica `prioridades.md`) |
| `business-agent` | Orientado a objetivo | Planeja caminho até um objetivo de negócio (30/60/90) | Reflexivo baseado em modelo (lê `decisoes.md` antes) |
| `creative-agent` | Ferramenta especializada | Devolve artefato delimitado: direção + conceitos | Orientado a utilidade (justifica por princípio) |
| `technical-agent` | Orientado a utilidade | Compara alternativas por custo de performance e risco | — |
| `backend-master` | Hierárquico | Dono de camada, acorda sub-especialistas sob demanda | Orientado a utilidade (trade-off explícito) |
| `marketing-master` | Hierárquico | Conduz jornada em etapas, aciona sub-especialistas | Orientado a objetivo |
| `infra-agent` | Orientado a utilidade | Pondera custo, risco operacional e simplicidade | Revisor (checklist pré-deploy bloqueante) |
| `security-agent` | Revisor | Avalia resultado de outro; não produz, audita | — |
| `qa-agent` | Revisor | Avalia se a entrega faz o que prometeu | Ferramenta especializada (executa teste) |
| `reviewer-agent` | Revisor | Auditoria final, nota e problemas | — |
| `implementation-agent` | Ferramenta especializada | Executa etapa aprovada e devolve artefato | — |
| `conselho-otimista` | Orientado a utilidade | Pontua a decisão por uma lente de valor | — |
| `conselho-advogado-diabo` | Orientado a utilidade | Pontua por lente de risco | — |
| `conselho-analista-neutro` | Orientado a utilidade | Separa fato de suposição, mede trade-off | — |

**Lacunas de tipo que sobraram:** não existe **agente de aprendizagem**
como nó do grafo, e isso é decisão consciente — o aprendizado do
sistema vive no ciclo de fechamento (`docs/conhecimento/`), operado
pelo orquestrador. Criar um agente só pra "aprender" seria um nó que
não produz entrega. Se um dia o banco de conhecimento ficar grande a
ponto da busca manual falhar, aí vira lacuna real.

## Matriz de destino — rodada de 2026-08-15

Estados possíveis: **Preservar** (funciona, continua) · **Melhorar**
(funciona com limitação) · **Consolidar** (duplicidade) · **Isolar**
(precisa de fronteira) · **Deprecated** (não recebe uso novo, ainda
existe) · **Remover** (sem uso, valor ou dependência).

| Componente | Uso | Problema | Decisão | Evidência |
|---|---|---|---|---|
| 13 agentes | Ativo | Nenhum sem dono de faixa | Preservar | Frontmatter válido nos 13; só implementation escreve |
| `COMMANDS.md` | Nenhum | Duplicava `.claude/commands/` | **Removido** | Ver ressalva abaixo |
| Tabela de comandos no `CLAUDE.md` | Ativo | Duplicava a mesma lista | Consolidar | Virou ponteiro pra `.claude/commands/` |
| Numeração de etapas no `CLAUDE.md` | Ativo | Divergia de `workflow.md` | Consolidar | `workflow.md` virou fonte única |
| `docs/patterns/` | Nunca usado | Criado e nunca populado | Preservar | Mecanismo correto; depende de entrega real acontecer |
| `.mcp.json` (headroom) | Não registrado | Config não verificada | Isolar | Só Playwright entrou; headroom aguarda verificação no operacional |
| `docs/arquitetura-agendamento.md` | Referência | Condicional à stack | Preservar | É o molde; vira definitivo quando a stack for aprovada |

**Ressalva registrada contra mim mesmo:** apaguei o `COMMANDS.md` na
mesma passada em que o diagnostiquei, sem passar por `deprecated` nem
quarentena. Funcionou porque era duplicação pura, sem dependência — mas
foi processo errado. A regra abaixo existe pra isso não repetir.

## Política de descarte (obrigatória a partir de agora)
Antes de remover qualquer coisa:
1. Procurar referência, dependência, chamada indireta, menção em doc e
   uso em teste (`grep -rn` no repositório inteiro).
2. **Não remover na mesma passada em que diagnosticou.** Marcar como
   `deprecated` primeiro, ou mover pra `docs/_quarentena/`.
3. Remoção definitiva só depois de uma rodada sem ninguém sentir falta.
4. Registrar em `docs/decisoes.md`: o que saiu, por quê, e o que ficou
   no lugar.

Exceção única: duplicação literal e comprovada de um arquivo que
continua existindo íntegro em outro lugar — e ainda assim, registrando.
