---
description: Inicia o Intake & Confirmação — navigator-agent conversa com o diretor (uma pergunta de cada vez) até convergir no brief, orquestrador reafirma e confirma
---

Execute a etapa 1 do fluxo (`.claude/rules/orchestration.md`). Isso
vale tanto pra cliente novo quanto pra retomar um cliente existente —
se `docs/clientes/<nome>/` já existir, leia antes de perguntar de novo.

1. Se for cliente novo, confirme o nome/identificador (só pra nomear a
   pasta — não precisa ser formal, pode ajustar depois).
2. Acione `navigator-agent` com o pedido cru, por mais incompleto que
   esteja. Ele conduz a conversa — uma pergunta objetiva de cada vez,
   sempre dizendo o que ela decide. Se a resposta for "não sei", ele
   assume o cenário mais seguro (PREMISSA) e segue, nunca trava.
3. Quando ele convergir, vai devolver o brief + playback de
   confirmação + recomendação de qual(is) especialista(s) acionar.
4. Peça pro `docs-agent`:
   - gravar o brief em `docs/clientes/<nome>/brief.md`;
   - se `docs/clientes/<nome>/manifest.md` ainda não existir, criar
     (lista de repo(s) 2 associados a este cliente — vazio até o
     primeiro nascer; ver `docs/arquitetura-repo1-repo2.md`).
5. Leia o brief, **reafirme o entendimento em 3-5 frases** e peça
   confirmação explícita ao diretor antes de seguir.
6. Só após o "confirmo", monte a tabela de delegação: qual agente
   entra, o que cada um recebe como task, e por quê — o
   `navigator-agent` recomenda, mas quem aciona é o orquestrador.

Não acione nenhum outro agente antes da confirmação. Não gere código.
