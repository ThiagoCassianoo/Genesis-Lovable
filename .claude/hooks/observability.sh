#!/usr/bin/env bash
# Camada de observabilidade: registra o que rodou, o que falhou e quanto custou.
# Nunca bloqueia nada (sempre exit 0) — logar não pode quebrar a execução.
# Saída: .claude/logs/atividade.jsonl (uma linha JSON por evento).
#
# LOG SANITIZADO: segredo, token, chave, e-mail, telefone e CPF são
# redigidos ANTES de tocar o disco. Log é artefato de auditoria, não
# pode virar vazamento — vale a mesma regra de LGPD do resto do sistema.

set -uo pipefail

INPUT=$(cat)
DIR="${CLAUDE_PROJECT_DIR:-.}/.claude/logs"
mkdir -p "$DIR" 2>/dev/null || exit 0
export LOG_PATH="$DIR/atividade.jsonl"

printf '%s' "$INPUT" | python3 -c '
import sys, json, re, datetime, os

try:
    raw = sys.stdin.read()
    ev = json.loads(raw) if raw.strip() else {}
except Exception:
    sys.exit(0)

# --- sanitização (roda antes de qualquer escrita) ---
REDACT = [
    (re.compile(r"(?i)\b(sk|pk|rk)[-_][A-Za-z0-9_\-]{12,}"),        "[CHAVE_REDIGIDA]"),
    (re.compile(r"\beyJ[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]+\.?[A-Za-z0-9_\-]*"), "[JWT_REDIGIDO]"),
    (re.compile(r"(?i)\b(token|secret|password|senha|api[_-]?key|bearer|authorization)\b\s*[:=]\s*\S+"), r"\1=[REDIGIDO]"),
    (re.compile(r"[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}"), "[EMAIL_REDIGIDO]"),
    (re.compile(r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b"),                "[CPF_REDIGIDO]"),
    (re.compile(r"\b(?:\+55\s?)?\(?\d{2}\)?\s?9?\d{4}-?\d{4}\b"),    "[TELEFONE_REDIGIDO]"),
]

def sane(s):
    for rx, sub in REDACT:
        s = rx.sub(sub, s)
    return s

def cut(v, n=300):
    s = v if isinstance(v, str) else json.dumps(v, ensure_ascii=False)
    s = sane(s)
    return s[:n] + ("…" if len(s) > n else "")

tool = ev.get("tool_name", "")
ti   = ev.get("tool_input", {}) or {}
resp = ev.get("tool_response", {}) or {}

rec = {
    "ts":     datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
    "event":  ev.get("hook_event_name", ""),
    "tool":   tool,
    "sessao": (ev.get("session_id") or "")[:8],
}

if tool in ("Agent", "Task"):
    rec["agente"] = ti.get("subagent_type") or ti.get("description", "")
    rec["modelo"] = ti.get("model", "herdado")
    rec["input"]  = cut(ti.get("prompt", ""))
    rec["output"] = cut(resp)
elif tool == "Bash":
    rec["cmd"] = cut(ti.get("command", ""), 200)
elif tool in ("Write", "Edit", "NotebookEdit"):
    rec["arquivo"] = ti.get("file_path", "")   # caminho não é sanitizado: é metadado, não conteúdo

# Erro é o campo mais importante do log
err = ""
if isinstance(resp, dict):
    if resp.get("is_error") or resp.get("error"):
        err = cut(resp.get("error") or resp.get("stderr") or resp)
    elif isinstance(resp.get("stderr"), str) and resp["stderr"].strip():
        err = cut(resp["stderr"])
if err:
    rec["ERRO"] = err

path = os.environ.get("LOG_PATH", "")
if path:
    with open(path, "a", encoding="utf-8") as f:
        f.write(json.dumps(rec, ensure_ascii=False) + "\n")
' 2>/dev/null

exit 0
