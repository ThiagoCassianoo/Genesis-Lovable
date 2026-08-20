#!/usr/bin/env bash
# Regra de ouro 8 — nunca recomendar sem ter lido docs/decisoes.md.
# Roda em SubagentStop. Só checa os agentes cujo "Contrato de entrada"
# já exige isso por texto (lista abaixo — mesma lista dos agentes que
# têm "Leia primeiro, sempre: docs/decisoes.md" no próprio arquivo).
# docs-agent e implementation-agent ficam de fora de propósito: eles
# registram/executam o que já foi decidido, não opinam do zero.
#
# LIMITAÇÃO HONESTA (não finge que não existe): isto é um grep no
# transcript procurando a string "docs/decisoes.md" — não confirma que
# o agente ENTENDEU ou USOU o que leu, só que o caminho apareceu no
# histórico de tool calls. Heurística, não prova semântica. Se virar
# bloqueio à toa na prática, ajustar ou desativar essa checagem — não
# insistir numa trava que atrapalha mais do que ajuda.

set -uo pipefail

INPUT=$(cat)
AGENT_TYPE=$(printf '%s' "$INPUT" | grep -o '"agent_type"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:[[:space:]]*"//; s/"$//')
TRANSCRIPT=$(printf '%s' "$INPUT" | grep -o '"transcript_path"[[:space:]]*:[[:space:]]*"[^"]*"' | sed 's/.*:[[:space:]]*"//; s/"$//')

CHECAR="business-agent backend-master creative-agent technical-agent marketing-master infra-agent security-agent"

case " $CHECAR " in
  *" $AGENT_TYPE "*) : ;;   # está na lista — segue a checagem abaixo
  *) exit 0 ;;              # não está na lista — nada a checar
esac

if [ -z "$TRANSCRIPT" ] || [ ! -f "$TRANSCRIPT" ]; then
  exit 0   # sem transcript pra checar, não bloqueia por falta de dado
fi

if ! grep -q "docs/decisoes.md" "$TRANSCRIPT" 2>/dev/null; then
  echo "BLOQUEADO pela regra de ouro 8: $AGENT_TYPE terminou sem nenhum sinal de ter lido docs/decisoes.md." >&2
  echo "Leia docs/decisoes.md antes de fechar a recomendação — pode já existir decisão que resolve isto." >&2
  exit 2
fi

exit 0
