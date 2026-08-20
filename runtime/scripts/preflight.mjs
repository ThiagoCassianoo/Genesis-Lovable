#!/usr/bin/env node
/**
 * PRÉ-VOO — roda ANTES da primeira conversa real, no ambiente real.
 *
 * Por que existe (2026-08-17): a auditoria testou o sistema no
 * container do Claude, não no Codespace do Thiago. `npm test` prova
 * que a LÓGICA está certa; este script prova que o AMBIENTE aguenta —
 * são coisas diferentes, e a segunda só pode ser verificada onde o
 * código vai rodar de verdade.
 *
 * Faz UMA chamada real por provider configurado, com prompt mínimo
 * (~10 tokens). Custo desprezível, e é a única forma de saber se a
 * chave funciona, se o nome do modelo existe DE VERDADE na API, e se
 * a quota está viva — três coisas que nenhuma auditoria de código
 * consegue afirmar.
 *
 * Uso: cd runtime && npm run preflight
 */
import "dotenv/config";
import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

const linhas = [];
const ok = (m) => linhas.push({ nivel: "ok", m });
const aviso = (m) => linhas.push({ nivel: "aviso", m });
const erro = (m) => linhas.push({ nivel: "erro", m });

console.log("\n=== PRÉ-VOO — checando o ambiente real, não o código ===\n");

