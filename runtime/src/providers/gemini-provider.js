import { GoogleGenAI } from "@google/genai";

// Modelos verificados contra https://ai.google.dev/gemini-api/docs/models
// em 2026-08-16. Nomes de modelo mudam — não trate isso como fixo pra sempre.
// "capaz" = julgamento/estratégia/auditoria (custa mais, mas errar aqui
// é caro e difícil de detectar). "economico" = tarefa mecânica/checklist
// (instrução rígida cobre a maior parte do gap de capacidade).
// Ver docs/model-assignment.md pra explicação completa do critério.
const MODEL_BY_TIER = {
  capaz: process.env.GEMINI_MODEL_CAPAZ || "gemini-2.5-pro",
  economico: process.env.GEMINI_MODEL_ECONOMICO || "gemini-3.5-flash-lite",
};

let client;
function getClient() {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY ausente — preencha o .env (veja .env.example).");
    }
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

/**
 * @param {{systemPrompt: string, history: {role: "user"|"assistant", text: string}[], userMessage: string, tier?: "capaz"|"economico"}} params
 * @returns {Promise<string>}
 */
export async function sendToGemini({ systemPrompt, history, userMessage, tier = "capaz" }) {
  const model = MODEL_BY_TIER[tier];
  if (!model) {
    throw new Error(`tier de Gemini desconhecido: "${tier}" (use "capaz" ou "economico").`);
  }

  const contents = [
    ...history.map((h) => ({
      role: h.role === "assistant" ? "model" : "user",
      parts: [{ text: h.text }],
    })),
    { role: "user", parts: [{ text: userMessage }] },
  ];

  const response = await getClient().models.generateContent({
    model,
    contents,
    config: { systemInstruction: systemPrompt },
  });

  return response.text;
}
