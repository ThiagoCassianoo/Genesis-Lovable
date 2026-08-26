import OpenAI from "openai";

// OpenRouter — API compatível com OpenAI, reusa o SDK "openai" com
// baseURL trocada, mesmo padrão dos outros providers deste arquivo.
//
// CONTEXTO IMPORTANTE (já registrado em docs/recursos.md, 2026-08-16):
// o tier grátis da OpenRouter foi AVALIADO E REJEITADO como 1ª/2ª opção
// de fallback por causa do limite — na época, 20 RPM / 50 RPD. Verificado
// de novo agora (2026-08-26, direto na API real, não em doc de
// marketing): continua 20 RPM / 50 RPD sem crédito, sobe pra 1000 RPD
// só depois de comprar US$10 de crédito (uma vez, vale pra sempre). Por
// isso este provider entra no fallback, mas NÃO nas primeiras posições
// — ver ordem em router.js.
//
// CORREÇÃO 2026-08-26 (achado por teste real, não por doc): os defaults
// originais ("z-ai/glm-5.2:free" e "google/gemma-4-31b-it:free") deram
// 429 "Provider returned error" nas duas primeiras chamadas reais —
// modelo congestionado do lado de quem hospeda, não problema da chave
// (confirmado testando um 3º modelo com a MESMA chave, que passou).
// "nvidia/nemotron-3-super-120b-a12b:free" foi o único dos 3 testados
// que respondeu de verdade (`npm run testar:navigator -- --order=openrouter`,
// 16.338 in / 5.537 out tokens reais) — por isso virou o default dos
// dois tiers até alguém verificar um 2º modelo estável pro econômico.
// Evitei de propósito o "stealth/ox-alpha": mesmo bem avaliado em
// benchmark, a própria OpenRouter avisa que o preview gratuito dele
// dura só ~1 semana a partir de 20/08/2026 — pode sumir/virar pago a
// qualquer momento. Sobrescreva por .env se quiser usar ele por conta
// própria enquanto durar.
const MODEL_BY_TIER = {
  capaz: process.env.OPENROUTER_MODEL_CAPAZ || "nvidia/nemotron-3-super-120b-a12b:free", // testado ao vivo, passou
  economico: process.env.OPENROUTER_MODEL_ECONOMICO || "nvidia/nemotron-3-super-120b-a12b:free", // mesmo modelo — o único confirmado até agora
};

let client;
function getClient() {
  if (!client) {
    const apiKey = process.env.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error("OPENROUTER_API_KEY ausente — preencha o .env (veja .env.example). Chave grátis em https://openrouter.ai/keys");
    }
    client = new OpenAI({ apiKey, baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1" });
  }
  return client;
}

/**
 * @param {{systemPrompt: string, history: {role: "user"|"assistant", text: string}[], userMessage: string, tier?: "capaz"|"economico"}} params
 * @returns {Promise<{text: string, usage: {input: number, output: number}}>}
 */
export async function sendToOpenRouter({ systemPrompt, history, userMessage, tier = "capaz" }) {
  const model = MODEL_BY_TIER[tier];
  if (!model) {
    throw new Error(`tier de OpenRouter desconhecido: "${tier}" (use "capaz" ou "economico").`);
  }

  const messages = [
    { role: "system", content: systemPrompt },
    ...history.map((h) => ({ role: h.role === "assistant" ? "assistant" : "user", content: h.text })),
    { role: "user", content: userMessage },
  ];

  const response = await getClient().chat.completions.create({ model, messages });

  // Resposta vazia é ERRO, não sucesso — mesmo motivo documentado em
  // cerebras-provider.js (auditoria 2026-08-17).
  const text = response.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`OpenRouter devolveu resposta vazia (finish_reason=${response.choices?.[0]?.finish_reason ?? "?"}) — tratando como falha pra não corromper o histórico.`);
  }

  return {
    text,
    usage: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}
