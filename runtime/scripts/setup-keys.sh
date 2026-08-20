#!/usr/bin/env bash
# Assistente interativo pra preencher runtime/.env — roda local, no seu
# terminal, nunca manda chave pra lugar nenhum. Só escreve no arquivo.
# Uso: cd runtime && bash scripts/setup-keys.sh
set -euo pipefail

cd "$(dirname "$0")/.."   # garante que roda a partir de runtime/, mesmo chamado de outro lugar

ENV_FILE=".env"
ENV_EXAMPLE=".env.example"

if [ ! -f "$ENV_EXAMPLE" ]; then
  echo "erro: $ENV_EXAMPLE não encontrado — rode este script de dentro da pasta runtime/."
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  touch "$ENV_FILE"
  echo "criado $ENV_FILE vazio (nunca vai pro git — já está no .gitignore)."
fi

echo ""
echo "=== Setup de chaves — missoes-tech-agentes ==="
echo "Enter em branco = pula (mantém o que já está no .env, se houver)."
echo "A chave digitada não aparece na tela (input mascarado)."
echo ""

# lê valor atual do .env (se existir), sem vazar no log do terminal
current_value() {
  local key="$1"
  grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | head -1 | cut -d'=' -f2- || true
}

# escreve ou atualiza uma chave no .env, preservando o resto do arquivo
set_key() {
  local key="$1"
  local value="$2"
  [ -z "$value" ] && return 0
  if grep -qE "^${key}=" "$ENV_FILE" 2>/dev/null; then
    # troca só a linha da chave, sem tocar no resto do arquivo
    tmp=$(mktemp)
    awk -v k="$key" -v v="$value" -F'=' 'BEGIN{OFS="="} $1==k{$0=k"="v} {print}' "$ENV_FILE" > "$tmp"
    mv "$tmp" "$ENV_FILE"
  else
    echo "${key}=${value}" >> "$ENV_FILE"
  fi
}

ask_key() {
  local label="$1" key="$2" url="$3"
  local existing
  existing=$(current_value "$key")
  if [ -n "$existing" ]; then
    echo "  $label: já tem chave salva (deixa em branco pra manter)."
  else
    echo "  $label: sem chave ainda. Pegue grátis em $url"
  fi
  read -r -s -p "  Cola a chave (ou Enter pra pular): " valor
  echo ""
  set_key "$key" "$valor"
}

echo "--- Obrigatório (é o cérebro do sistema) ---"
ask_key "Anthropic / Claude" "ANTHROPIC_API_KEY" "https://console.anthropic.com/settings/keys"

echo ""
echo "--- Fallback grátis (sem cartão) — quanto mais preencher, mais resiliente ---"
ask_key "Groq"     "GROQ_API_KEY"     "https://console.groq.com/keys"
ask_key "Cerebras" "CEREBRAS_API_KEY" "https://cloud.cerebras.ai"
ask_key "Gemini"   "GEMINI_API_KEY"   "https://aistudio.google.com/apikey"

echo ""
echo "=== Feito. Conferindo o que ficou preenchido (sem mostrar valor): ==="
for key in ANTHROPIC_API_KEY GROQ_API_KEY CEREBRAS_API_KEY GEMINI_API_KEY; do
  if [ -n "$(current_value "$key")" ]; then
    echo "  ✅ $key preenchida"
  else
    echo "  ⬜ $key vazia — router pula esse provider automaticamente até você preencher"
  fi
done

echo ""
echo "Próximo passo: npm test  (autoteste offline, não gasta chave nenhuma)"
echo "Depois: npm run chat --agent=navigator-agent  (primeira conversa de verdade)"
