---
description: Gera o pacote de retomada — sessão nova continua do ponto exato, sem refazer nada
---

Escreva (ou atualize) `docs/RETOMADA.md` com o estado atual do
trabalho. Este arquivo é a ponte entre sessões: quando o limite de uso
acabar, a próxima sessão lê **só ele** e continua sem reconstruir
contexto.

Regra de ouro deste comando: escreva para alguém que **não viu esta
conversa**. Nada de "como combinamos" ou "aquele arquivo".

Preencha exatamente esta estrutura:

```markdown
# Retomada — [AAAA-MM-DD HH:MM]

## Tarefa em curso
task_id: [slug curto e estável, ex. backend-agendamento-v1]
Objetivo: [1-2 frases — o resultado esperado, não a atividade]
Etapa do fluxo: [qual das 6 de .claude/rules/orchestration.md]

## Feito (com evidência)
- [o que foi concluído] → [arquivo ou comando que prova]

## Próximo passo imediato
[a primeira ação concreta da próxima sessão — comando ou arquivo, não intenção]

## Bloqueado, aguardando decisão
- [o que trava] → [quem decide] → [a recomendação padrão se ninguém responder]

## Decisões desta sessão ainda não registradas
[o que precisa ir pra docs/decisoes.md — ou "nada pendente"]

## Arquivos tocados
[lista com 1 frase por arquivo]

## Contexto mínimo para retomar
[3-5 linhas. Só o que a próxima sessão NÃO descobre lendo o repositório.]

## O que NÃO fazer ao retomar
[armadilha conhecida, caminho já descartado, decisão já tomada que não deve ser reaberta]
```

Depois de escrever, confirme ao diretor em 3 linhas: task_id, próximo
passo e o que está bloqueado.

**Não** duplique aqui o que já vive em `docs/decisoes.md`,
`docs/conhecimento/` ou `docs/roadmap-time.md` — aponte para eles. Este
arquivo é ponte, não arquivo morto: a próxima sessão o substitui.

Rode este comando quando: o aviso de limite aparecer, antes de um
`/clear`, ao encerrar o dia, ou antes de trocar de máquina.
