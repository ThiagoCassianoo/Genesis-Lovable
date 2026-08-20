# Roadmap de evolução do time de agentes

> ⚠️ **DOCUMENTO HISTÓRICO CONGELADO EM 2026-08-15.**
> A auditoria de 2026-08-17 encontrou aqui: 3 contagens de agente
> erradas (dizia 12/13/14 — hoje são 16), contagem de comandos errada
> (dizia 7 — hoje são 10), 7 links apontando pra arquivos movidos pra
> `_quarentena/` na mesma rodada que este doc narra, e estado de stack
> revogado ("aguarda aprovação do diretor" — Supabase foi aprovada em
> 2026-08-16).
>
> Causa raiz: este arquivo e `docs/decisoes.md` faziam a mesma coisa —
> registro cronológico do que foi construído e por quê. `decisoes.md`
> foi mantido, este fossilizou. Duplicação garante drift (é a mesma
> lição já registrada em `decisoes.md` sobre `COMMANDS.md` e
> `docs/patterns/`).
>
> **Fonte de verdade do estado atual: `docs/decisoes.md`.** Este
> arquivo vale como narrativa de COMO o time chegou até aqui (Etapas 1
> a 3), não como estado. Os links foram corrigidos pra não mandar
> ninguém pra arquivo inexistente; as contagens foram deixadas como
> estavam, porque reescrevê-las apagaria o registro histórico — leia
> as datas.

Registro vivo de onde o time está e o que falta — pra qualquer sessão
(esta ou o operacional) saber o estado real sem depender de histórico
de chat.

## Etapa 1 — Intake & Confirmação (concluída)
Formalizada dentro do `CLAUDE.md` (Workflow, item 1) e `docs/_quarentena/workflow.md`.
Não é agente novo — é o orquestrador (Claude Code + CLAUDE.md) fazendo
3 coisas antes de delegar: perguntar, reafirmar entendimento, montar
tabela de delegação. Zero custo de contexto extra (não é chamada de
subagente).

## Etapa 1b — Arquitetura e orquestração (concluída)
- `docs/_quarentena/arquitetura-agentes.md` — decisão Subagents vs Agent Teams,
  hierarquia sob demanda, regra de roteamento de output grande.
- `.claude/skills/swarm-planner/` — plano com dependência explícita.
- `.claude/skills/parallel-task/` — execução em ondas, só tarefa
  desbloqueada, gate de aprovação por onda.
Ambas adaptadas de `am-will/swarms` (não copiadas cegas: ganharam o
gate de aprovação, as red lines e o formato da casa).

## Etapa 1c — Conselho (concluída)
3 agentes de deliberação: `conselho-otimista`,
`conselho-advogado-diabo`, `conselho-analista-neutro`. Acionados em
paralelo e independentes (sem ver a resposta um do outro — evita
ancoragem). Mestre do Conselho = orquestrador, não é agente (subagente
não acorda subagente).
Trava de custo: só em decisão cara de desfazer, direção estratégica,
ou quando o diretor pedir. Registrada no `CLAUDE.md` e no
`docs/_quarentena/workflow.md` (etapa 1b).

**Primeiro uso previsto:** a decisão de stack da Etapa 2 (backend) é
exatamente o tipo de decisão que o Conselho existe pra pressionar.

## Etapa 1d — Auditoria e correção estrutural (concluída)
Auditoria com evidência encontrou e corrigiu:
- Numeração de workflow divergente entre `CLAUDE.md` e
  `docs/_quarentena/workflow.md` → `docs/_quarentena/workflow.md` virou fonte única; o
  `CLAUDE.md` não numera mais etapa.
- Comandos documentados mas inexistentes → implementados em
  `.claude/commands/` (7); `COMMANDS.md` removido (duplicação).
- `README.md` dizia 5 agentes (havia 8) e omitia skills → reescrito.
- Sem memória entre sessões → `docs/decisoes.md` (append-only).
- Sem trava mecânica → `.claude/hooks/guard-red-lines.sh` +
  `.claude/settings.json` bloqueiam install/rm/push/commit/reset.
- Sem MCP registrado → `.mcp.json` com Playwright.
- Sem teste do próprio time → `docs/_quarentena/testes-agentes.md`.
- Sem tratamento de falha na execução → regra escrita no
  `CLAUDE.md` e na skill `parallel-task`.
- Nomenclatura órfã ("Discovery") e critério de contratação
  desatualizado (ignorava os conselheiros) → corrigidos.

## Etapa 2 — Agentes de linha de produto (concluída)
Criados: `backend-master`, `security-agent`, `qa-agent`,
`marketing-master`. Time passou de 8 para 12 agentes.

Justificativa do que **não** virou agente: **produto** ficou dentro do
`business-agent` (sobreporia o titular — critério 2), que ganhou
diagnóstico com rótulo FATO/HIPÓTESE/PREMISSA e roadmap 30-60-90.

Cobertura das 7 faixas pedidas pelo diretor: business ✓ (business),
produto ✓ (business estendido), frontend ✓ (technical + creative +
implementation), backend ✓ (backend-master), marketing ✓
(marketing-master), QA ✓ (qa-agent funcional + reviewer visual),
segurança ✓ (security-agent).

