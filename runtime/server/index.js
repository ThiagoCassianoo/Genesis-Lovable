#!/usr/bin/env node
import "dotenv/config";
import { createServer } from "node:http";
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadAgent } from "../src/agentloader.js";
import { sendMessage, statusProviders } from "../src/router.js";
import { logUsage, summarizeUsage } from "../src/usage-logger.js";
import { trimHistory, DEFAULT_MAX_HISTORY_TURNS } from "../src/history.js";
import { rodar } from "../src/orchestrator/worker.js";
import { LINHAS } from "../src/orchestrator/etapas.js";
import { resumirDecisoes } from "../src/orchestrator/decision-record.js";
import { FILA_DIR, resumo as resumoFila } from "../src/orchestrator/fila.js";
import { carregarChat, registrarTroca } from "../src/chatlog.js";

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

/** filaId nasce do nome do cliente — memória por cliente: reabrir o
 * mesmo cliente+linha retoma a mesma fila em vez de criar do zero. */
function slugCliente(cliente) {
  if (!cliente) return "sem-nome";
  return cliente.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") || "cliente";
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

    // Passos esperados de uma linha — pra desenhar a barra de progresso
    // ANTES do fluxo rodar (senão o usuário só sabe que existe passo 4
    // quando o passo 4 chegar). Mesma fonte que o worker.js usa de
    // verdade (etapas.js), nada reimplementado.
    if (url.pathname === "/api/etapas" && req.method === "GET") {
      const linha = url.searchParams.get("linha") || "site";
      const passos = LINHAS[linha];
      if (!passos) return json(res, 400, { erro: `linha "${linha}" não existe` });
      return json(res, 200, { passos });
    }

    // 2026-08-26: trocado de checagem fixa de 4 chaves (ficou stale
    // assim que GLM/Pollinations/DeepSeek entraram no router e ninguém
    // lembrou de atualizar aqui) pra statusProviders(), que lê os
    // MESMOS providers registrados de verdade em router.js — não pode
    // mais divergir porque não existe lista duplicada.
    if (url.pathname === "/api/status" && req.method === "GET") {
      const providers = statusProviders();
      return json(res, 200, {
        providers,
        maxHistoryTurns: DEFAULT_MAX_HISTORY_TURNS,
        modoSimulacao: !providers.some((p) => p.configurada),
      });
    }

    // SSE — status dos providers em tempo real (dashboard). Mesmo
    // padrão de /api/fluxo/stream: EventSource do browser só abre GET.
    // "Tempo real" = lê o breakerState de verdade a cada tick, não uma
    // simulação separada — se um provider abrir circuito numa chamada
    // real enquanto o dashboard está aberto, o próximo tick já mostra.
    if (url.pathname === "/api/status/stream" && req.method === "GET") {
      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      const enviar = () => res.write(`event: status\ndata: ${JSON.stringify({ providers: statusProviders(), timestampMs: Date.now() })}\n\n`);
      enviar();
      const intervalo = setInterval(enviar, 2000);
      req.on("close", () => clearInterval(intervalo));
      return;
    }

    if (url.pathname === "/api/custos" && req.method === "GET") {
      return json(res, 200, { uso: summarizeUsage(), decisoes: resumirDecisoes() });
    }

    if (url.pathname === "/api/chat" && req.method === "POST") {
      const { agente: nomeAgente, mensagem, historico = [], filaId = "" } = await lerCorpo(req);
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
      // Memória por cliente: só grava em disco se a conversa está
      // amarrada a um projeto (filaId) — chat avulso continua efêmero,
      // do jeito que já era, sem surpresa.
      if (filaId) {
        registrarTroca(filaId, { agente: agente.name, pergunta: mensagem, resposta: r.text, timestampMs: Date.now() });
      }
      return json(res, 200, {
        texto: r.text, provider: r.provider, tier: r.tier, usage: r.usage,
        tentativasFalhas: r.attempts, contextoCortado: dropped,
      });
    }

    if (url.pathname === "/api/chat/historico" && req.method === "GET") {
      const filaId = url.searchParams.get("filaId") || "";
      if (!filaId) return json(res, 400, { erro: "faltou `filaId`" });
      try {
        return json(res, 200, { historico: carregarChat(filaId) });
      } catch (e) {
        return json(res, 500, { erro: e.message });
      }
    }

    if (url.pathname === "/api/fluxo" && req.method === "POST") {
      const { linha = "site", brief = {}, simular = true, cliente = "", filaId } = await lerCorpo(req);
      const idFinal = filaId || `${slugCliente(cliente)}-${linha}`;
      const eventos = [];
      const r = await rodar({
        filaId: idFinal, linha, brief: { ...brief, linha, cliente }, simular,
        onPasso: (e) => eventos.push(e),
      });
      return json(res, 200, { filaId: idFinal, eventos, resumo: r.resumo, stats: r.stats, bloqueados: r.bloqueados });
    }

    // SSE — evento por evento, em tempo real, enquanto o fluxo roda
    // (a versão POST acima só devolve tudo no final). GET porque
    // EventSource nativo do browser só abre conexão GET.
    if (url.pathname === "/api/fluxo/stream" && req.method === "GET") {
      const linha = url.searchParams.get("linha") || "site";
      const cliente = url.searchParams.get("cliente") || "";
      const objetivo = url.searchParams.get("objetivo") || "";
      const simular = url.searchParams.get("simular") !== "false";
      const idFinal = `${slugCliente(cliente)}-${linha}`;

      res.writeHead(200, {
        "content-type": "text/event-stream; charset=utf-8",
        "cache-control": "no-cache",
        connection: "keep-alive",
      });
      const enviar = (tipo, dados) => res.write(`event: ${tipo}\ndata: ${JSON.stringify(dados)}\n\n`);

      try {
        const brief = { objetivo: objetivo || "landing page", capturaLead: true, temFormulario: true, vaiParaDeploy: true, linha, cliente };
        const r = await rodar({
          filaId: idFinal, linha, brief, simular,
          onPasso: (e) => enviar("passo", e),
        });
        enviar("fim", { filaId: idFinal, resumo: r.resumo, stats: r.stats, bloqueados: r.bloqueados });
      } catch (e) {
        enviar("erro", { erro: e.message });
      }
      return res.end();
    }

    if (url.pathname === "/api/projetos" && req.method === "GET") {
      if (!existsSync(FILA_DIR)) return json(res, 200, { projetos: [] });
      const projetos = readdirSync(FILA_DIR)
        .filter((f) => f.startsWith("fila-") && f.endsWith(".json"))
        .map((f) => {
          try {
            const fila = JSON.parse(readFileSync(join(FILA_DIR, f), "utf-8"));
            const r = resumoFila(fila);
            let status = "a-fazer";
            if (r.total > 0) {
              status = r.bloqueados > 0 ? "bloqueado"
                : (r.feitos + r.pulados >= r.total ? "concluido" : "em-andamento");
            }
            return {
              id: fila.id, linha: fila.linha, criadaEm: fila.criadaEm,
              cliente: fila.brief?.cliente || null, objetivo: fila.brief?.objetivo || null,
              status, resumo: r, itens: fila.itens || [],
            };
          } catch (e) {
            return { id: f.replace(/^fila-|\.json$/g, ""), status: "erro", erro: e.message };
          }
        })
        .sort((a, b) => (b.criadaEm || "").localeCompare(a.criadaEm || ""));
      return json(res, 200, { projetos });
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
  const temChave = statusProviders().some((p) => p.configurada);
  console.log(temChave
    ? "  Chaves detectadas — o chat faz chamada REAL de API."
    : "  Nenhuma chave no .env — só o modo simulação funciona.\n  Rode: bash scripts/setup-keys.sh");
  console.log("");
});
