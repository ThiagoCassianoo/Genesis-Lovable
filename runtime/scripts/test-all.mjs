#!/usr/bin/env node
/**
 * Roda os 3 suites de teste, SEMPRE os 3, mesmo que um falhe.
 *
 * BUG REAL corrigido aqui (achado pelo fiscal-agent, 2026-08-26): o
 * `package.json` antigo encadeava com `&&` — `self-test.mjs` tem 1
 * falha PRÉ-EXISTENTE (CLAUDE.md × orchestration.md, não relacionada a
 * código), e o `&&` parava ali. Resultado: `test-router.mjs` (28
 * checagens) e `test-orchestrator.mjs` (45 checagens) NUNCA rodavam —
 * "npm test" reportava 114 checagens quando o total real é 187. Isso
 * incluía as checagens escritas na MESMA sessão pra provar os bugs
 * corrigidos nela (breaker por modelo, witness) — nenhuma delas
 * chegou a rodar em nenhuma das vezes que "npm test" foi chamado.
 *
 * Uso: node scripts/test-all.mjs  (é o que "npm test" chama agora)
 */
import { spawnSync } from "node:child_process";

const SUITES = [
  ["self-test", "scripts/self-test.mjs"],
  ["router", "scripts/test-router.mjs"],
  ["orchestrator", "scripts/test-orchestrator.mjs"],
];

let piorCodigo = 0;
const resultados = [];

for (const [nome, script] of SUITES) {
  console.log(`\n${"=".repeat(60)}\n${nome}\n${"=".repeat(60)}`);
  const r = spawnSync("node", [script], { stdio: "inherit" });
  const codigo = r.status ?? 1;
  resultados.push({ nome, codigo });
  if (codigo !== 0) piorCodigo = codigo;
}

// simular.mjs --limpar é limpeza de fixture, não suite de checagem —
// roda sempre, mas não decide o exit code final.
spawnSync("node", ["scripts/simular.mjs", "--limpar"], { stdio: "inherit" });

console.log(`\n${"=".repeat(60)}\nRESUMO — os 3 suites rodaram, nenhum foi pulado\n${"=".repeat(60)}`);
for (const r of resultados) {
  console.log(`${r.codigo === 0 ? "✅" : "❌"} ${r.nome}: exit ${r.codigo}`);
}

process.exit(piorCodigo);
