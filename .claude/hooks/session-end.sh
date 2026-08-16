#!/usr/bin/env bash
# Dispara em SessionEnd. Limitação real: um hook é shell puro, não tem
# acesso a modelo — não resume o que aconteceu na sessão, só carimba
# que ela encerrou e aponta pro transcript bruto pra recuperação manual.
# Isso NÃO substitui /retomar — só evita que RETOMADA.md pareça
# atualizado quando na verdade ninguém rodou o comando.

set -uo pipefail

INPUT=$(cat)
REASON=$(printf '%s' "$INPUT" | grep -o '"reason"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:[[:space:]]*"//; s/"$//')
TRANSCRIPT=$(printf '%s' "$INPUT" | grep -o '"transcript_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:[[:space:]]*"//; s/"$//')
TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
RETOMADA="$CLAUDE_PROJECT_DIR/docs/RETOMADA.md"
TODAY=$(date -u +"%Y-%m-%d")

[ -f "$RETOMADA" ] || exit 0

{
  echo ""
  echo "---"
  echo "**[AVISO AUTOMÁTICO — session-end.sh]** Sessão encerrada em $TS (motivo: ${REASON:-desconhecido})."
} >> "$RETOMADA"

if ! head -1 "$RETOMADA" | grep -q "$TODAY"; then
  {
    echo "O cabeçalho deste arquivo não é de hoje — provável que \`/retomar\` não"
    echo "rodou nesta sessão. Trate o conteúdo acima como potencialmente"
    echo "desatualizado. Transcript bruto desta sessão: \`${TRANSCRIPT:-desconhecido}\`."
    echo "Próxima sessão: confira \`git log --oneline -5\` antes de assumir que"
    echo "este arquivo reflete o estado real do repositório."
  } >> "$RETOMADA"
fi

exit 0
