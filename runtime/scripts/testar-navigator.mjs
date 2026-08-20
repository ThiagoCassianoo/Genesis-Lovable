#!/usr/bin/env node
/**
 * TESTE DE REGRESSÃO SCRIPTADO — roda uma conversa fixa contra um
 * agente real (Groq/Cerebras, custo zero por padrão) e devolve só o
 * RESUMO: passou/não passou + gargalos encontrados. O transcript
 * completo fica salvo em arquivo, só abre se precisar.
 *
 * Existe pra resolver: Thiago tinha que colar comando por comando no
 * `npm run chat` toda vez que queria testar o navigator-agent de novo.
 * Agora é 1 comando, sem digitar nada, sem token pago (a menos que
 * peça `--order=` incluindo claude).
 *
 * Uso:
 *   cd runtime && npm run testar:navigator
 *   cd runtime && npm run testar:navigator -- --agent=business-agent --fixture=fixtures/outra.txt
 *   cd runtime && npm run testar:navigator -- --order=claude,groq   (força pago se quiser fidelidade máxima)
 */
import "dotenv/config";
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { loadAgent } from "../src/agentloader.js";
import { sendMessage } from "../src/router.js";
import { logUsage } from "../src/usage-logger.js";
import { trimHistory, DEFAULT_MAX_HISTORY_TURNS } from "../src/history.js";

const args = process.argv.slice(2);
const opt = (flag, def) => {
  const hit = args.find((a) => a.startsWith(`--${flag}=`));
  return hit ? hit.slice(flag.length + 3) : def;
};

const agentName = opt("agent", "navigator-agent");
const fixturePath = opt("fixture", "fixtures/navigator-padrao.txt");
const order = opt("order", "groq,cerebras").split(",").map((s) => s.trim());

// Padrões que indicam gargalo/gap — vocabulário genérico de erro +
// termos específicos já vistos em testes anteriores (ex: "hipótega",
// typo real que o Groq cometeu numa rodada passada).
const PADRAO_GARGALO = /\b(erro|error|falhou|failed|exception|undefined|NaN|hipótega|não encontrado|timeout|bloqueado)\b/i;

function agora() {
  const d = new Date();
  return d.toISOString().replace(/[:.]/g, "-");
}

async function main() {
  if (!existsSync(fixturePath)) {
    console.error(`[erro] fixture não encontrada: ${fixturePath}`);
    process.exit(2);
  }

  const linhas = readFileSync(fixturePath, "utf-8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !["sair", "exit", "quit"].includes(l.toLowerCase()));

  const agent = loadAgent(agentName);
  const history = [];
  const transcript = [];
  const gargalos = [];
  let totalIn = 0;
  let totalOut = 0;
  let falhaDura = null;

  transcript.push(`# Teste de regressão — ${agent.name}`);
  transcript.push(`fixture: ${fixturePath} · provider order: ${order.join(" → ")} · ${new Date().toISOString()}\n`);

  for (const [i, userMessage] of linhas.entries()) {
    transcript.push(`Você: ${userMessage}`);
    try {
      const { trimmed } = trimHistory(history, DEFAULT_MAX_HISTORY_TURNS);
      const { text, provider, tier, usage, attempts } = await sendMessage({
        agent,
        history: trimmed,
        userMessage,
        order,
      });

      for (const a of attempts) {
        logUsage({ agent: agent.name, provider: a.provider, tier, inputTokens: 0, outputTokens: 0, timestampMs: Date.now(), ok: false, error: a.error });
      }
      logUsage({ agent: agent.name, provider, tier, inputTokens: usage.input, outputTokens: usage.output, timestampMs: Date.now() });
      totalIn += usage.input;
      totalOut += usage.output;

      if (attempts.length > 0) {
        transcript.push(`[falhou em: ${attempts.map((a) => a.provider).join(", ")} — respondeu: ${provider}]`);
      }
      transcript.push(`${agent.name} (${provider}/${tier}): ${text}`);

      if (PADRAO_GARGALO.test(text)) {
        gargalos.push({ linha: i + 1, pergunta: userMessage, trecho: text.slice(0, 200) });
      }

      history.push({ role: "user", text: userMessage });
      history.push({ role: "assistant", text });
    } catch (err) {
      transcript.push(`[ERRO DURO] ${err.message}`);
      falhaDura = { linha: i + 1, pergunta: userMessage, erro: err.message };
      break; // sem resposta, não adianta continuar a conversa
    }
  }

  const dirLogs = "logs/testes";
  mkdirSync(dirLogs, { recursive: true });
  const arquivoLog = join(dirLogs, `${agentName}-${agora()}.txt`);
  writeFileSync(arquivoLog, transcript.join("\n\n"), "utf-8");
  // Exibição sempre com barra normal (mesmo no Windows, onde
  // path.join usa "\"), pra não misturar separador com o "runtime/"
  // fixo abaixo — path pra copiar/colar tem que funcionar direto no
  // bash sem escapar nada.
  const arquivoLogExibicao = arquivoLog.replace(/\\/g, "/");

  const passou = !falhaDura && gargalos.length === 0;

  console.log(`\n┌─ RESULTADO: ${passou ? "✅ PASSOU" : "⚠️  ATENÇÃO"} ────────────────────`);
  console.log(`│ Agente: ${agent.name} · ${linhas.length} turnos · provider: ${order.join(" → ")}`);
  console.log(`│ Tokens: ${totalIn} in / ${totalOut} out`);
  if (falhaDura) {
    console.log(`│ FALHA DURA no turno ${falhaDura.linha}: "${falhaDura.pergunta}"`);
    console.log(`│   → ${falhaDura.erro}`);
  }
  if (gargalos.length > 0) {
    console.log(`│ ${gargalos.length} gargalo(s)/gap(s) encontrado(s):`);
    for (const g of gargalos) {
      console.log(`│   turno ${g.linha}: "${g.pergunta.slice(0, 60)}${g.pergunta.length > 60 ? "…" : ""}"`);
      console.log(`│     → ${g.trecho}${g.trecho.length >= 200 ? "…" : ""}`);
    }
  }
  console.log(`│ Transcript completo: runtime/${arquivoLogExibicao}`);
  console.log(`└──────────────────────────────────────────────────\n`);

  process.exit(passou ? 0 : 1);
}

main();
