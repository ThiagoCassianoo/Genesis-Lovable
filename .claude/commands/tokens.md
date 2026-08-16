---
description: Diagnostica o consumo de contexto da sessão e sugere cortes
---

Analise o estado atual do contexto e reporte:

1. O que está ocupando mais espaço (arquivo lido inteiro, output cru de
   ferramenta, histórico longo).
2. O que pode ser descartado sem perder decisão aprovada.
3. Se algum output grande entrou direto no orquestrador em vez de ter
   passado por subagent — isso é violação da regra de economia de
   contexto (`CLAUDE.md`).

Sugira cortes concretos. Não descarte nada sozinho.
