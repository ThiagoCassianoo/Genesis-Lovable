#!/usr/bin/env node
import "dotenv/config";
import { createServer } from "node:http";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAgent } from "../src/agentloader.js";
import { sendMessage } from "../src/router.js";
import { logUsage, summarizeUsage } from "../src/usage-logger.js";
import { trimHistory, DEFAULT_MAX_HISTORY_TURNS } from "../src/history.js";
import { rodar } from "../src/orchestrator/worker.js";
import { resumirDecisoes } from "../src/orchestrator/decision-record.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const WEB_DIR = join(__dirname, "..", "web");
const PORT = Number(process.env.RUNTIME_PORT) || 4573;

/**
 * API HTTP — camada FINA na frente do runtime que já existe.
 *
 * Regra de projeto: este arquivo não reimplementa NADA. Ele traduz
 * HTTP para as funções que já são testadas (`router.js`,
 * `agent-loader.js`, `history.js`, `worker.js`). Se aparecer lógica de
 * negócio aqui, está no lugar errado.
 *
 * SEGURANÇA: o frontend NUNCA vê chave de API. As chaves vivem só no
 * processo do servidor, lidas do `.env`. O browser fala só com este
 * servidor, nunca com Anthropic/Groq/Cerebras/Google direto.
 * O servidor escuta em 127.0.0.1 por padrão — não exposto na rede.
 */

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };

function json(res, status, body) {
  const s = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "content-length": Buffer.byteLength(s) });
  res.end(s);
}

function lerCorpo(req) {
  return new Promise((resolve, reject) => {
    let b = "";
    req.on("data", (d) => {
      b += d;
      if (b.length > 1_000_000) { req.destroy(); reject(new Error("corpo grande demais")); }
    });
    req.on("end", () => {
      try { resolve(b ? JSON.parse(b) : {}); } catch { reject(new Error("JSON inválido")); }
    });
    req.on("error", reject);
  });
}

/** Lista os agentes lendo o frontmatter — mesma fonte do runtime. */
function listarAgentes() {
  const dir = join(REPO_ROOT, ".claude", "agents");
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".md"))
    .map((f) => {
      const nome = f.replace(/\.md$/, "");
      try {
        const a = loadAgent(nome, { agentsDir: join(REPO_ROOT, ".claude", "agents") });
        return { nome: a.name, descricao: a.description, model: a.model, modelFallback: a.modelFallback };
      } catch (e) {
        return { nome, descricao: `(erro ao carregar: ${e.message})`, erro: true };
      }
    });
}

const servidor = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  try {
    // ---------- API ----------
    if (url.pathname === "/api/agentes" && req.method === "GET") {
      return json(res, 200, { agentes: listarAgentes() });
    }

    if (url.pathname === "/api/status" && req.method === "GET") {
      const chaves = ["ANTHROPIC_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "GEMINI_API_KEY"];
      return json(res, 200, {
        providers: chaves.map((k) => ({ env: k, configurada: Boolean(process.env[k]) })),
        maxHistoryTurns: DEFAULT_MAX_HISTORY_TURNS,
        modoSimulacao: !chaves.some((k) => process.env[k]),
      });
    }

    if (url.pathname === "/api/custos" && req.method === "GET") {
      return json(res, 200, { uso: summarizeUsage(), decisoes: resumirDecisoes() });
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      const { agente: nomeAgente, mensagem, historico = [] } = await lerCorpo(req);
      if (!nomeAgente || !mensagem) return json(res, 400, { erro: "faltou `agente` ou `mensagem`" });

      const agente = loadAgent(nomeAgente, { agentsDir: join(REPO_ROOT, ".claude", "agents") });
      const { trimmed, dropped } = trimHistory(historico);

      const r = await sendMessage({ agent: agente, history: trimmed, userMessage: mensagem });
      logUsage({
        agent: agente.name, provider: r.provider, tier: r.tier,
        inputTokens: r.usage.input, outputTokens: r.usage.output, timestampMs: Date.now(),
      });
      // Tentativas falhas também entram no log — mesma correção do cli.js
      for (const a of r.attempts) {
        logUsage({
          agent: agente.name, provider: a.provider, tier: r.tier,
          inputTokens: 0, outputTokens: 0, timestampMs: Date.now(), ok: false, error: a.error,
        });
      }
      return json(res, 200, {
        texto: r.text, provider: r.provider, tier: r.tier, usage: r.usage,
        tentativasFalhas: r.attempts, contextoCortado: dropped,
      });
    }

    if (url.pathname === "/api/fluxo" && req.method === "POST") {
      const { linha = "site", brief = {}, simular = true, filaId = `web-${linha}` } = await lerCorpo(req);
      const eventos = [];
      const r = await rodar({
        filaId, linha, brief: { ...brief, linha }, simular,
        onPasso: (e) => eventos.push(e),
      });
      return json(res, 200, { eventos, resumo: r.resumo, stats: r.stats, bloqueados: r.bloqueados });
    }

    // ---------- estático ----------
    let arquivo = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (arquivo.includes("..")) return json(res, 400, { erro: "caminho inválido" });
    const caminho = join(WEB_DIR, arquivo);
    if (existsSync(caminho)) {
      const ext = extname(caminho);
      res.writeHead(200, { "content-type": MIME[ext] || "application/octet-stream" });
      return res.end(readFileSync(caminho));
    }

    return json(res, 404, { erro: "não encontrado" });
  } catch (e) {
    return json(res, 500, { erro: e.message });
  }
});

servidor.listen(PORT, "127.0.0.1", () => {
  console.log(`\n╔════════════════════════════════════════════════╗`);
  console.log(`║  Missões Tech — painel                         ║`);
  console.log(`╚════════════════════════════════════════════════╝`);
  console.log(`\n  → http://localhost:${PORT}\n`);
  const temChave = ["ANTHROPIC_API_KEY", "GROQ_API_KEY", "CEREBRAS_API_KEY", "GEMINI_API_KEY"].some((k) => process.env[k]);
  console.log(temChave
    ? "  Chaves detectadas — o chat faz chamada REAL de API."
    : "  Nenhuma chave no .env — só o modo simulação funciona.\n  Rode: bash scripts/setup-keys.sh");
  console.log("");
});
