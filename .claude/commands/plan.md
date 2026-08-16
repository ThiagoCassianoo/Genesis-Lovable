---
description: Gera plano com dependências explícitas (skill swarm-planner), sem código
---

Execute a etapa 3 do fluxo (`.claude/rules/orchestration.md`) usando a skill
`swarm-planner`.

Saída: plano com tarefas atômicas, `depends_on` explícito, ondas de
execução, critério de aceite e validação por tarefa.

Zero código nesta etapa. Marque no plano toda tarefa que exigir
aprovação especial (dependência nova, remoção de arquivo, produção,
commit).

Ao terminar, entregue ao diretor e **pare**. Nenhuma onda executa antes
da aprovação.