// ----------------------------------------------------------------
// 1. Dependências de sistema que os hooks assumem
// ----------------------------------------------------------------
const temCmd = (c) => {
  try {
    execSync(`command -v ${c}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
};

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (nodeMajor >= 18) ok(`Node ${process.versions.node} (>=18, ok)`);
else erro(`Node ${process.versions.node} — o runtime usa fetch/ESM nativo, precisa de >=18`);

// guard-red-lines.sh depende de python3 OU node pra parsear JSON. Sem
// nenhum dos dois ele AVISA e deixa passar — a trava some sem quebrar
// nada, que é o pior tipo de falha (silenciosa).
if (temCmd("python3")) ok("python3 disponível (guard-red-lines.sh parseia JSON com ele)");
else if (temCmd("node")) aviso("python3 ausente — guard-red-lines.sh cai pro node (funciona, mas confirme)");
else erro("nem python3 nem node no PATH — guard-red-lines.sh NÃO vai travar nada (falha silenciosa)");

// observability.sh depende de python3 e não tem fallback.
if (temCmd("python3")) ok("observability.sh tem python3 (sem ele, log não é escrito)");
else aviso("observability.sh precisa de python3 — sem ele o log de atividade fica vazio em silêncio");

for (const c of ["git", "sha256sum", "grep", "sed"]) {
  if (temCmd(c)) ok(`${c} disponível`);
  else erro(`${c} ausente — hooks dependem dele`);
}

// ----------------------------------------------------------------
// 2. Git — o gate de commit REAL depende disso estar ativado
// ----------------------------------------------------------------
try {
  execSync("git rev-parse --is-inside-work-tree", { cwd: ROOT, stdio: "ignore" });
  ok("é repositório git (o gate de commit precisa disso)");
  let hooksPath = "";
  try {
    hooksPath = execSync("git config core.hooksPath", { cwd: ROOT, encoding: "utf-8" }).trim();
  } catch { /* não configurado */ }
  if (hooksPath === ".githooks") {
    ok("core.hooksPath = .githooks (gate de commit ATIVO)");
  } else {
    erro(`core.hooksPath = "${hooksPath || "(vazio)"}" — o gate de commit NÃO está ativo. Rode: git config core.hooksPath .githooks`);
  }
  if (existsSync(join(ROOT, ".githooks", "pre-commit"))) ok(".githooks/pre-commit existe");
  else erro(".githooks/pre-commit não existe");
} catch {
  erro("não é repositório git — `git diff --cached` falha e o gate de commit fica cego");
}

// ----------------------------------------------------------------
// 3. Chaves — presença e forma (antes de gastar chamada)
// ----------------------------------------------------------------
const chaves = {
  ANTHROPIC_API_KEY: "claude",
  GROQ_API_KEY: "groq",
  CEREBRAS_API_KEY: "cerebras",
  GEMINI_API_KEY: "gemini",
};
const configurados = [];
for (const [env, prov] of Object.entries(chaves)) {
  const v = process.env[env];
  if (!v) {
    aviso(`${env} vazia — provider "${prov}" será pulado pelo router`);
    continue;
  }
  if (v !== v.trim()) {
    erro(`${env} tem espaço/quebra de linha nas pontas — causa 401 que parece chave inválida. Limpe o .env.`);
    continue;
  }
  if (v.length < 20) {
    erro(`${env} tem só ${v.length} caracteres — provavelmente truncada`);
    continue;
  }
  ok(`${env} presente e com forma plausível (${v.length} chars)`);
  configurados.push(prov);
}
if (configurados.length === 0) {
  erro("NENHUMA chave configurada — rode: bash scripts/setup-keys.sh");
}

// ----------------------------------------------------------------
// 4. .env não pode estar versionado
// ----------------------------------------------------------------
try {
  const rastreado = execSync("git ls-files runtime/.env", { cwd: ROOT, encoding: "utf-8" }).trim();
  if (rastreado) erro("runtime/.env ESTÁ VERSIONADO NO GIT — suas chaves vão pro histórico. Rode: git rm --cached runtime/.env");
  else ok("runtime/.env não está versionado");
} catch {
  aviso("não consegui checar se .env está versionado");
}

// ----------------------------------------------------------------
// 5. A prova real: uma chamada por provider configurado
// ----------------------------------------------------------------
const PROMPT = "Responda apenas: ok";
const agenteMinimo = {
  systemPrompt: "Você responde em uma palavra.",
  model: "sonnet",
  modelFallback: "economico",
};

if (configurados.length > 0) {
  console.log(`Fazendo 1 chamada real por provider configurado (${configurados.join(", ")})…`);
  console.log("Isto gasta ~10 tokens por provider. É o único jeito de saber se a chave e o modelo funcionam DE VERDADE.\n");

  const { sendMessage } = await import("../src/router.js");
  for (const prov of configurados) {
    const t0 = Date.now();
    try {
      const r = await sendMessage({
        agent: agenteMinimo,
        history: [],
        userMessage: PROMPT,
        order: [prov],
      });
      const ms = Date.now() - t0;
      ok(`${prov}: RESPONDEU em ${ms}ms — ${r.usage.input} tokens in / ${r.usage.output} out. Chave e modelo funcionam.`);
    } catch (e) {
      const msg = String(e.message);
      let diag = "";
      if (/401|invalid.*key|authentication/i.test(msg)) diag = " → chave inválida ou expirada";
      else if (/404|not.?found|does not exist|model/i.test(msg)) diag = " → NOME DE MODELO não existe nessa API (troque via .env)";
      else if (/429|rate|quota/i.test(msg)) diag = " → quota/rate limit já estourado";
      else if (/timeout|ETIMEDOUT|ENOTFOUND/i.test(msg)) diag = " → rede/DNS bloqueado neste ambiente";
      erro(`${prov}: FALHOU${diag} — ${msg.slice(0, 200)}`);
    }
  }
} else {
  aviso("pulei o teste de chamada real: nenhuma chave configurada");
}

// ----------------------------------------------------------------
// Relatório
// ----------------------------------------------------------------
console.log("");
for (const l of linhas) {
  console.log(`${l.nivel === "ok" ? "✅" : l.nivel === "aviso" ? "⚠️ " : "❌"} ${l.m}`);
}

const erros = linhas.filter((l) => l.nivel === "erro").length;
const avisos = linhas.filter((l) => l.nivel === "aviso").length;
console.log(`\n${linhas.length} checagens · ${erros} erro(s) · ${avisos} aviso(s)\n`);

if (erros > 0) {
  console.error("Corrija os ❌ antes de rodar uma sessão de verdade — cada um deles causa falha que PARECE outra coisa.");
  process.exit(1);
}
console.log("Ambiente aprovado. Pode rodar `npm run chat`.\n");
