#!/usr/bin/env bash
# Trava mecânica das linhas vermelhas da Missões Tech.
# Roda em PreToolUse do Bash. Bloqueia com exit 2 (feedback volta pro agente).
# O que NÃO é tratado aqui: edição de arquivo por agente read-only —
# isso já é impedido pelo allowlist `tools` no frontmatter de cada agente.
#
# ============================================================
# CORREÇÃO CRÍTICA 2026-08-17 — bypass universal encontrado em auditoria
# ============================================================
# A versão anterior extraía o comando com regex sobre JSON:
#   grep -o '"command"[[:space:]]*:[[:space:]]*"[^"]*"'
# O `[^"]*` PARA na primeira aspa escapada (\") do JSON. Resultado
# comprovado por teste real:
#   rm -rf /tmp/x                  -> bloqueava (exit 2)  ✅
#   echo "oi" && rm -rf /tmp/x     -> PASSAVA  (exit 0)   ❌
#   cd "/tmp/x" && npm install e   -> PASSAVA  (exit 0)   ❌
# Ou seja: duas aspas e um && desligavam TODAS as 5 travas. Como
# comando com aspas é o caso normal numa sessão real, a Regra de Ouro
# 1 do CLAUDE.md ("🔒 trava mecânica") não estava travando de fato.
#
# Duas mudanças nesta versão:
#  1. JSON é PARSEADO (python3 -> node -> falha alto), nunca regex.
#  2. Detecção por SEGMENTO de comando (o que o shell realmente
#     executa depois de cada &&, ;, |), não por substring solta — pega
#     `echo x && rm -rf y` sem gerar falso positivo em `echo "rm -rf"`
#     ou em palavras que contêm "rm" (ex.: confirm).
# Também cobre variações que passavam antes: espaço duplo
# (`npm  install`), `pip3`, `npm add`, wrappers (`sudo rm`), e `rm`
# sem flag. Ver docs/decisoes.md 2026-08-17.
# ============================================================

set -uo pipefail

INPUT=$(cat)

# --- 1. Extração do comando: parse de JSON de verdade -------------
# Lê tool_input.command. Se o payload não tiver comando (outro tool),
# sai limpo. Se NÃO conseguir parsear, avisa alto no stderr e deixa
# passar — falhar fechado aqui travaria toda sessão num ambiente sem
# python3/node, e o custo de um falso bloqueio permanente é maior que
# o de um aviso visível. O aviso existe justamente pra isso não passar
# despercebido como o bug anterior passou.
extract_cmd() {
  local out status
  # CORREÇÃO 2026-08-20: `command -v python3` dava positivo mesmo sem
  # Python real instalado — Windows tem um "App execution alias" em
  # WindowsApps/python3.exe que existe no PATH, mas ao rodar só imprime
  # um aviso da Microsoft Store no stderr e sai sem stdout. O código
  # antigo tratava qualquer saída != 3 como "sucesso, comando vazio" e
  # nunca tentava node — resultado: a trava inteira passava batido
  # (exit 0) em qualquer máquina Windows com esse alias no PATH e sem
  # Python de verdade. Agora o status real do interpretador é checado:
  # só 0 (sucesso) ou 3 (JSON inválido, sinalizado pelo próprio script)
  # são aceitos como resposta válida; qualquer outro código faz cair
  # pro próximo interpretador em vez de assumir "comando vazio".
  if command -v python3 >/dev/null 2>&1; then
    out=$(printf '%s' "$INPUT" | python3 -c '
import sys, json
try:
    d = json.load(sys.stdin)
except Exception:
    sys.exit(3)
ti = d.get("tool_input") or {}
c = ti.get("command")
if isinstance(c, str):
    sys.stdout.write(c)
' 2>/dev/null)
    status=$?
    if [ "$status" -eq 0 ]; then
      printf '%s' "$out"
      return 0
    elif [ "$status" -eq 3 ]; then
      return 3
    fi
    # status inesperado (ex.: alias fantasma) — não confia, tenta node.
  fi
  if command -v node >/dev/null 2>&1; then
    out=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", d => s += d);
process.stdin.on("end", () => {
  try {
    const d = JSON.parse(s);
    const c = d && d.tool_input && d.tool_input.command;
    if (typeof c === "string") process.stdout.write(c);
  } catch (e) { process.exit(3); }
});
' 2>/dev/null)
    status=$?
    if [ "$status" -eq 0 ]; then
      printf '%s' "$out"
      return 0
    elif [ "$status" -eq 3 ]; then
      return 3
    fi
  fi
  return 4
}

CMD=$(extract_cmd)
EXTRACT_STATUS=$?

if [ "$EXTRACT_STATUS" -eq 3 ]; then
  echo "[guard-red-lines] AVISO: payload não é JSON válido — trava NÃO foi aplicada nesta chamada." >&2
  exit 0
fi
if [ "$EXTRACT_STATUS" -eq 4 ]; then
  echo "[guard-red-lines] AVISO: nem python3 nem node disponíveis — trava NÃO foi aplicada nesta chamada." >&2
  exit 0
fi

[ -z "$CMD" ] && exit 0

# Normaliza espaço em branco (inclui \n e \t) pra que `npm  install` e
# `git\n push` casem igual a forma canônica.
CMD_NORM=$(printf '%s' "$CMD" | tr '\n\t' '  ' | tr -s ' ')

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
# NOTA (auditoria 2026-08-17): o marcador é gravável pelo próprio
# agente (nada impede um `cat > .claude/logs/aprovacao-x.json`). Isto
# é limitação conhecida e aceita: hook roda no mesmo espaço do agente.
# A defesa real contra isso é o `.githooks/pre-commit` (nativo do git,
# fora do alcance da sessão) + auditoria do diretor. Documentado em
# docs/decisoes.md pra não virar falsa sensação de segurança.
check_marker_or_block() {
  local msg="$1"
  local hash marker approved_epoch now_epoch
  # Hash do comando ORIGINAL (não normalizado) — é o que /aprovar viu.
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

# --- 2. Quebra em segmentos ---------------------------------------
# O shell executa um comando por segmento (separados por && || ; |).
# Checar o PRIMEIRO TOKEN de cada segmento é o que distingue
# "rm executado" de "rm citado como argumento" (`echo "rm -rf /"`).
strip_wrappers() {
  local s="$1"
  # ltrim
  s="${s#"${s%%[![:space:]]*}"}"
  # remove prefixos que não mudam o comando real
  while :; do
    case "$s" in
      sudo\ *|env\ *|time\ *|nohup\ *|command\ *|xargs\ *)
        s="${s#* }"
        s="${s#"${s%%[![:space:]]*}"}" ;;
      *) break ;;
    esac
  done
  printf '%s' "$s"
}

