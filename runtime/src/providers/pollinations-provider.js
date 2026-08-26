// Pollinations.AI — o único provider deste fallback que NÃO exige
// cadastro nem chave (importado do padrão "keyless tier" do OmniRoute,
// 2026-08-26). Endpoint e limite verificados nesta sessão contra
// https://github.com/pollinations/pollinations/blob/master/APIDOCS.md:
//   POST https://text.pollinations.ai/openai  (formato OpenAI, mas o
//   path NÃO é "/v1" — por isso fetch puro aqui em vez do SDK "openai",
//   que assumiria "/chat/completions" embaixo do baseURL e erraria a
//   URL).
// Tier anônimo: 1 requisição a cada 15s. Isso o desqualifica como
// provider PRIMÁRIO — é rede de segurança de último recurso antes do
// pago (ver comentário de ordem em router.js), não rota de volume.
//
// CORREÇÃO 2026-08-26 (testado ao vivo, mesma armadilha que já pegou
// Groq e Cerebras — doc escrita ≠ comportamento real): a APIDOCS.md
// listava "openai-reasoning" como modelo válido, mas a API ao vivo
// devolve 404 pra ele. Testei via curl direto os 4 nomes retornados por
// GET text.pollinations.ai/models: só "openai-fast" responde anônimo
// sem chave; "openai", "gpt-oss" e "gpt-oss-20b" dão 402 Payment
// Required mesmo sem Authorization header — viraram modelo pago nesse
// endpoint legado. Por isso os dois tiers apontam pro mesmo modelo:
// não faz sentido declarar um "capaz" que nunca responde de verdade.
const MODEL_BY_TIER = {
  capaz: process.env.POLLINATIONS_MODEL_CAPAZ || "openai-fast",
  economico: process.env.POLLINATIONS_MODEL_ECONOMICO || "openai-fast",
};

const ENDPOINT = process.env.POLLINATIONS_BASE_URL || "https://text.pollinations.ai/openai";

/**
 * @param {{systemPrompt: string, history: {role: "user"|"assistant", text: string}[], userMessage: string, tier?: "capaz"|"economico"}} params
 * @returns {Promise<{text: string, usage: {input: number, output: number}}>}
 */
export async function sendToPollinations({ systemPrompt, history, userMessage, tier = "capaz" }) {
  const model = MODEL_BY_TIER[tier];
  if (!model) {
    throw new Error(`tier de Pollinations desconhecido: "${tier}" (use "capaz" ou "economico").`);
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.text })),
    { role: "user", content: userMessage },
  ];

  const headers = { "Content-Type": "application/json" };
  // Opcional — só existe pra quem se cadastrar em auth.pollinations.ai
  // por conta própria; o provider funciona sem isso (é o ponto dele).
  if (process.env.POLLINATIONS_API_KEY) {
    headers.Authorization = `Bearer ${process.env.POLLINATIONS_API_KEY}`;
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers,
    body: JSON.stringify({ model, messages }),
  });

  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    const e = new Error(`Pollinations HTTP ${res.status}: ${corpo.slice(0, 200)}`);
    e.status = res.status;
    throw e;
  }

  const data = await res.json();

  // Resposta vazia é ERRO, não sucesso — mesmo motivo documentado em
  // cerebras-provider.js (auditoria 2026-08-17).
  const text = data.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`Pollinations devolveu resposta vazia (finish_reason=${data.choices?.[0]?.finish_reason ?? "?"}) — tratando como falha pra não corromper o histórico.`);
  }

  return {
    text,
    usage: {
      input: data.usage?.prompt_tokens ?? 0,
      output: data.usage?.completion_tokens ?? 0,
    },
  };
}
