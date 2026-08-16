---
description: Executa a próxima onda do plano aprovado (skill parallel-task) — argumento opcional&#58; IDs de tarefa
argument-hint: [IDs das tarefas, opcional]
---

Execute a etapa 4 do fluxo (`.claude/rules/orchestration.md`) usando a skill
`parallel-task`.

Tarefas: $ARGUMENTS (se vazio, calcule a próxima onda desbloqueada).

Antes de acordar qualquer subagent, apresente ao diretor: quais
tarefas entram, quais arquivos serão tocados, e o que exige aprovação
especial. **Aguarde "aprovado".**

Só o `implementation-agent` edita arquivo. Uma onda por vez. Nenhuma
tarefa é marcada como concluída sem evidência (teste passando ou lint
limpo).
