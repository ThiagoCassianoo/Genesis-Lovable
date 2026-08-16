#!/usr/bin/env bash
# Trava mecânica das linhas vermelhas da Missões Tech.
# Roda em PreToolUse do Bash. Bloqueia com exit 2 (feedback volta pro agente).
# O que NÃO é tratado aqui: edição de arquivo por agente read-only —
# isso já é impedido pelo allowlist `tools` no frontmatter de cada agente.

set -uo pipefail

INPUT=$(cat)
CMD=$(printf '%s' "$INPUT" | grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:[[:space:]]*"//; s/"$//')

[ -z "$CMD" ] && exit 0

block() {
  echo "BLOQUEADO pela regra de ouro da Missões Tech: $1" >&2
  echo "Peça aprovação explícita do diretor antes de executar isto." >&2
  exit 2
}

# Desbloqueio real (2026-08-16): install/rm/deploy passam a ter o
# mesmo tipo de marcador que o commit já tinha — o diretor aprova
# (comando `/aprovar`), um marcador com hash do comando EXATO é
# gravado em .claude/logs/aprovacao-*.json, e só esse comando exato,
# uma única vez, dentro de 15min, passa. Sem marcador válido, bloqueia
# igual a antes. Isto não afrouxa a regra — é o mesmo padrão de prova
# que o gate de commit já usa, só estendido pras outras 3 ações.
check_marker_or_block() {
  local msg="$1"
  local hash marker approved_epoch now_epoch
  hash=$(printf '%s' "$CMD" | sha256sum | awk '{print $1}')
  marker=$(grep -l "\"command_hash\"[[:space:]]*:[[:space:]]*\"$hash\"" \
    "${CLAUDE_PROJECT_DIR:-.}"/.claude/logs/aprovacao-*.json 2>/dev/null | head -1)
  if [ -n "$marker" ]; then
    approved_epoch=$(grep -o '"approved_epoch"[[:space:]]*:[[:space:]]*[0-9]*' "$marker" | grep -o '[0-9]*$')
    now_epoch=$(date -u +%s)
    if [ -n "$approved_epoch" ] && [ $((now_epoch - approved_epoch)) -le 900 ]; then
      rm -f "$marker" # consumo único — essa aprovação não vale de novo
      exit 0
    fi
  fi
  block "$msg (rode /aprovar se o diretor já autorizou este comando exato)"
}

# Instalar dependência
case "$CMD" in
  *"npm install"*|*"npm i "*|*"yarn add"*|*"pnpm add"*|*"pip install"*|*"bun add"*)
    check_marker_or_block "instalar dependência sem aprovação explícita" ;;
esac

# Apagar arquivo
case "$CMD" in
  *"rm -rf"*|*"rm -r "*|*"rm -f"*)
    check_marker_or_block "remoção de arquivo/diretório sem listar e confirmar antes" ;;
esac

# Produção / publicação
case "$CMD" in
  *"git push"*|*"vercel --prod"*|*"vercel deploy --prod"*|*"netlify deploy --prod"*|*"supabase db push"*)
    check_marker_or_block "alterar produção / publicar sem aprovação explícita" ;;
esac

# Commit — bloqueado sempre pro agente (só o diretor comita), mas a
# mensagem diferencia se o fiscal rodou sobre o diff atual, pra não
# esconder gap. Critério é identidade do diff, não tempo decorrido —
# ver .githooks/pre-commit pro mesmo raciocínio aplicado no lado nativo.
case "$CMD" in
  *"git commit"*)
    LATEST_MARKER=$(ls -t "${CLAUDE_PROJECT_DIR:-.}"/.claude/logs/fiscal-*.json 2>/dev/null | grep -v TEMPLATE | head -1)
    if [ -z "$LATEST_MARKER" ]; then
      block "fazer commit sem aprovação explícita (e sem nenhum marcador de fiscal-agent encontrado)"
    fi
    CURRENT_HASH=$(git diff --cached 2>/dev/null | sha256sum | awk '{print $1}')
    MARKER_HASH=$(grep -o '"diff_hash"[[:space:]]*:[[:space:]]*"[^"]*"' "$LATEST_MARKER" | sed 's/.*:[[:space:]]*"//; s/"$//')
    if [ -z "$MARKER_HASH" ] || [ "$CURRENT_HASH" != "$MARKER_HASH" ]; then
      block "fazer commit sem aprovação explícita (diff mudou desde a última fiscalização — rode fiscal de novo)"
    fi
    block "fazer commit sem aprovação explícita" ;;
esac

# Histórico destrutivo
case "$CMD" in
  *"git reset --hard"*|*"git checkout ."*|*"git clean -f"*)
    block "descartar trabalho não commitado" ;;
esac

exit 0
