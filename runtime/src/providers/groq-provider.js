import Groq from "groq-sdk";

// Modelos verificados contra https://console.groq.com/docs/deprecations
// em 2026-08-20 — nome de modelo muda com frequência, CONFIRME antes de
// confiar. Groq é o provider free mais robusto do fallback (30 RPM,
// RPD alto por modelo, sem cartão de crédito) — ver docs/custos.md.
const MODEL_BY_TIER = {
  capaz: process.env.GROQ_MODEL_CAPAZ || "openai/gpt-oss-120b",
  economico: process.env.GROQ_MODEL_ECONOMICO || "openai/gpt-oss-20b",
};

let client;
function getClient() {
  if (!client) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY ausente — preencha o .env (veja .env.example). Chave grátis em https://console.groq.com/keys");
    }
    client = new Groq({ apiKey });
  }
  return client;
}

/**
 * @param {{systemPrompt: string, history: {role: "user"|"assistant", text: string}[], userMessage: string, tier?: "capaz"|"economico"}} params
 * @returns {Promise<{text: string, usage: {input: number, output: number}}>}
 */
export async function sendToGroq({ systemPrompt, history, userMessage, tier = "capaz" }) {
  const model = MODEL_BY_TIER[tier];
  if (!model) {
    throw new Error(`tier de Groq desconhecido: "${tier}" (use "capaz" ou "economico").`);
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.text })),
    { role: "user", content: userMessage },
  ];

  const response = await getClient().chat.completions.create({
    model,
    messages,
  });

  // Resposta vazia é ERRO, não sucesso — ver comentário equivalente em
  // cerebras-provider.js (auditoria 2026-08-17).
  const text = response.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`Groq devolveu resposta vazia (finish_reason=${response.choices?.[0]?.finish_reason ?? "?"}) — tratando como falha pra não corromper o histórico.`);
  }

  return {
    text,
    usage: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}