**Pendente e bloqueante:** a stack de backend não foi decidida. O
`backend-master` existe e sabe conduzir a decisão, mas não pode
projetar schema nem auth antes dela. Primeiro caso de uso do Conselho:
- Backend: Node+Postgres, Supabase, ou outro — a decidir.
- Autenticação, multi-tenant (1 cliente = 1 instância, ou multi-cliente
  na mesma base?), pagamento (se aplicável).
- Sub-agentes acionados sob demanda pelo `backend-master` (não todos
  de uma vez): auth, banco/schema, API, integração de pagamento —
  cada um só entra quando a task pedir aquele detalhe específico,
  pra não gastar contexto à toa.
Critério de contratação (mesmo de sempre) se aplica a cada sub-agente
antes de criar o arquivo dele.

## Etapa 2b — infra-agent + 1ª deliberação do Conselho (concluída)
- `infra-agent` criado: deploy, CI/CD, ambientes, segredos, DNS/SSL,
  backup com data do último teste de restauração, monitoramento em 3
  camadas, custo mensal. Obrigatório antes do primeiro deploy.
  Time: 13 agentes.
- Conselho rodou pela primeira vez de verdade, na decisão de stack.
  Resultado unânime (Supabase + instância por cliente + pagamento fora
  do v1) com 5 condições e uma prova barata de US$ 0 sugerida.
  Registrado em `docs/decisoes.md`. **Aguarda aprovação do diretor.**

## Etapa 2c — Arquitetura de referência (concluída, condicional)
`backend-master` rodou e produziu `docs/arquitetura-agendamento.md`:
modelo de dados completo do agendamento de espaços de igreja, RLS por
tabela × operação, script de teste negativo, plano de migração e o que
já fica pronto (a custo zero) caso um dia vire multi-tenant.

É o **molde** — 2º cliente deve ser replay das migrations + rebrand.

Condicional à aprovação da stack. Nada aplicado: nenhum projeto
criado, nenhuma migration rodada.

## Etapa 2d — Fechamento de brechas (concluída)
Teoria de agentes aplicada; gaps fechados:
- **Utility-based** → `docs/_quarentena/prioridades.md`. O orquestrador e os
  mestres resolvem conflito sozinhos; só empate real sobe, e sobe como
  pergunta com recomendação, nunca travando a entrega.
- **Model-based reflex completo** → leitura obrigatória de
  `decisoes.md` + `conhecimento/` antes de qualquer recomendação.
  Acabou o "recomendar sem ter lido".
- **Contrato de entrada** nos 13 — cada um declara o que precisa
  receber e o que faz quando falta.
- **Modelo por agente** no frontmatter: `opus` onde errar é caro e
  difícil de detectar (implementation, security, backend-master),
  `sonnet` no resto.
- **Observabilidade** → `.claude/hooks/observability.sh` grava agente,
  input, output e erro em JSONL. Testado.
- **Loop de feedback** → `docs/conhecimento/` com regra de fechamento
  obrigatória: entrega não fecha sem catalogar o que funcionou e
  transformar o que quebrou em regra nova.
- **Grafo e arestas** → `docs/_quarentena/grafo-agentes.md`. Sem comunicação
  agente↔agente: tudo pelo orquestrador, cada um recebe só o recorte
  do escopo dele.
- **Guardrails** → `docs/_quarentena/guardrails.md`, as 5 camadas do NeMo
  implementadas com mecanismo nativo do Claude Code. NeMo em si
  rejeitado: é runtime Python, exigiria proxy na frente do Claude Code.

## Etapa 2e — Arquitetura limpa + fiscalização (concluída)
- `.claude/rules/` com 5 arquivos: 2 por `@import` (orchestration,
  quality-gates) e 3 sob demanda (security, agent-contracts, memory).
- `CLAUDE.md` virou índice enxuto: identidade, 8 regras de ouro,
  imports, stack, tabela do time, ponteiros. Sem duplicar conteúdo.
- `fiscal-agent` (14º, opus): audita genérico, pela metade, sem
  evidência, fora de contrato, promessa vs entrega e ciclo de
  fechamento — com evidência citável, nunca impressão.
- 8 docs consolidados foram pra `docs/_quarentena/` em vez de apagados,
  cumprindo a política de descarte. `docs/conhecimento/patterns/` fundido em
  `docs/conhecimento/patterns/`.
- 7 referências quebradas pelo refactor foram detectadas por varredura
  e corrigidas — caminho **e** numeração de etapa, que também mudou.

## Etapa 3 — Sub-clusters sob demanda (não implementada)
`backend-master` e `marketing-master` existem como mestres, mas ainda
sem sub-especialistas (auth, schema, pagamento / ads, SEO, conteúdo,
analytics). Hoje cada mestre cobre a faixa inteira sozinho — funciona,
mas perde profundidade em task muito específica.

Só criar sub-agente quando aparecer **task real** que o mestre não deu
conta sozinho. Criar antes disso é inchaço: 4 sub-agentes de backend
parados custam manutenção e confundem o roteamento, sem entregar nada.

## Ordem de ataque
1. Intake & Confirmação — feito.
2. backend-master — próximo (stack é pré-requisito dos outros dois).
3. marketing-master — depois do backend, pra recomendar retorno sobre
   produto que o time já sabe entregar de verdade.

## Regra de trânsito entre sessões
Esta sessão (conselho) desenha e escreve o arquivo. O operacional
(Codespace) executa quando envolver código real ou setup de
ferramenta. Sincronização é sempre via zip atualizado — nunca as duas
sessões editam o mesmo arquivo em paralelo sem sync.
