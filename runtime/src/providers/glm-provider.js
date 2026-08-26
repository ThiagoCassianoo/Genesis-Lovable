import OpenAI from "openai";

// GLM (Z.AI/Zhipu) expõe API compatível com OpenAI — reusa o SDK
// "openai" com baseURL trocada, mesmo padrão de cerebras-provider.js.
// Verificado nesta sessão (2026-08-26) contra https://docs.z.ai/guides/llm/glm-4.7:
// endpoint https://api.z.ai/api/paas/v4/, Bearer token, GLM-4.7-Flash
// anunciado como "completamente grátis" pela Z.AI.
// CORREÇÃO (achado pelo fiscal-agent): a página acima documenta
// glm-4.7/glm-4.7-Flash/glm-4.7-FlashX — NÃO cita "glm-4.5-flash"
// nominalmente, apesar do ID existir no catálogo da Z.AI. Atribuição
// da fonte estava errada pro tier "economico"; o ID em si segue de pé
// (testado com resposta real via `npm run testar:navigator`), só a
// citação da fonte foi corrigida aqui. Nome/gratuidade de modelo muda
// com frequência — reconfirme antes de confiar cegamente, mesmo
// princípio dos outros providers deste arquivo.
const MODEL_BY_TIER = {
  capaz: process.env.GLM_MODEL_CAPAZ || "glm-4.7-flash", // ~200K contexto, foco agêntico/coding
  economico: process.env.GLM_MODEL_ECONOMICO || "glm-4.5-flash", // 128K contexto, texto geral
};

let client;
function getClient() {
  if (!client) {
    const apiKey = process.env.GLM_API_KEY;
    if (!apiKey) {
      throw new Error("GLM_API_KEY ausente — preencha o .env (veja .env.example). Chave grátis em https://z.ai");
    }
    client = new OpenAI({ apiKey, baseURL: process.env.GLM_BASE_URL || "https://api.z.ai/api/paas/v4" });
  }
  return client;
}

/**
 * @param {{systemPrompt: string, history: {role: "user"|"assistant", text: string}[], userMessage: string, tier?: "capaz"|"economico"}} params
 * @returns {Promise<{text: string, usage: {input: number, output: number}}>}
 */
export async function sendToGLM({ systemPrompt, history, userMessage, tier = "capaz" }) {
  const model = MODEL_BY_TIER[tier];
  if (!model) {
    throw new Error(`tier de GLM desconhecido: "${tier}" (use "capaz" ou "economico").`);
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
  // cerebras-provider.js (auditoria 2026-08-17): histórico com texto
  // vazio quebra o próximo turno de um jeito difícil de rastrear.
  const text = response.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`GLM devolveu resposta vazia (finish_reason=${response.choices?.[0]?.finish_reason ?? "?"}) — tratando como falha pra não corromper o histórico.`);
  }

  return {
    text,
    usage: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}
