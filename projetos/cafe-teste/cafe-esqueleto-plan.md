# Plano: Esqueleto Café (teste da fábrica — NÃO é cliente real)

**Gerado em**: 2026-10-21

## Visão geral
MVP-esqueleto de diário de lavoura: talhão → registrar atividade → histórico por talhão.
SPA 100% cliente, dados em localStorage atrás de uma interface `Repository` trocável por Supabase.
Fonte: brief (navigator-agent), análise de negócio (business-agent) e técnica (technical-agent) desta sessão.

## Pré-requisitos
- Node 22 (verificado no container: v22.22.0).
- Instalação de dependências npm — **requer aprovação do diretor** (dada na sessão: "me entrega funcionando o primeiro mvp").
- Versões conferidas no registro npm em 2026-10-21: tailwindcss 4.3.3 (+ @tailwindcss/vite), vitest 5.0.5, zod 4.6.7,
  react-router-dom 7.18.4, @tanstack/react-query 5.104.5, react-hook-form 7.90.0, @hookform/resolvers 6.0.0.
  React fixado em **18** (CLAUDE.md § Stack), apesar da latest ser 19.3.1.

## Grafo de dependência
T1 ── T2 ── T3

## Tarefas

### T1: Scaffold do projeto
- **depends_on**: []
- **location**: package.json, vite.config.ts, tsconfig*.json, eslint.config.js, index.html, src/main.tsx, src/styles/
- **description**: Vite + React 18 + TS + Tailwind v4 + Vitest(jsdom) + ESLint. Scripts: dev, build, lint, test, typecheck, check:bundle.
- **validation**: `npm run build` e `npm run lint` passam com app vazio.
- **requer aprovação do diretor**: sim (npm install) — aprovado na sessão.
- **status**: Concluída (2026-10-21)
- **log**: `git init` + `.gitignore`. Desvios de versão: `typescript@~5.9` (TS 7.0.2 é a latest, mas typescript-eslint 8.72 exige `>=4.8.4 <6.1.0`);
  `@hookform/resolvers@5.9.2` em vez de 6.0.0 (v6 deu ERESOLVE em peer opcional `effect@^4` via cadeia `@typeschema` — v5.9 suporta `zod ^3.25 || ^4`, sem `--legacy-peer-deps`);
  `@testing-library/dom` adicionado (peer obrigatório do RTL 16); `jsdom` resolveu 29.x; `@types/node@22` (tsconfig.node). Sem radix (Button/Input/Label/Select/Textarea copiados à mão com cva+clsx+tailwind-merge).
  Validação: lint e build verdes com app vazio (45,71 KB gzip).
- **arquivos alterados**: .gitignore, package.json, package-lock.json, tsconfig.json, tsconfig.app.json, tsconfig.node.json, vite.config.ts, eslint.config.js, index.html, src/main.tsx, src/styles/index.css, src/test/setup.ts

