#!/usr/bin/env bash
# Impõe o escopo de escrita do docs-agent: só docs/* e .claude/logs/*.
# Roda em PreToolUse do Write e do Edit. Bloqueia com exit 2 se o
# agente ativo for docs-agent e o path do arquivo cair fora do escopo.
# Não afeta implementation-agent nem o orquestrador — só verifica
# quando agent_type == docs-agent.

set -uo pipefail

INPUT=$(cat)
AGENT_TYPE=$(printf '%s' "$INPUT" | grep -o '"agent_type"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:[[:space:]]*"//; s/"$//')

# Se não for o docs-agent, nada a checar aqui.
[ "$AGENT_TYPE" != "docs-agent" ] && exit 0

FILE_PATH=$(printf '%s' "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//')
[ -z "$FILE_PATH" ] && exit 0

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-}"
# Normaliza pra path relativo ao projeto, se vier absoluto.
REL_PATH="$FILE_PATH"
if [ -n "$PROJECT_DIR" ] && [[ "$FILE_PATH" == "$PROJECT_DIR"* ]]; then
  REL_PATH="${FILE_PATH#"$PROJECT_DIR"/}"
fi

case "$REL_PATH" in
  docs/*|.claude/logs/*)
    exit 0 ;;
  *)
    echo "BLOQUEADO: docs-agent só pode escrever em docs/* e .claude/logs/*." >&2
    echo "Path solicitado: $REL_PATH" >&2
    echo "Isso não é sugestão — é o limite de escrita do agente. Se este arquivo" >&2
    echo "precisa mudar, é implementation-agent (código) ou o orquestrador (config" >&2
    echo "do próprio sistema), nunca docs-agent." >&2
    exit 2 ;;
esac
