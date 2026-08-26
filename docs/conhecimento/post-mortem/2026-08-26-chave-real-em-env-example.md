# Post-mortem — chave real de API colada em `.env.example`
Data: 2026-08-26 · Task: expansão do fallback multi-provider (`runtime/`) · Agente envolvido: nenhum — ação direta do diretor, achado e corrigido pelo orquestrador

## O que quebrou
O diretor colou chave real de API diretamente em `runtime/.env.example`
(o template, TRACKED pelo git, feito pra ir pro GitHub) em vez de
`runtime/.env` (o arquivo real, gitignored). Aconteceu **2 vezes na
mesma sessão**: 1ª vez com `ANTHROPIC_API_KEY`, `GLM_API_KEY`,
`DEEPSEEK_API_KEY`; 2ª vez, depois de um aviso já ter sido adicionado
no topo do arquivo, com `GEMINI_API_KEY` e um valor novo de
`GROQ_API_KEY`.

## Por que quebrou (causa raiz)
`.env.example` e `.env` têm nome quase idêntico e ficam na mesma
pasta — erro humano de arquivo errado aberto no editor, facilitado por
autopreenchimento/histórico de abas parecidas. Não é falta de atenção
pontual: aconteceu 2x mesmo depois de mitigação textual, o que indica
que aviso em comentário não é suficiente sozinho.

## Quanto tempo levou pra detectar
Nas duas vezes, na hora — o orquestrador leu o arquivo por outro
motivo (edição de rotina pra documentar um provider novo) e viu o
valor real antes de qualquer commit. Zero tempo de exposição real:
`git show HEAD` confirmou nas duas vezes que a versão commitada
continuava limpa (só placeholder vazio) — o vazamento nunca saiu da
árvore de trabalho local, nunca chegou ao remoto público.

## Tentativas antes de escalar
Não houve "tentativa que falhou" no sentido do checklist — a correção
funcionou nas duas vezes (migrar a chave real pro `.env`, limpar o
`.env.example`, confirmar com `git grep` no repositório inteiro que
nada ficou). O que falhou foi a PREVENÇÃO da 1ª correção (aviso em
comentário) não ter impedido a 2ª ocorrência.

## Correção aplicada
Nas duas vezes: chave real migrada pro `.env` real (mesclando com o
que já existia, sem sobrescrever chave funcional por um valor
possivelmente truncado — aconteceu com `ANTHROPIC_API_KEY` na 1ª
vez, onde o valor colado no `.env.example` estava sem o prefixo
`sk-ant-api03-`, mantido o valor já correto do `.env`), `.env.example`
limpo de volta pra placeholder, varredura com `git grep` no
repositório inteiro por padrão de chave conhecido confirmando zero
resíduo.

## Regra nova que impede voltar
`[a aplicar pelo diretor]` — nenhum agente deste projeto tem permissão
de criar/editar hook em `.claude/hooks/`; esta proposta precisa ser
aplicada por Thiago diretamente.

**Arquivo:** novo hook `.claude/hooks/guard-env-example-secret.sh`,
registrado em `.claude/settings.json` como `PreToolUse` pros tools
`Write`/`Edit` (mesmo padrão de `guard-red-lines.sh`).

**Conteúdo proposto (mecânica, não texto):** se o `file_path` do
tool call terminar em `.env.example` E o conteúdo novo tiver uma linha
no formato `[A-Z_]+=` seguida de valor com 15+ caracteres alfanuméricos
(mesmo padrão de detecção que o orquestrador já usa manualmente via
`grep -E "=[a-zA-Z0-9._-]{15,}"`), bloquear com exit 2 e mensagem
apontando pro `.env` como destino correto — mesma mecânica de
`guard-red-lines.sh`, aplicada a conteúdo de arquivo em vez de comando
Bash.

**Por que isso e não outra coisa:** mitigação textual (aviso no topo
do arquivo) já foi tentada e não impediu a 2ª ocorrência na mesma
sessão — o padrão do projeto (`CLAUDE.md` § Regras de ouro) é que
qualquer coisa que precise ser garantida de verdade vira trava
mecânica, não só texto.
