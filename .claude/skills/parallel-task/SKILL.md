---
name: parallel-task
description: >
  [INVOCAÇÃO EXPLÍCITA] Lê um plano gerado pelo swarm-planner e executa
  as tarefas em ondas, acordando como subagent SÓ as tarefas
  desbloqueadas. Use na etapa 4 (Implementation), uma onda por vez,
  com aprovação do diretor antes de cada onda.
metadata:
  invocation: explicit-only
  adaptado_de: am-will/swarms (parallel-task), com gate de aprovação por onda adicionado
---

# Executor em ondas

Orquestra subagents a partir de um plano com dependências. **Tarefa
bloqueada não vira subagent** — não gasta contexto. É a implementação
mecânica de "acordar apenas quem precisa trabalhar".

## Processo

### 1. Ler o plano
Extrair de cada tarefa: id, `depends_on`, descrição, location,
critério de aceite, validação. Montar a lista completa.

### 2. Calcular a onda atual
Uma tarefa está **desbloqueada** quando todas as tarefas do
`depends_on` dela estão concluídas. A onda atual = todas as tarefas
desbloqueadas neste momento.

### 3. GATE — aprovação do diretor (regra da casa, obrigatório)
Antes de acordar qualquer subagent, apresentar ao diretor:
- Quais tarefas entram nesta onda e por quê (o que desbloqueou).
- Quais arquivos serão tocados por cada uma.
- Riscos e o que precisa de aprovação especial (dependência nova,
  remoção de arquivo, produção, commit).

**Não executar sem "aprovado" explícito.** Isso vale por onda, não
uma aprovação geral no começo.

### 4. Executar a onda
Acordar em paralelo só as tarefas aprovadas. Cada subagent recebe:

```
Contexto: [objetivo do plano, restrições, tarefas relacionadas]
Tarefa [ID]: [nome]
Location: [arquivos]
Descrição: [completa]
Critério de aceite: [lista]
Validação: [comando/teste que prova que funcionou]

Regras: seguir CLAUDE.md do projeto. Não instalar dependência, não
apagar arquivo, não tocar produção nem fazer commit sem aprovação
explícita — se a tarefa exigir isso, pare e reporte. Rodar lint antes
de considerar concluída. Zero conteúdo inventado.
```

### 5. Verificar antes de avançar
Nenhuma tarefa é marcada como concluída sem evidência: teste passando,
lint limpo, ou verificação concreta descrita no plano. Sem evidência,
a tarefa continua aberta — e as dependentes dela seguem bloqueadas.

### 6. Atualizar o plano
Preencher `status`, `log` e `arquivos alterados` de cada tarefa
concluída. O plano é a memória da execução — se ele não refletir a
realidade, a próxima onda calcula errado.

### 7. Repetir
Recalcular a onda seguinte e voltar ao passo 3 (novo gate). Repetir
até o plano terminar.

## Quando uma tarefa falha (obrigatório)
1. **Não retentar em silêncio.** Uma tentativa; se falhar, para.
2. **A onda inteira para.** Não iniciar tarefa nova enquanto a falha
   não for tratada — evita empilhar erro sobre erro.
3. **Registrar no plano**: `status: Falhou`, `log` com o erro literal
   (não parafraseado) e o que já tinha sido feito antes de quebrar.
4. **Dependentes continuam bloqueadas.** Nunca marcar como concluída
   uma tarefa que falhou pra "destravar o resto".
5. **Avisar o diretor** com: qual tarefa, erro literal, estado parcial
   (o que já foi alterado no disco), e 2 opções concretas de saída.
6. **Retry, rollback ou mudar abordagem é decisão do diretor**, nunca
   do agente. Rollback que envolva apagar arquivo ou `git reset` passa
   pelo gate de aprovação como qualquer outra linha vermelha.

## Evitar conflito de arquivo
Duas tarefas da mesma onda **não podem tocar o mesmo arquivo**. Se o
plano permitir isso, é erro de planejamento: parar, reportar ao
diretor, e serializar as duas em ondas diferentes em vez de arriscar
sobrescrita.

## Economia de contexto
- Subagent devolve **resumo**, nunca output cru. O orquestrador não
  engole log inteiro, diff completo nem varredura de arquivo.
- Tarefa bloqueada não é acordada — nem pra "já ir adiantando".
- Onda grande demais (mais de 4-5 tarefas simultâneas) normalmente
  indica plano mal fatiado: avisar o diretor antes de disparar.