### T2: Camada de domínio + testes
- **depends_on**: [T1]
- **location**: src/lib/{schemas.ts,dates.ts,ptBrNumber.ts,repository/*}, src/data/{tiposAtividade.ts,seedExemplos.ts,config.ts}, testes *.test.ts
- **description**: Repository async (listTalhoes, createTalhao, listAtividades, createAtividade, resetExemplos), chave `cafe:v1` + schemaVersion,
  zod.safeParse na leitura (JSON corrompido → erro tratado), `hojeLocal()` sem toISOString, ordenação data desc + criadoEm desc,
  exemplos `ficticio: true` com prefixo "[EXEMPLO]".
- **validation**: Vitest cobre os casos listados pelo technical-agent (repositório, validação, hojeLocal 23:30 UTC-3).
- **status**: Concluída (2026-10-21)
- **log**: 29 testes verdes. Repositório expõe também `getTalhao`, `removerExemplos` e `recomecar` (saída do estado corrompido); erro tipado `RepositoryError` com códigos CORROMPIDO/ESCRITA/NAO_ENCONTRADO.
  Empate total (mesma data e criadoEm) → último inserido primeiro. Teste de fuso usa `vi.stubEnv('TZ','America/Sao_Paulo')` + `vi.setSystemTime` e afirma `getTimezoneOffset()===180` pra provar que o fuso entrou.
  1 falha intermediária: typecheck `Cannot find name 'process'` no teste de data — corrigida trocando `process.env.TZ` por `vi.stubEnv` (não se repetiu).
- **arquivos alterados**: src/data/{config.ts,tiposAtividade.ts,seedExemplos.ts}, src/lib/{dates.ts,ptBrNumber.ts,schemas.ts}, src/lib/repository/{types.ts,localStorageRepository.ts}, testes src/lib/{dates,schemas}.test.ts, src/lib/repository/localStorageRepository.test.ts

### T3: Telas + teste de integração + orçamento de bundle
- **depends_on**: [T2]
- **location**: src/{pages,layouts,sections,components}, scripts/check-bundle.mjs
- **description**: Home (talhões + botão fixo "Registrar atividade" na thumb zone), /registrar, /talhoes/novo, /talhoes/:id (histórico com filtro por tipo).
  Estados vazio/erro/carregando/sucesso; RHF+Zod com mensagens pt-BR; aviso "dados só neste aparelho"; badge de exemplo; nenhuma promessa de conformidade.
- **validation**: teste de integração (Testing Library) do caminho feliz; `npm run build && npm run check:bundle` (< 200KB gzip JS);
  `grep -E "three|gsap|lenis|framer" package.json` vazio.
- **status**: Concluída (2026-10-21)
- **log**: 32/32 testes (3 de integração: caminho feliz com erro de validação + filtro por tipo; dado corrompido → recomeçar; exemplos no 1º uso → remover).
  1 falha intermediária no teste (dois `role="status"` simultâneos — aviso de sucesso + carregando histórico); asserção ajustada pra `getByText(...).toHaveAttribute('role','status')`, app não mudou.
  Saídas finais: lint exit 0; typecheck exit 0; test 32 passed; build ok (JS 394,25 KB / 125,05 KB gzip); check:bundle TOTAL 120,63 KB < 200 KB; grep three|gsap|lenis|framer vazio (exit 1).
  Sucesso só após `mutateAsync` resolver (navega com aviso). Remover exemplos apaga também atividades registradas em talhão de exemplo — copy avisa.
- **arquivos alterados**: src/App.tsx, src/App.integration.test.tsx, src/main.tsx, src/layouts/AppLayout.tsx, src/pages/{HomePage,RegistrarAtividadePage,NovoTalhaoPage,TalhaoPage,NaoEncontradaPage}.tsx,
  src/sections/{TalhoesSection,BotaoRegistrarFixoSection,AtividadeFormSection,TalhaoFormSection,HistoricoSection}.tsx,
  src/components/{AvisoSucesso,EstadoCarregando,EstadoErro,EstadoVazio,ExemploBadge,FormField,VoltarLink}.tsx, src/components/ui/{Button,Input,Label,Select,Textarea}.tsx, src/components/ui/{buttonVariants,fieldStyles}.ts,
  src/lib/{cn.ts,queries.ts,avisoNavegacao.ts}, src/lib/repository/{RepositoryContext.ts,RepositoryProvider.tsx,useRepository.ts}, scripts/check-bundle.mjs

## Ondas de execução
| Onda | Tarefas | Pode começar quando |
|---|---|---|
| 1 | T1 | Imediatamente |
| 2 | T2 | T1 concluída |
| 3 | T3 | T2 concluída |

Sequencial de propósito: as 3 tocam package.json/src e paralelizar geraria conflito de arquivo.

## Estratégia de teste
- Vitest unitário (domínio) + 1 integração do caminho feliz. Playwright e2e fica FORA (encolhimento declarado pelo technical-agent).

## Riscos e mitigação
- localStorage sem backup → aviso visível "dados só neste aparelho".
- Sem editar/apagar atividade → registrado como próxima adição.
- Exceção ao padrão alto-ticket (sem R3F/GSAP/Lenis/Framer) → pendente de ratificação do diretor.
- Revisão do plano por subagent: **pulada** por pedido de caminho mais rápido (desvio declarado do swarm-planner).
