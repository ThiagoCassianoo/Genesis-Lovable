#!/usr/bin/env node
/**
 * SIMULAÇÃO — roda o fluxo completo SEM chamar API nenhuma.
 *
 * Existe pra responder a pergunta do Thiago: "consegue fazer a
 * simulação do sistema por aqui mesmo?" Sim. Este script exercita o
 * encadeamento inteiro (Etapa 1 → 6, todos os agentes da linha, fila
 * persistente, context-engine, decision-record) com saídas falsas no
 * formato declarado de cada agente.
 *
 * O que a simulação PROVA: o encadeamento funciona, a fila persiste, o
 * contexto passa entre agentes, o contrato é validado, o 80/20 é real.
 * O que ela NÃO prova: que a chave funciona, que o nome do modelo
 * existe, que a quota está viva — isso é o `npm run preflight`.
 *
 * Uso: cd runtime && npm run simular
 *      cd runtime && npm run simular -- --linha=sistema
 */
import { rodar } from "../src/orchestrator/worker.js";
import { resumirDecisoes } from "../src/orchestrator/decision-record.js";
import { unlinkSync, existsSync } from "node:fs";
import { DECISION_LOG_PATH } from "../src/orchestrator/decision-record.js";
import { FILA_DIR } from "../src/orchestrator/fila.js";
import { join } from "node:path";

const args = process.argv.slice(2);
const linha = (args.find((a) => a.startsWith("--linha=")) || "--linha=site").split("=")[1];
const limpar = args.includes("--limpar");

const filaId = `simulacao-${linha}`;

if (limpar) {
  for (const p of [DECISION_LOG_PATH, join(FILA_DIR, `fila-${filaId}.json`)]) {
    if (existsSync(p)) unlinkSync(p);
  }
  console.log("(log e fila anteriores limpos)\n");
}

const brief = {
  cliente: "Igreja Missão Resgate",
  objetivo: "landing page para agendamento de uso do salão",
  capturaLead: true,
  temFormulario: true,
  temIntegracao: true,
  vaiParaDeploy: true,
  linha,
};

console.log(`\n╔══════════════════════════════════════════════════════════╗`);
console.log(`║  SIMULAÇÃO — linha "${linha}" · ZERO chamada de API${" ".repeat(Math.max(0, 14 - linha.length))}║`);
console.log(`╚══════════════════════════════════════════════════════════╝\n`);

// Relógio determinístico: simulação tem que dar o mesmo resultado
// sempre, senão não serve de teste.
let t = 1755400000000;
const agora = () => (t += 1000);

const icone = {
  ferramenta: "🔧", "ia-simulada": "🤖", pulado: "⏭️ ", skill: "📋",
  lacuna: "⚠️ ", "fora-do-formato": "⚠️ ", "bloqueado-sem-ia": "🛑", fim: "🏁", ia: "🤖",
};

const r = await rodar({
  filaId, linha, brief, simular: true, agora,
  onPasso: (e) => {
    const ic = icone[e.tipo] || "  ";
    if (e.tipo === "fim") return console.log(`\n${ic} ${e.motivo}`);
    if (e.tipo === "pulado") return console.log(`${ic} ${e.agente} — PULADO por regra (zero token)`);
    if (e.tipo === "skill") return console.log(`${ic} Etapa ${e.etapa}: ${e.agente} (plano — estrutura, sem IA)`);
    if (e.tipo === "ferramenta") return console.log(`${ic} ${e.agente} ← ${e.ferramenta}`);
    if (e.tipo === "ia-simulada") return console.log(`${ic} Etapa ${e.etapa}: ${e.agente} — chamaria a IA aqui`);
    if (e.tipo === "lacuna") return console.log(`${ic} ${e.agente}: faltam inputs → ${e.lacunas.join(", ")}`);
    if (e.tipo === "fora-do-formato") return console.log(`${ic} ${e.agente}: saída fora do formato → ${e.faltando.join(", ")}`);
    if (e.tipo === "bloqueado-sem-ia") return console.log(`${ic} ${e.agente}: TODOS os providers caíram — fila salva, retoma depois`);
  },
});

console.log(`\n┌─ RESULTADO ────────────────────────────────────────────┐`);
console.log(`│ Passos: ${r.resumo.feitos} feitos · ${r.resumo.pulados} pulados por regra · ${r.resumo.bloqueados} bloqueados`);
console.log(`│ Decisões: ${r.stats.totalDecisoes} no total`);
console.log(`│   ${r.stats.decisoesRegra} por REGRA · ${r.stats.decisoesFerramenta} por FERRAMENTA · ${r.stats.decisoesIa} por IA`);
console.log(`│ → ${r.stats.percentualSemIa}% SEM chamada de API`);
console.log(`└────────────────────────────────────────────────────────┘`);

const d = resumirDecisoes();
console.log(`\nDecision Record acumulado: ${d.total} decisões · ${d.percentualSemIa}% sem IA`);
console.log(`Fila persistida — se o token acabar no meio, a próxima execução retoma daqui.\n`);

if (r.stats.percentualSemIa < 80) {
  console.error(`⚠️  ${r.stats.percentualSemIa}% está abaixo da meta de 80%.`);
  process.exit(1);
}
console.log(`✅ Meta de 80% batida em fluxo completo simulado.\n`);
