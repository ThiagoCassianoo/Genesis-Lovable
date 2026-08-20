#!/usr/bin/env node
// Relatório de custo em texto, lido do mesmo log que alimenta a
// futura página web (item 1 do pedido — "quero saber onde tá gastando
// mais, como uma empresa mesmo"). Uso: cd runtime && npm run custos
import { summarizeUsage, USAGE_LOG_PATH } from "../src/usage-logger.js";
import { resumirDecisoes, DECISION_LOG_PATH } from "../src/orchestrator/decision-record.js";

// A PROVA DO 80/20 (adicionada 2026-08-17): antes este relatório só
// mostrava token gasto. Agora mostra também a proporção de decisões
// que saíram SEM IA — que é a métrica que o diretor pediu. Sem isto,
// "80% sem IA" seria meta declarada; com isto, é número por execução.
{
  const d = resumirDecisoes();
  if (d.total > 0) {
    console.log(`\n=== 80/20 — decisões por fonte (${DECISION_LOG_PATH}) ===\n`);
    console.log(`  ${d.total} decisões · ${d.porRegra} por regra · ${d.porFerramenta} por ferramenta · ${d.porIa} por IA`);
    console.log(`  → ${d.percentualSemIa}% resolvido SEM chamada de API${d.percentualSemIa >= 80 ? " ✅ (meta batida)" : " ⚠️  (meta: 80%)"}`);
    if (d.corrompidas > 0) console.log(`  ⚠️  ${d.corrompidas} linha(s) corrompida(s) no log`);
    console.log("\n  Por etapa:");
    for (const [etapa, v] of Object.entries(d.porEtapa).sort()) {
      const pct = Math.round((v.semIa / v.total) * 100);
      console.log(`    Etapa ${etapa}: ${v.total} decisões · ${pct}% sem IA`);
    }
  }
}

const s = summarizeUsage();

console.log(`\n=== Relatório de uso — ${USAGE_LOG_PATH} ===\n`);
if (s.totalCalls === 0) {
  console.log("Nenhuma chamada registrada ainda — o log só ganha linha depois do primeiro `npm run chat` de verdade.\n");
  process.exit(0);
}

console.log(`Total: ${s.totalCalls} chamadas · ${s.totalInput} tokens de entrada · ${s.totalOutput} tokens de saída · ${s.totalInput + s.totalOutput} tokens no total\n`);

console.log("Por agente (quem gasta mais):");
const byAgent = Object.entries(s.byAgent).sort((a, b) => (b[1].input + b[1].output) - (a[1].input + a[1].output));
for (const [agent, data] of byAgent) {
  const total = data.input + data.output;
  const providers = Object.entries(data.byProvider).map(([p, n]) => `${p}:${n}`).join(", ");
  console.log(`  ${agent} — ${total} tokens (${data.input} in / ${data.output} out) em ${data.calls} chamadas [${providers}]`);
}

console.log("\nPor provider (quem tá segurando o peso):");
const byProvider = Object.entries(s.byProvider).sort((a, b) => (b[1].input + b[1].output) - (a[1].input + a[1].output));
for (const [provider, data] of byProvider) {
  const total = data.input + data.output;
  console.log(`  ${provider} — ${total} tokens (${data.input} in / ${data.output} out) em ${data.calls} chamadas`);
}
console.log("");
