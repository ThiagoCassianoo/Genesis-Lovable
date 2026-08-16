---
name: swarm-planner
description: >
  [INVOCAÇÃO EXPLÍCITA] Cria plano de implementação com dependências
  explícitas entre tarefas, otimizado pra execução em ondas paralelas.
  Use na etapa 3 (Plan) do workflow, depois do Intake confirmado e da
  análise dos especialistas. Não implementa nada — só planeja.
metadata:
  invocation: explicit-only
  adaptado_de: am-will/swarms (swarm-planner), ajustado pras regras da Missões Tech
---

# Planejador por dependência

Transforma o pedido confirmado em plano de tarefas atômicas com
`depends_on` explícito. Sem isso, o orquestrador serializa tudo (lento)
ou paraleliza errado (conflito de arquivo).

## Princípios
1. **Investigar antes de planejar** — arquitetura existente, padrões,
   dependências já em uso. Nunca planejar no escuro.
2. **Documentação fresca** — pra qualquer lib/framework/API externo,
   buscar a doc atual (WebSearch/WebFetch) antes de escrever a tarefa.
   Evita planejar em cima de API que mudou.
3. **Perguntar quando houver ambiguidade** — máx. 8 perguntas por
   rodada, sempre ao diretor (a conversa com pergunta-de-cada-vez sobre
   o pedido em si já aconteceu na Etapa 1, com o `navigator-agent`;
   isto aqui é ambiguidade de plano, uma camada depois). Sempre oferecer
   recomendação junto da pergunta, não perguntar aberto.
4. **Dependência explícita** — toda tarefa declara de que depende.
5. **Tarefa atômica** — executável por um único agente, com critério
   de aceite verificável.
6. **Revisão antes de entregar** — um subagent revisa o plano
   procurando dependência faltando, ordem errada e buraco de escopo.

## Processo
1. **Pesquisa** — arquitetura, padrões, implementações existentes.
2. **Documentação** — buscar doc atual das libs externas envolvidas.
3. **Parar e perguntar** se algo é ambíguo. Não assumir escopo.
4. **Montar o plano** no template abaixo.
5. **Salvar** como `<topico>-plan.md` na raiz do projeto.
6. **Revisão por subagent** — buscar lacuna, ordem quebrada, caso de
   borda ignorado. Revisar o plano se o retorno for acionável.

## Template do plano

```markdown
# Plano: [Nome]

**Gerado em**: [data]

## Visão geral
[Resumo do objetivo e da abordagem]

## Pré-requisitos
- [Ferramenta, lib, acesso necessário]

## Grafo de dependência
T1 ──┬── T3 ──┐
     │        ├── T5 ── T6
T2 ──┴── T4 ──┘

## Tarefas

### T1: [Nome]
- **depends_on**: []
- **location**: [caminhos de arquivo]
- **description**: [o que fazer]
- **validation**: [como verificar que ficou pronto]
- **status**: Não concluída
- **log**: [vazio, preenchido na execução]
- **arquivos alterados**: [vazio, preenchido na execução]

[... repetir pra cada tarefa ...]

## Ondas de execução
| Onda | Tarefas | Pode começar quando |
|---|---|---|
| 1 | T1, T2 | Imediatamente |
| 2 | T3, T4 | Onda 1 concluída |

## Estratégia de teste
- [Vitest unitário / Playwright e2e no caminho crítico]

## Riscos e mitigação
- [O que pode dar errado + como tratar]
```

## Regras da casa (não negociáveis)
- **Não implementa nada.** Só planeja. Código é do
  `implementation-agent`, e só depois de aprovação explícita.
- Toda tarefa que envolva dependência nova, apagar arquivo, tocar
  produção ou fazer commit precisa estar **marcada no plano como
  "requer aprovação do diretor"** — nunca embutida silenciosamente.
- Zero conteúdo inventado. Sem dado real, usar `[a preencher pelo
  diretor]`.
- Ao terminar, o plano vai pro diretor. Nenhuma onda executa antes da
  aprovação dele.
