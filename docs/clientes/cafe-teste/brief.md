# Brief — cafe-teste

> **TESTE FICTÍCIO DA FÁBRICA. NÃO é cliente real.** Sem dado real de produtor, sem compromisso comercial.
> Data: 2026-10-21 · Etapa 1 (Intake) · Fonte: `navigator-agent` (diretor ausente, 0 perguntas feitas)

## Pedido cru
"sistema pra produtores de café, gestão de lavoura, SaaS completo"

## Escopo
Enxuto, escolhido pelo diretor em 2026-10-21.

## Público (PREMISSA)
Produtor pequeno/médio, dono-operador, usando no celular.

## Fluxo central
1. Cadastrar talhão: {nome, área em ha, variedade}.
2. Registrar atividade: {talhão, data (padrão hoje, não pode ser futura), tipo, nota opcional ≤500 caracteres}.
3. Histórico cronológico por talhão, com filtro por tipo.

Propriedade = 1 campo de configuração, sem tela própria.

## Tipos de atividade
Adubação · Aplicação (defensivo) · Poda · Capina/Roçada · Irrigação · Colheita · Monitoramento (praga/doença) · Outro

## PREMISSAS do navigator-agent (8)
1. Fluxo central conforme descrito acima.
2. Single-tenant, sem multiusuário.
3. Dados fictícios locais, sem Supabase.
4. Sem login.
5. Mobile-first; offline real fora do escopo.
6. Sem pagamento.
7. Fora do escopo: clima, mapa/GPS, estoque, financeiro, NF rural, relatórios, integrações.
8. pt-BR, sem identidade visual própria.

## Critério de sucesso (business-agent, PREMISSA)
1 produtor registra 1 atividade em menos de 1 minuto no celular e responde "quando fiz X neste talhão?" pelo histórico.

## Riscos (business-agent)
- Demo não é validação de mercado. Mostrar a 3-5 produtores reais: `[a preencher pelo diretor]`.
- "Aplicação (defensivo)" não pode prometer conformidade.

## Orçamento e prazo
`[a preencher pelo diretor]`

## Registro de delegação — 2026-10-21
Formato: `agente · objetivo · motivo · resultado · veredito`

- `navigator-agent` · brief com 8 premissas, 0 perguntas, diretor ausente · motivo: Etapa 1 é sempre dele (orchestration.md) · resultado: brief gravado · veredito: n/a
- `business-agent` · propriedade reduzida a campo, 4 campos de atividade, 8 tipos · motivo: 1º da linha Sistema/SaaS; confere a premissa 1 (fluxo central), que define o modelo de dados · resultado: escopo enxuto fechado · veredito: n/a
- `technical-agent` · SPA Vite/React18/TS/Tailwind4, Repository+localStorage trocável por Supabase, exceção declarada ao alto-ticket pendente de ratificação, Playwright fora · motivo: plano precisa de stack, estrutura e critério de aceite antes do implementation-agent · resultado: arquitetura definida · veredito: n/a
- `swarm-planner` · 3 tarefas sequenciais, revisão do plano por subagent pulada (desvio declarado) · motivo: implementation-agent trava sem critério de aceite; critério nasce no Plano (Etapa 3) · resultado: plano em `cafe-teste/cafe-esqueleto-plan.md` · veredito: n/a
- `implementation-agent` · T1-T3 · motivo: único agente autorizado a escrever código · resultado: T1-T3 concluídas; lint/typecheck/32 testes/build/bundle 120.63KB ok · veredito: n/a
- `fiscal-agent` · auditoria da entrega · motivo: obrigatório antes de qualquer entrega sair, nas três linhas · resultado: ver veredito · veredito: revise (só fechamento/registro; produto ok — sem promessa de conformidade, exemplos marcados, Regra 4 ok); observação não-bloqueante: 'Remover exemplos' sem confirmação
- `orquestrador` · E2E real em Chromium 390x844 (vite preview) · motivo: provar 'funciona' sem qa-agent no escopo enxuto · resultado: salvar atividade → topo do histórico → persiste após reload; único erro: 404 favicon.ico · veredito: n/a

Agentes fora por escolha do diretor (escopo enxuto): `backend-master`, `creative-agent`, `qa-agent`, `security-agent`, `reviewer-agent`, `infra-agent`, conselho (checklist 1b: 0 "sim").
