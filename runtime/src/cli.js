#!/usr/bin/env node
import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadAgent } from "./agentloader.js";
import { sendMessage } from "./router.js";
import { logUsage } from "./usage-logger.js";
import { trimHistory, DEFAULT_MAX_HISTORY_TURNS } from "./history.js";

function parseArgs(argv) {
  const args = { agent: "navigator-agent", order: ["claude", "groq", "cerebras", "gemini"] };
  for (const arg of argv) {
    if (arg.startsWith("--agent=")) args.agent = arg.slice("--agent=".length);
    if (arg.startsWith("--order=")) args.order = arg.slice("--order=".length).split(",").map((s) => s.trim());
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const agent = loadAgent(args.agent);

  console.log(`\n[runtime v0] agente: ${agent.name} — ordem de provider: ${args.order.join(" → ")}`);
  console.log(`tier: Claude=${agent.model} · Gemini=${agent.modelFallback}`);
  console.log(`"${agent.description}"\n`);
  console.log('Digite "sair" pra encerrar.\n');

  const rl = readline.createInterface({ input, output });
  const history = [];

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const userMessage = await rl.question("Você: ");
    if (["sair", "exit", "quit"].includes(userMessage.trim().toLowerCase())) break;
    if (!userMessage.trim()) continue;

    try {
      const { trimmed, dropped } = trimHistory(history, DEFAULT_MAX_HISTORY_TURNS);
      if (dropped > 0) {
        console.log(`[contexto: mandando só os últimos ${DEFAULT_MAX_HISTORY_TURNS} turnos — ${dropped} mensagem(ns) antiga(s) fora do envio, ainda salvas localmente]`);
      }

      const { text, provider, tier, usage, attempts } = await sendMessage({
        agent,
        history: trimmed,
        userMessage,
        order: args.order,
      });

      // Grava PRIMEIRO as tentativas que falharam (2026-08-17): elas
      // podem ter custado tokens de verdade (timeout depois da API já
      // ter processado) e antes eram descartadas, deixando o relatório
      // de custo cego no caso mais caro. Ver usage-logger.js.
      for (const a of attempts) {
        logUsage({
          agent: agent.name,
          provider: a.provider,
          tier,
          inputTokens: 0,
          outputTokens: 0,
          timestampMs: Date.now(),
          ok: false,
          error: a.error,
        });
      }

      logUsage({
        agent: agent.name,
        provider,
        tier,
        inputTokens: usage.input,
        outputTokens: usage.output,
        timestampMs: Date.now(),
      });

      if (attempts.length > 0) {
        console.log(`[falhou em: ${attempts.map((a) => a.provider).join(", ")} — respondeu: ${provider}]`);
      }
      console.log(`\n${agent.name} (${provider}/${tier}): ${text}`);
      console.log(`[tokens: ${usage.input} in / ${usage.output} out — log em runtime/logs/usage.jsonl]\n`);

      history.push({ role: "user", text: userMessage });
      history.push({ role: "assistant", text });
    } catch (err) {
      console.error(`\n[erro] ${err.message}\n`);
    }
  }

  rl.close();
  console.log("Encerrado.");
}

main();
