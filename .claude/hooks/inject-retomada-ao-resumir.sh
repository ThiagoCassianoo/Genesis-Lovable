#!/usr/bin/env bash
# Continuidade automática (2026-08-16) — roda em SessionStart com
# matcher "resume". Injeta o conteúdo de docs/RETOMADA.md como
# contexto adicional automaticamente, sem depender de alguém lembrar
# de mandar ler o arquivo. SessionStart não bloqueia nada (a
# plataforma não permite — confirmado na doc oficial de hooks); só
# injeta contexto via "additionalContext".

set -uo pipefail

RETOMADA="${CLAUDE_PROJECT_DIR:-.}/docs/RETOMADA.md"

[ -f "$RETOMADA" ] || exit 0

python3 -c '
import json, sys
conteudo = sys.stdin.read()
out = {
    "hookSpecificOutput": {
        "hookEventName": "SessionStart",
        "additionalContext": "Sessão retomada — conteúdo de docs/RETOMADA.md injetado automaticamente pelo hook inject-retomada-ao-resumir.sh:\n\n" + conteudo
    }
}
print(json.dumps(out, ensure_ascii=False))
' < "$RETOMADA"

exit 0
