#!/usr/bin/env bash
# Regra de ouro 7 — condição de parada: mesmo comando falhando 2x
# seguidas NESTA sessão bloqueia a 3ª tentativa (exit 2), força o
# agente a parar e escalar em vez de insistir. Mesmo princípio do
# circuit breaker de runtime/src/router.js, aplicado aqui na camada de
# shell. Roda em PreToolUse do Bash, junto com guard-red-lines.sh.
#
# Depende do log de observability.sh (.claude/logs/atividade.jsonl) já
# registrar ERRO por chamada — se o log não existir ainda, não há
# histórico pra checar, então não bloqueia (falha aberto, não fechado:
# bloqueio à toa é pior que deixar passar aqui).

set -uo pipefail

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:[[:space:]]*"//; s/"$//')
SESSION=$(printf '%s' "$INPUT" | grep -o '"session_id"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:[[:space:]]*"//; s/"$//' | cut -c1-8)

[ -z "$CMD" ] && exit 0
[ -z "$SESSION" ] && exit 0

LOG="${CLAUDE_PROJECT_DIR:-.}/.claude/logs/atividade.jsonl"
[ -f "$LOG" ] || exit 0

# observability.sh trunca "cmd" em 200 chars e sanitiza segredo antes
# de gravar — comparamos só um prefixo curto (80 chars) do comando
# atual, tolerante a essa truncagem/sanitização, não o comando inteiro.
CMD_PREFIX="${CMD:0:80}"

# Linhas desta sessão, deste comando (prefixo), que já vieram com ERRO.
FAILS=$(grep -F "\"sessao\": \"$SESSION\"" "$LOG" 2>/dev/null \
  | grep -F "\"tool\": \"Bash\"" \
  | grep -F "\"ERRO\"" \
  | grep -Fc "\"cmd\": \"${CMD_PREFIX}" || true)

if [ "${FAILS:-0}" -ge 2 ]; then
  echo "BLOQUEADO pela regra de ouro 7 (condição de parada): este comando já falhou $FAILS vez(es) nesta sessão." >&2
  echo "Pare e escale pro diretor com o erro literal — não tente de novo. Ver .claude/logs/atividade.jsonl." >&2
  exit 2
fi

exit 0
