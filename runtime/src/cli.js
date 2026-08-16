#!/usr/bin/env node
import "dotenv/config";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { loadAgent } from "./agent-loader.js";
import { sendMessage } from "./router.js";

function parseArgs(argv) {
  const args = { agent: "navigator-agent", order: ["claude", "gemini"] };
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
      const { text, provider, tier, attempts } = await sendMessage({
        agent,
        history,
        userMessage,
        order: args.order,
      });

      if (attempts.length > 0) {
        console.log(`[falhou em: ${attempts.map((a) => a.provider).join(", ")} — respondeu: ${provider}]`);
      }
      console.log(`\n${agent.name} (${provider}/${tier}): ${text}\n`);

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
