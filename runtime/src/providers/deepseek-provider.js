import OpenAI from "openai";

// DeepSeek expõe API compatível com OpenAI — reusa o SDK "openai" com
// baseURL trocada, mesmo padrão de cerebras-provider.js e glm-provider.js.
// Verificado nesta sessão (2026-08-26) contra busca pública:
// endpoint https://api.deepseek.com, Bearer token, 1M de contexto.
//
// DIFERENÇA IMPORTANTE dos outros providers do fallback: este NÃO é
// grátis (pago por token — ver docs/custos.md). Por isso está FORA da
// ORDEM_DEFAULT em router.js desde 2026-08-26 (não "por último" — de
// fora mesmo): teste real nesta sessão devolveu "402 Insufficient
// Balance". Continua registrado em PROVIDERS pra uso explícito via
// `order`. Ver comentário de ordem em router.js pra reativar.
//
// `deepseek-chat`/`deepseek-reasoner` foram APOSENTADOS em 2026-07-24
// — usar os nomes explícitos abaixo, não os aliases antigos (dão erro).
// Nome de modelo muda com frequência — reconfirme antes de confiar.
const MODEL_BY_TIER = {
  capaz: process.env.DEEPSEEK_MODEL_CAPAZ || "deepseek-v4-pro",
  economico: process.env.DEEPSEEK_MODEL_ECONOMICO || "deepseek-v4-flash",
};

let client;
function getClient() {
  if (!client) {
    const apiKey = process.env.DEEPSEEK_API_KEY;
    if (!apiKey) {
      throw new Error("DEEPSEEK_API_KEY ausente — preencha o .env (veja .env.example). Chave (PAGA) em https://platform.deepseek.com");
    }
    client = new OpenAI({ apiKey, baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com" });
  }
  return client;
}

/**
 * @param {{systemPrompt: string, history: {role: "user"|"assistant", text: string}[], userMessage: string, tier?: "capaz"|"economico"}} params
 * @returns {Promise<{text: string, usage: {input: number, output: number}}>}
 */
export async function sendToDeepSeek({ systemPrompt, history, userMessage, tier = "capaz" }) {
  const model = MODEL_BY_TIER[tier];
  if (!model) {
    throw new Error(`tier de DeepSeek desconhecido: "${tier}" (use "capaz" ou "economico").`);
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

  // Resposta vazia é ERRO, não sucesso — mesmo motivo documentado em
  // cerebras-provider.js (auditoria 2026-08-17).
  const text = response.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`DeepSeek devolveu resposta vazia (finish_reason=${response.choices?.[0]?.finish_reason ?? "?"}) — tratando como falha pra não corromper o histórico.`);
  }

  return {
    text,
    usage: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}
