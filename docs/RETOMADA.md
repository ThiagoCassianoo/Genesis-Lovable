# Retomada — 2026-10-21

## Tarefa em curso
task_id: nenhuma aberta na fábrica
Objetivo: não há tarefa em andamento. O Case-Study é repositório separado, fora daqui.
Etapa do fluxo: ciclo do teste café fechado (Etapa 6 executada).

## Feito (com evidência)
- Ciclo café ponta a ponta com 7 agentes + fiscal `pass` → `docs/clientes/cafe-teste/brief.md` (registro de delegação).
- Esqueleto versionado em `projetos/cafe-teste/` (decisão 1B) → `docs/clientes/cafe-teste/manifest.md`.
- Exceção alto-ticket ratificada para MVP de sistema/SaaS → `docs/decisoes.md` (2026-10-21), `CLAUDE.md` § Stack.
- Hook `guard-env-example-secret.sh` aplicado → `docs/decisoes.md` (2026-10-21).
- Bit +x dos hooks restaurado (9 hooks) → `docs/decisoes.md` (2026-10-21).
- self-test verde, 188 checagens / 0 falha (`npm test` em `runtime/`) → `docs/decisoes.md` (2026-10-21).
- `TASKS.md` na raiz é o lugar único de prioridade.
- Padrão reaproveitável registrado → `docs/conhecimento/repository-localstorage-trocavel-supabase.md`.

## Próximo passo imediato
1. Ler `TASKS.md` na raiz.
2. Mostrar o café a 3-5 produtores reais (`[a preencher pelo diretor]`: quem e quando).
3. Decidir a regra de produto do "Remover exemplos" (atividade real em talhão de exemplo: preservar/mover/apagar).
4. Merge da branch `claude/elegant-volta-l8ubca` em `main` é do diretor.

## Bloqueado, aguardando decisão
- Regra de produto do "Remover exemplos" (atividade real em talhão de exemplo é apagada junto: preservar/mover?) → Thiago → recomendação padrão: `[a decidir pelo diretor]`.
- Merge em `main` → Thiago → recomendação padrão: `[a decidir pelo diretor]`.

## Decisões desta sessão ainda não registradas
Nada pendente: 7 entradas gravadas em `docs/decisoes.md` em 2026-10-21.

## Arquivos tocados
- `docs/decisoes.md`: 7 seções novas de 2026-10-21 (ratificação, 1B, hook, +x, self-test, commit 2A, confirmação do café).
- `docs/clientes/cafe-teste/brief.md` e `manifest.md`: brief, registro de delegação, local atualizado.
- `docs/conhecimento/repository-localstorage-trocavel-supabase.md` e `README.md`: entrada nova e índice.
- `docs/RETOMADA.md`: este arquivo.

## Contexto mínimo para retomar
Histórico completo vive em `docs/decisoes.md` e no git; não está repetido aqui. Ações locais do diretor no Windows que a nuvem não consegue fazer:
- confirmar status line / `jq`;
- rodar `/mcp` para desativar servidor MCP parado;
- apagar o arquivo lixo untracked `runtime/web/UsersLenovo...js`, se ainda existir;
- rodar `git config core.hooksPath .githooks` na máquina dele.

## O que NÃO fazer ao retomar
- Não abrir feature nova da fábrica antes de esvaziar "Agora" do `TASKS.md`.
- Não commitar do Windows sem checar `git ls-files -s .claude/hooks` (o modo 100755 já regrediu uma vez).
