import Anthropic from "@anthropic-ai/sdk";

// Modelos verificados contra https://platform.claude.com/docs/en/about-claude/models/overview
// em 2026-08-16. Nomes de modelo mudam — não trate isso como fixo pra sempre.
// Mapeia o mesmo "model: opus|sonnet" que já vive no frontmatter de
// cada agente — não inventa uma segunda fonte de verdade pro tier.
const MODEL_BY_TIER = {
  opus: process.env.CLAUDE_MODEL_OPUS || "claude-opus-5",
  sonnet: process.env.CLAUDE_MODEL_SONNET || "claude-sonnet-5",
};

let client;
function getClient() {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY ausente — preencha o .env (veja .env.example).");
    }
    client = new Anthropic({ apiKey });
  }
  return client;
}

/**
 * @param {{systemPrompt: string, history: {role: "user"|"assistant", text: string}[], userMessage: string, tier?: "opus"|"sonnet"}} params
 * @returns {Promise<{text: string, usage: {input: number, output: number}}>}
 */
export async function sendToClaude({ systemPrompt, history, userMessage, tier = "sonnet" }) {
  const model = MODEL_BY_TIER[tier];
  if (!model) {
    throw new Error(`tier de Claude desconhecido: "${tier}" (use "opus" ou "sonnet").`);
  }

  const messages = [
    ...history.map((h) => ({ role: h.role, content: h.text })),
    { role: "user", content: userMessage },
  ];

  const response = await getClient().messages.create({
    model,
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  // response.content é um array de blocos (texto, tool_use, etc.) —
  // concatena só os blocos de texto, não assume string direta.
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Resposta vazia é ERRO, não sucesso (auditoria 2026-08-17) — mesma
  // razão dos outros providers: texto vazio no histórico quebra o
  // turno seguinte com um erro sem relação aparente com a causa.
  if (!text) {
    throw new Error(`Claude devolveu resposta sem bloco de texto (stop_reason=${response.stop_reason ?? "?"}) — tratando como falha pra não corromper o histórico.`);
  }

  // usage vem sempre da API, não é estimativa — é o que a Anthropic
  // de fato cobrou nesta chamada.
  return {
    text,
    usage: { input: response.usage?.input_tokens ?? 0, output: response.usage?.output_tokens ?? 0 },
  };
}
