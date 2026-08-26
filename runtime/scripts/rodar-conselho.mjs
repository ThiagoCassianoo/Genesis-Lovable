#!/usr/bin/env node
/**
 * CONSELHO AUTÔNOMO — roda os 3 conselheiros (otimista, advogado do
 * diabo, analista neutro) de verdade, contra API real, EM PARALELO e
 * SEM QUE UM VEJA A RESPOSTA DO OUTRO. É a regra que já estava escrita
 * em gate.js (`deliberar_conselho`) e orchestration.md ("Conselheiro
 * ↔ conselheiro" é aresta PROIBIDA — ancoragem mata o valor das 3
 * leituras) — só não existia execução real pra ela ainda; a decisão
 * de convocar (avaliarConselho, etapas.js) já era código, faltava isto.
 *
 * Cada conselheiro recebe a MESMA pergunta/decisão, isolado — 3
 * chamadas independentes ao router (mesma ordem de provider default:
 * claude -> glm -> groq -> cerebras -> gemini). A síntese dos 3 blocos
 * continua sendo trabalho de quem convocou (o orquestrador/diretor
 * lendo os 3), não deste script — automatizar a síntese juntaria as 3
 * leituras de novo, o mesmo problema que a separação existe pra evitar.
 *
 * Uso:
 *   cd runtime && npm run conselho -- "texto da decisão a avaliar"
 *   cd runtime && npm run conselho -- "..." --order=claude,groq
 */
import "dotenv/config";
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { loadAgent } from "../src/agentloader.js";
import { sendMessage } from "../src/router.js";
import { logUsage } from "../src/usage-logger.js";
import { truncarParaExibicao } from "../src/truncar-saida.js";

const CONSELHEIROS = ["conselho-otimista", "conselho-advogado-diabo", "conselho-analista-neutro"];

const args = process.argv.slice(2);
const opt = (flag, def) => {
  const hit = args.find((a) => a.startsWith(`--${flag}=`));
  return hit ? hit.slice(flag.length + 3) : def;
};
const decisao = args.find((a) => !a.startsWith("--"));
const order = opt("order", "").split(",").map((s) => s.trim()).filter(Boolean);

function agora() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function rodarUm(nomeAgente, pergunta) {
  const agent = loadAgent(nomeAgente);
  try {
    const { text, provider, tier, usage, attempts } = await sendMessage({
      agent,
      history: [],
      userMessage: pergunta,
      ...(order.length > 0 ? { order } : {}),
    });
    for (const a of attempts) {
      logUsage({ agent: nomeAgente, provider: a.provider, tier, inputTokens: 0, outputTokens: 0, timestampMs: Date.now(), ok: false, error: a.error });
    }
    logUsage({ agent: nomeAgente, provider, tier, inputTokens: usage.input, outputTokens: usage.output, timestampMs: Date.now() });
    return { agente: nomeAgente, ok: true, provider, tier, texto: text, usage, attempts };
  } catch (err) {
    return { agente: nomeAgente, ok: false, erro: err.message };
  }
}

async function main() {
  if (!decisao) {
    console.error('[erro] falta o texto da decisão. Uso: npm run conselho -- "texto da decisão"');
    process.exit(2);
  }

  console.log(`\n[conselho] convocando os 3, em paralelo, cada um sem ver a resposta do outro...`);
  console.log(`[conselho] decisão: "${decisao}"\n`);

  // Promise.allSettled, não Promise.all: 1 conselheiro falhando (todos
  // os providers dele fora do ar) não pode derrubar os outros 2 — seria
  // o mesmo "trava tudo por causa de uma parte" que o resto do runtime
  // evita (worker.js, router.js).
  const resultados = await Promise.allSettled(CONSELHEIROS.map((c) => rodarUm(c, decisao)));

  const transcript = [`# Conselho — ${new Date().toISOString()}`, `Decisão avaliada: ${decisao}`, ""];
  let falhas = 0;

  for (const r of resultados) {
    const v = r.status === "fulfilled" ? r.value : { agente: "?", ok: false, erro: r.reason?.message || String(r.reason) };
    console.log(`┌─ ${v.agente} ${v.ok ? `(${v.provider}/${v.tier})` : "— FALHOU"} ────────────────────`);
    transcript.push(`## ${v.agente} ${v.ok ? `(${v.provider}/${v.tier})` : "(falhou)"}`);
    if (v.ok) {
      console.log(truncarParaExibicao(v.texto)); // tela truncada, arquivo abaixo continua completo
      transcript.push(v.texto);
    } else {
      falhas += 1;
      console.log(`  ${v.erro}`);
      transcript.push(`FALHOU: ${v.erro}`);
    }
    console.log(`└${"─".repeat(50)}\n`);
    transcript.push("");
  }

  const dirLogs = "logs/conselho";
  mkdirSync(dirLogs, { recursive: true });
  const arquivoLog = join(dirLogs, `conselho-${agora()}.txt`);
  writeFileSync(arquivoLog, transcript.join("\n"), "utf-8");
  console.log(`[conselho] transcript: runtime/${arquivoLog.replace(/\\/g, "/")}`);
  console.log(`[conselho] síntese (convergência / divergência real / premissa a verificar / recomendação) é trabalho de quem convocou — leia os 3 acima antes de decidir.\n`);

  process.exit(falhas === CONSELHEIROS.length ? 1 : 0);
}

main();
