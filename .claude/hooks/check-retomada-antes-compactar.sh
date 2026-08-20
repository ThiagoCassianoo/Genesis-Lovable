#!/usr/bin/env bash
# Continuidade automática (2026-08-16) — pedido do Thiago: avisar antes
# de "ficar sem token" e salvar onde parou. Claude Code não expõe
# percentual de contexto pra hook nenhum (confirmado — ver
# docs/conhecimento/principios-natureza-orquestrador.md e o issue
# aberto anthropics/claude-code#27969); PreCompact é o sinal nativo
# mais próximo: dispara quando o próprio Claude Code decide que o
# contexto está ficando cheio (manual ou automático).
#
# Bloqueia a compactação (exit 2) se docs/RETOMADA.md não tiver sido
# atualizado HOJE (cabeçalho "# Retomada — AAAA-MM-DD", mesmo padrão
# que o /retomar já usa) — força rodar /retomar antes de perder o
# contexto que ia embutir memória.

set -uo pipefail

RETOMADA="${CLAUDE_PROJECT_DIR:-.}/docs/RETOMADA.md"
HOJE=$(date -u +%Y-%m-%d)

if [ ! -f "$RETOMADA" ]; then
  echo "BLOQUEADO: docs/RETOMADA.md não existe. Rode /retomar antes de compactar — senão o estado desta sessão se perde." >&2
  exit 2
fi

CABECALHO=$(head -1 "$RETOMADA")
case "$CABECALHO" in
  *"$HOJE"*) exit 0 ;;
  *)
    echo "BLOQUEADO: docs/RETOMADA.md não foi atualizado hoje ($HOJE) — cabeçalho atual: \"$CABECALHO\"." >&2
    echo "Rode /retomar antes de continuar, pra não perder o que foi feito nesta sessão na compactação." >&2
    exit 2 ;;
esac
