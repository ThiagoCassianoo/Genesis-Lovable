#!/usr/bin/env bash
# Bloqueia chave real colada em *.env.example (arquivo TRACKED, vai pro
# GitHub). Roda em PreToolUse do Write e do Edit, pra qualquer agente.
# Origem: post-mortem docs/conhecimento/post-mortem/2026-08-26-chave-real-em-env-example.md
# — aviso textual no topo do arquivo não impediu a 2ª ocorrência; aqui
# vira trava mecânica (exit 2), mesmo padrão de guard-red-lines.sh.

set -uo pipefail

INPUT=$(cat)

FILE_PATH=$(printf '%s' "$INPUT" | grep -o '"file_path"[[:space:]]*:[[:space:]]*"[^"]*"' | head -1 | sed 's/.*:[[:space:]]*"//; s/"$//')
case "$FILE_PATH" in
  *.env.example) ;;
  *) exit 0 ;;
esac

# Só o conteúdo novo importa: "content" (Write) ou "new_string" (Edit).
# Mesmo padrão de detecção do post-mortem: VAR= seguido de 15+ caracteres.
NOVO=$(printf '%s' "$INPUT" | grep -oE '"(content|new_string)"[[:space:]]*:[[:space:]]*"([^"\\]|\\.)*"')
if printf '%s' "$NOVO" | grep -qE '[A-Z_]+=[a-zA-Z0-9._-]{15,}'; then
  echo "BLOQUEADO: parece chave real em $FILE_PATH." >&2
  echo ".env.example é template versionado — vai pro GitHub público." >&2
  echo "Cole a chave no .env (gitignored) e deixe aqui só VAR= vazio." >&2
  exit 2
fi
exit 0
