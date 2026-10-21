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
# CORREÇÃO 2026-08-17 (auditoria): sem o `:-.`, este era o ÚNICO hook
# que quebrava com "unbound variable" (set -u) quando
# CLAUDE_PROJECT_DIR não estava definido — saía com exit 1 em vez de
# degradar limpo como os outros 7.
RETOMADA="${CLAUDE_PROJECT_DIR:-.}/docs/RETOMADA.md"
TODAY=$(date -u +"%Y-%m-%d")

[ -f "$RETOMADA" ] || exit 0

# PODA ANTES DE APENDAR (correção 2026-08-17): este hook apendava sem
# teto nenhum, e `inject-retomada-ao-resumir.sh` injeta o arquivo
# INTEIRO no contexto a cada retomada. Sem poda, o arquivo cuja função
# é economizar contexto viraria o maior consumidor dele — 1 bloco a
# mais por sessão encerrada, pra sempre. Ainda não se materializou em
# disco porque este hook nunca disparou (só roda em sessão CLI real do
# Claude Code), mas dispararia no Codespace. Mantém no máximo os 2
# avisos mais recentes + o novo; o conteúdo escrito por `/retomar`
# (tudo antes do 1º marcador) nunca é tocado.
MARCADOR='**[AVISO AUTOMÁTICO — session-end.sh]**'
QTD=$(grep -cF "$MARCADOR" "$RETOMADA" 2>/dev/null || true)
QTD=${QTD:-0}
if [ "$QTD" -ge 3 ] 2>/dev/null; then
  PRIMEIRA=$(grep -nF "$MARCADOR" "$RETOMADA" 2>/dev/null | head -1 | cut -d: -f1)
  if [ -n "${PRIMEIRA:-}" ] && [ "$PRIMEIRA" -gt 2 ]; then
    CORTE=$((PRIMEIRA - 2))   # remove também o "---" e a linha em branco
    TMP=$(mktemp 2>/dev/null) || TMP=""
    if [ -n "$TMP" ]; then
      if head -n "$CORTE" "$RETOMADA" > "$TMP" 2>/dev/null; then
        mv "$TMP" "$RETOMADA" 2>/dev/null || rm -f "$TMP"
      else
        rm -f "$TMP"
      fi
    fi
  fi
fi

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
