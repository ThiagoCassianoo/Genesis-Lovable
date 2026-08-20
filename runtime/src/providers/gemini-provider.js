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
 * @returns {Promise<{text: string, usage: {input: number, output: number}}>}
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

  // Resposta vazia é ERRO, não sucesso (auditoria 2026-08-17). No SDK
  // @google/genai, `response.text` é `string | undefined` — vem
  // undefined quando o candidato foi bloqueado por safety ou cortado
  // por MAX_TOKENS. Antes isso virava `text: undefined` no histórico e
  // quebrava o turno SEGUINTE com um 400 sem relação aparente.
  const text = response.text;
  if (!text) {
    const reason = response.candidates?.[0]?.finishReason ?? "?";
    throw new Error(`Gemini devolveu resposta vazia (finishReason=${reason}) — tratando como falha pra não corromper o histórico.`);
  }

  // thoughtsTokenCount NÃO está incluído em candidatesTokenCount nos
  // modelos de raciocínio (gemini-2.5-pro, tier "capaz"). Sem somar,
  // o relatório de custo subnotifica justamente os agentes que mais
  // raciocinam (fiscal, security, backend-master).
  const outputTokens =
    (response.usageMetadata?.candidatesTokenCount ?? 0) +
    (response.usageMetadata?.thoughtsTokenCount ?? 0);

  return {
    text,
    usage: {
      input: response.usageMetadata?.promptTokenCount ?? 0,
      output: outputTokens,
    },
  };
}