SEGMENTS=$(printf '%s' "$CMD_NORM" | sed 's/&&/\n/g; s/||/\n/g; s/;/\n/g; s/|/\n/g')

while IFS= read -r raw_seg; do
  [ -z "$raw_seg" ] && continue
  seg=$(strip_wrappers "$raw_seg")
  [ -z "$seg" ] && continue

  # Instalar dependência
  # (npx NÃO entra: `npx playwright test` é uso legítimo e constante;
  #  bloquear npx geraria falso positivo em trabalho de rotina.)
  case "$seg" in
    npm\ install*|npm\ i\ *|npm\ add*|yarn\ add*|pnpm\ add*|bun\ add*|\
    pip\ install*|pip3\ install*|python\ -m\ pip\ install*|python3\ -m\ pip\ install*)
      check_marker_or_block "instalar dependência sem aprovação explícita" ;;
  esac

  # Apagar arquivo (qualquer forma de rm, não só -rf; mais shred/find -delete)
  case "$seg" in
    rm|rm\ *|shred\ *|unlink\ *)
      check_marker_or_block "remoção de arquivo/diretório sem listar e confirmar antes" ;;
  esac
  case "$seg" in
    find\ *-delete*|find\ *-exec\ rm*)
      check_marker_or_block "remoção de arquivo/diretório sem listar e confirmar antes" ;;
  esac

  # Produção / publicação
  case "$seg" in
    git\ push*|vercel\ --prod*|vercel\ deploy\ --prod*|netlify\ deploy\ --prod*|supabase\ db\ push*)
      check_marker_or_block "alterar produção / publicar sem aprovação explícita" ;;
  esac

  # Commit — bloqueado sempre pro agente (só o diretor comita), mas a
  # mensagem diferencia se o fiscal rodou sobre o diff atual, pra não
  # esconder gap. Critério é identidade do diff, não tempo decorrido —
  # ver .githooks/pre-commit pro mesmo raciocínio aplicado no lado nativo.
  case "$seg" in
    git\ commit*)
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

  # Histórico destrutivo (5ª categoria — existe desde 2026-08-16 mas
  # não estava documentada no CLAUDE.md; corrigido em 2026-08-17)
  case "$seg" in
    git\ reset\ --hard*|git\ checkout\ .*|git\ clean\ -f*|git\ clean\ -d*)
      block "descartar trabalho não commitado" ;;
  esac
done <<< "$SEGMENTS"

exit 0
