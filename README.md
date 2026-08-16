# Missões Tech — Sistema de Agentes (Claude Code)

Sistema operacional da consultoria: 16 agentes reais que o Claude Code
carrega sozinho, com gate de aprovação, economia de contexto, trava
mecânica das linhas vermelhas e fiscalização das próprias entregas.

## Instalar num projeto

```bash
cp missoes-tech-agentes/CLAUDE.md   /caminho/do/projeto/CLAUDE.md
cp missoes-tech-agentes/.mcp.json   /caminho/do/projeto/.mcp.json
cp -r missoes-tech-agentes/.claude  /caminho/do/projeto/.claude
cp -r missoes-tech-agentes/docs     /caminho/do/projeto/docs
chmod +x /caminho/do/projeto/.claude/hooks/*.sh
```

Abra o Claude Code na pasta. Ele carrega o `CLAUDE.md` como memória e
descobre agentes, skills, comandos e hooks sozinho.

## Arquitetura

```
CLAUDE.md                    índice enxuto + regras de ouro + @imports
.claude/
├── rules/                   como o sistema opera
│   ├── orchestration.md     fluxo, grafo, delegação  [@import: sempre]
│   ├── quality-gates.md     utilidade, vereditos, pronto  [@import: sempre]
│   ├── security.md          injeção, guardrails, limites  [sob demanda]
│   ├── agent-contracts.md   contrato, classificação, descarte  [sob demanda]
│   └── memory.md            decisão, conhecimento, fechamento  [sob demanda]
├── agents/                  16 agentes
├── skills/                  swarm-planner, parallel-task
├── commands/                10 comandos
├── hooks/                   red lines + retry-loop + decisão-lida + continuidade + observabilidade
└── settings.json            registro dos hooks
docs/                        conhecimento do projeto (não é regra)
```

**A distinção que sustenta a estrutura:** `.claude/rules/` é **como o
sistema opera** — muda quando a metodologia muda. `docs/` é **o que o
projeto sabe** — decisões, conhecimento acumulado, curadoria, estado.

`.claude/rules/` **não é carregado automaticamente** pelo Claude Code.
Só `agents/`, `skills/`, `commands/`, `hooks/` e `settings.json` são.
As regras entram por `@import` no `CLAUDE.md` — e só as duas que toda
sessão precisa. As outras três são lidas sob demanda, porque tudo que
é importado ocupa contexto em toda sessão, inclusive nas que não usam
aquilo.

## O time

**Intake (1)** — `navigator-agent`, primeiro agente do fluxo. Conversa
com o diretor sobre o pedido cru — uma pergunta objetiva de cada vez —
até montar o `brief.md`. Nunca trava: "não sei" vira PREMISSA e segue.

**Titulares (6)** — `business`, `creative`, `technical`,
`backend-master`, `marketing-master`, `infra-agent`.

**Execução (2)** — `implementation-agent` (código, só `src/`) e
`docs-agent` (registro: `docs/conhecimento`, `decisoes.md`,
`RETOMADA.md`, `brief.md`, marcadores de auditoria). Únicos com
permissão de escrita. Não é regra que eles lembram: os outros 14 não
têm Write/Edit no allowlist.

**Validação (4)** — `qa-agent` (funciona?), `security-agent` (seguro?),
`reviewer-agent` (padrão e conversão), `fiscal-agent` (cumpriu a
documentação?).

**Conselho (3)** — `conselho-otimista`, `conselho-advogado-diabo`,
`conselho-analista-neutro`. Deliberam em paralelo e **sem ver a
resposta um do outro** — independência evita ancoragem.

Modelo: `opus` onde errar é caro e difícil de detectar
(`implementation`, `security`, `backend-master`, `fiscal`); `sonnet` no
resto.

## Comandos
`/intake` · `/conselho` · `/analyze` · `/plan` · `/build` · `/audit` ·
`/fiscal` · `/tokens` · `/retomar` · `/aprovar`

## Mecânica de bloqueio (o que é hook de verdade, não só regra em texto)
`guard-red-lines.sh` (install/rm/deploy/commit) e `guard-retry-loop.sh`
(2 falhas iguais bloqueiam a 3ª tentativa) travam **antes** da ação.
`guard-decisoes-lida.sh` trava **depois** — ao fim da execução de um
agente titular, se não houver sinal de que ele leu `docs/decisoes.md`.
Desbloqueio de install/rm/deploy é por marcador de uso único
(`/aprovar`, mesmo padrão do gate de commit). Das 8 Regras de Ouro do
`CLAUDE.md`, só 1, 7 e 8 têm essa trava mecânica hoje — as outras 5
continuam dependendo do agente seguir o texto (ver
`docs/decisoes.md`, 2026-08-16, "Mecanização de regras de ouro").

## Continuidade automática
`check-retomada-antes-compactar.sh` (PreCompact) bloqueia compactação
se `docs/RETOMADA.md` não tiver sido atualizado hoje. `inject-retomada-ao-resumir.sh`
(SessionStart, matcher `resume`) injeta o conteúdo de `RETOMADA.md`
sozinho ao retomar sessão — não depende de alguém lembrar de mandar
ler o arquivo.

## Estado atual
Linha **site/landing page**: completa. **SaaS/sistema**: time pronto,
stack **aprovada** (Supabase, uma instância por cliente, pagamento fora
do v1 — `docs/decisoes.md`, 2026-08-16), `backend-master` desbloqueado.
**Marketing como jornada**: mestre pronto, nunca rodado em caso real.

`docs/_quarentena/` guarda os arquivos consolidados em `.claude/rules/`
— não são regra vigente, aguardam uma rodada antes da remoção
definitiva, conforme a política de descarte.
