import OpenAI from "openai";

// Cerebras expõe API compatível com OpenAI — reusa o SDK "openai" com
// baseURL trocada, em vez de puxar um SDK exclusivo.
//
// CORREÇÃO 2026-08-17 (auditoria): os dois modelos anteriores estavam
// MORTOS e o provider inteiro falhava em silêncio —
// https://inference-docs.cerebras.ai/support/deprecation confirma:
//   llama-3.3-70b  → descontinuado em 2026-02-16
//   llama3.1-8b    → descontinuado em 2026-05-27
// Efeito real: o 3º nível de fallback devolvia 404 model_not_found, o
// router pulava pro Gemini, e a linha "[falhou em: ...cerebras...]"
// era indistinguível de um rate limit legítimo. Sistema de 4 camadas
// funcionando como 3, sem ninguém saber.
// `gpt-oss-120b` é o modelo de produção que a própria doc de
// deprecação indica como migração. Nome de modelo MUDA — reconfirme
// antes de confiar, e prefira sobrescrever por .env a editar aqui.
const MODEL_BY_TIER = {
  capaz: process.env.CEREBRAS_MODEL_CAPAZ || "gpt-oss-120b",
  economico: process.env.CEREBRAS_MODEL_ECONOMICO || "gpt-oss-120b",
};

let client;
function getClient() {
  if (!client) {
    const apiKey = process.env.CEREBRAS_API_KEY;
    if (!apiKey) {
      throw new Error("CEREBRAS_API_KEY ausente — preencha o .env (veja .env.example). Chave grátis em https://cloud.cerebras.ai");
    }
    client = new OpenAI({ apiKey, baseURL: "https://api.cerebras.ai/v1" });
  }
  return client;
}

/**
 * @param {{systemPrompt: string, history: {role: "user"|"assistant", text: string}[], userMessage: string, tier?: "capaz"|"economico"}} params
 * @returns {Promise<{text: string, usage: {input: number, output: number}}>}
 */
export async function sendToCerebras({ systemPrompt, history, userMessage, tier = "capaz" }) {
  const model = MODEL_BY_TIER[tier];
  if (!model) {
    throw new Error(`tier de Cerebras desconhecido: "${tier}" (use "capaz" ou "economico").`);
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

  // Resposta vazia é ERRO, não sucesso (auditoria 2026-08-17): antes,
  // `|| ""` fazia o router chamar recordSuccess() e o cli.js gravar
  // {role:"assistant", text:""} no histórico. No turno seguinte a API
  // da Anthropic recusa histórico com conteúdo vazio (400), e o erro
  // exibido não tem relação nenhuma com a causa real dois turnos atrás.
  // Falhar aqui deixa o failover fazer o trabalho dele.
  const text = response.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`Cerebras devolveu resposta vazia (finish_reason=${response.choices?.[0]?.finish_reason ?? "?"}) — tratando como falha pra não corromper o histórico.`);
  }

  return {
    text,
    usage: {
      input: response.usage?.prompt_tokens ?? 0,
      output: response.usage?.completion_tokens ?? 0,
    },
  };
}
