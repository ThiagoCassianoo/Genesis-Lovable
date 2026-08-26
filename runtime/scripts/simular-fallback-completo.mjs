#!/usr/bin/env node
/**
 * SIMULA FALHA DE TODOS OS PROVEDORES GRÁTIS (E DO CLAUDE) — prova que
 * a cadeia de fallback chega até o fim de verdade, não só na teoria.
 *
 * claude, glm, groq, cerebras, gemini, pollinations são FALSIFICADOS
 * pra falhar sempre (sem gastar chave real deles — já sabemos que
 * funcionam, não precisa repetir). deepseek é o ÚNICO real na ordem
 * desta simulação — a intenção é a resposta final sair da API paga de
 * verdade, provando que "não trava o projeto" não é promessa.
 *
 * ATUALIZAÇÃO (2026-08-26, achado por este mesmo script na 1ª rodada
 * real): a chave DEEPSEEK_API_KEY configurada devolveu "402
 * Insufficient Balance" — sem saldo. Rodar este script HOJE prova o
 * oposto do que o parágrafo acima descreve: mostra que, se todos os
 * grátis caíssem de verdade agora, o projeto TRAVARIA (o único
 * provider real na cadeia desta simulação está sem crédito). Por isso
 * "deepseek" foi tirado da ORDEM_DEFAULT de produção em router.js —
 * este script continua útil como teste de fumaça pra quando o saldo
 * for recarregado, não afirme "custo real, poucos centavos" até
 * confirmar que a chave tem saldo de novo.
 *
 * Uso: cd runtime && npm run simular:fallback
 */
import "dotenv/config";
import { sendMessage } from "../src/router.js";
import { sendToDeepSeek } from "../src/providers/deepseek-provider.js";
import { loadAgent } from "../src/agentloader.js";

const ORDEM_COMPLETA = ["claude", "glm", "groq", "cerebras", "gemini", "pollinations", "deepseek"];

function provFalso(nome) {
  return {
    tierField: "modelFallback",
    send: async () => {
      throw new Error(`${nome} fora do ar (simulado — rate limit/quota esgotada)`);
    },
  };
}

async function main() {
  console.log("\n[simulação] falsificando claude, glm, groq, cerebras, gemini e pollinations pra falhar...");
  console.log("[simulação] deepseek é REAL — vai gastar uma chamada paga de verdade pra provar o fallback final.\n");

  const providersFalsos = {
    claude: provFalso("claude"),
    glm: provFalso("glm"),
    groq: provFalso("groq"),
    cerebras: provFalso("cerebras"),
    gemini: provFalso("gemini"),
    pollinations: provFalso("pollinations"),
    deepseek: { send: sendToDeepSeek, tierField: "modelFallback" }, // único real
  };

  const agent = loadAgent("navigator-agent");
  const inicio = Date.now();

  try {
    const { text, provider, tier, usage, attempts } = await sendMessage({
      agent,
      history: [],
      userMessage: "Responda em 1 frase curta confirmando que você é o último provider da cadeia de fallback.",
      order: ORDEM_COMPLETA,
      providers: providersFalsos,
    });

    console.log("┌─ ORDEM DE TENTATIVAS (nesta sequência) ────────────────────");
    for (const a of attempts) {
      console.log(`│  ❌ ${a.provider}: ${a.error}`);
    }
    console.log(`│  ✅ ${provider} (${tier}) — RESPONDEU\n│`);
    console.log(`│ Resposta real: ${text}`);
    console.log(`└${"─".repeat(60)}\n`);

    console.log(`[resultado] ${attempts.length} provedores falharam antes do fallback final responder.`);
    console.log(`[resultado] fallback final: ${provider}/${tier} · ${usage.input} in / ${usage.output} out tokens · ${Date.now() - inicio}ms`);
    console.log(`[resultado] projeto NÃO travou — a cadeia inteira caiu e ainda assim saiu resposta real.\n`);
    process.exit(0);
  } catch (err) {
    console.error(`\n[FALHA] mesmo o fallback final falhou: ${err.message}`);
    console.error("[FALHA] isso significaria que o projeto travaria de verdade nesse cenário — investigar.\n");
    process.exit(1);
  }
}

main();
