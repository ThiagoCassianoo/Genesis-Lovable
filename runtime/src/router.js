import { sendToClaude } from "./providers/claude-provider.js";
import { sendToGemini } from "./providers/gemini-provider.js";
import { sendToGroq } from "./providers/groq-provider.js";
import { sendToCerebras } from "./providers/cerebras-provider.js";
import { sendToGLM } from "./providers/glm-provider.js";
import { sendToDeepSeek } from "./providers/deepseek-provider.js";
import { sendToPollinations } from "./providers/pollinations-provider.js";
import { sendToOpenRouter } from "./providers/openrouter-provider.js";

// Ordem default pensada pra "nunca parar de trabalhar" com custo zero:
// Claude (condição normal) -> GLM (free, 200K contexto no tier capaz —
// promovido em 2026-08-26 por decisão explícita do diretor, ANTES de
// teste empírico contra os agentes reais desta fábrica; risco aceito
// conscientemente, ver docs/decisoes.md) -> Groq (free mais robusto:
// 30 RPM, RPD alto, sem cartão) -> Cerebras (free, teto de tokens/dia
// generoso) -> Gemini (free mas RPD mais apertado em alguns modelos) ->
// OpenRouter (2026-08-26 — free, mas `docs/recursos.md` já tinha
// rejeitado ele como 1ª/2ª opção em 2026-08-16 por causa do limite: 20
// RPM / 50 RPD sem crédito, 1000 RPD só depois de US$10 de crédito
// comprado uma vez. Re-verificado agora, continua assim. Por isso entra
// aqui embaixo, depois de quem tem limite mais folgado, não substituindo
// ninguém) -> Pollinations (2026-08-26, importado do OmniRoute: provider
// KEYLESS — sem cadastro, sem chave — mas 1 req/15s e modelo por trás
// não documentado publicamente, por isso é o último da ordem default:
// rede de segurança grátis, não rota de qualidade).
//
// DeepSeek continua REGISTRADO em PROVIDERS (dá pra chamar explícito
// com --order=deepseek ou passando `order` na mão) mas FORA da ordem
// default desde 2026-08-26: `npm run simular:fallback` provou ao vivo
// que a chave está com saldo zerado (402 Insufficient Balance) — deixar
// na ordem default seria um elo morto na corrente, o oposto do que essa
// simulação existe pra garantir. Reativar: colocar "deepseek" de volta
// no array `order` default do sendMessage() abaixo, depois de recarregar
// saldo em https://platform.deepseek.com.
const PROVIDERS = {
  claude: { send: sendToClaude, tierField: "model" }, // opus | sonnet
  glm: { send: sendToGLM, tierField: "modelFallback" }, // capaz | economico
  groq: { send: sendToGroq, tierField: "modelFallback" }, // capaz | economico
  cerebras: { send: sendToCerebras, tierField: "modelFallback" }, // capaz | economico
  gemini: { send: sendToGemini, tierField: "modelFallback" }, // capaz | economico
  openrouter: { send: sendToOpenRouter, tierField: "modelFallback" }, // capaz | economico — RPD limitado
  pollinations: { send: sendToPollinations, tierField: "modelFallback" }, // capaz | economico — KEYLESS
  deepseek: { send: sendToDeepSeek, tierField: "modelFallback" }, // capaz | economico — PAGO
};

// Extraído de dentro de sendMessage() (2026-08-26) pra ser a MESMA
// constante que /api/status usa no painel — evita a ordem "de verdade"
// e a ordem "mostrada no dashboard" divergirem silenciosamente, que já
// aconteceu antes com CLAUDE.md × orchestration.md (ver npm test).
const ORDEM_DEFAULT = ["claude", "glm", "groq", "cerebras", "gemini", "openrouter", "pollinations"];

const ENV_VAR_POR_PROVIDER = {
  claude: "ANTHROPIC_API_KEY",
  glm: "GLM_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  gemini: "GEMINI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  pollinations: null, // keyless de propósito
  deepseek: "DEEPSEEK_API_KEY",
};

const TIERS_POR_CAMPO = {
  model: ["opus", "sonnet"],
  modelFallback: ["capaz", "economico"],
};

// Todos com default sensato — só sobrescreve quem precisar, ver .env.example.
const TIMEOUT_MS = Number(process.env.RUNTIME_PROVIDER_TIMEOUT_MS) || 60_000;
const RETRY_MAX_ATTEMPTS = Number(process.env.RUNTIME_RETRY_ATTEMPTS) || 2; // tentativas no MESMO provider
const RETRY_BASE_DELAY_MS = Number(process.env.RUNTIME_RETRY_BASE_DELAY_MS) || 300;
const RETRY_MAX_DELAY_MS = Number(process.env.RUNTIME_RETRY_MAX_DELAY_MS) || 2_000;
// 2026-08-26: baixado de 3 -> 1 por pedido do diretor ("sempre que uma
// API falhar já tira ela do caminho"). Como isto só é avaliado DEPOIS
// do retry (RETRY_MAX_ATTEMPTS acima) já ter tentado 2x o mesmo
// provider, "1 falha" aqui já significa "2 tentativas reais deram
// erro" — não é hipersensível a 1 hiccup isolado.
const BREAKER_THRESHOLD = Number(process.env.RUNTIME_BREAKER_THRESHOLD) || 1; // falhas pra abrir o circuito
const BREAKER_WINDOW_MS = Number(process.env.RUNTIME_BREAKER_WINDOW_MS) || 60_000; // janela em que as falhas contam
const BREAKER_COOLDOWN_MS = Number(process.env.RUNTIME_BREAKER_COOLDOWN_MS) || 30_000; // quanto tempo fica aberto

// Estado do circuit breaker — só em memória, por processo. Sem
// persistência de propósito: é resiliência de uma sessão de chat, não
// coordenação entre processos (isso exigiria fila/estado compartilhado,
// que é outro sistema — ver docs/conhecimento/principios-natureza-orquestrador.md).
//
// CHAVE POR "provider:tier", NÃO só "provider" (2026-08-26, importado do
// padrão do OmniRoute — "model lockout" isolado por modelo). Antes: se
// glm/capaz (glm-4.7-flash) tomasse rate limit, o circuito abria pro
// "glm" inteiro e derrubava glm/economico (glm-4.5-flash) junto, mesmo
// esse nunca tendo sido chamado — superbloqueio silencioso. Agora cada
// modelo dentro do provider tem seu próprio estado.
const breakerState = {}; // { [`${provider}:${tier}`]: { failures: number[], openUntil: number } }

function breakerKey(provider, tier) {
  return `${provider}:${tier}`;
}

function getBreaker(key) {
  if (!breakerState[key]) breakerState[key] = { failures: [], openUntil: 0 };
  return breakerState[key];
}

function isBreakerOpen(key) {
  return getBreaker(key).openUntil > Date.now();
}

function recordFailure(key) {
  const breaker = getBreaker(key);
  const now = Date.now();
  breaker.failures = breaker.failures.filter((t) => now - t < BREAKER_WINDOW_MS);
  breaker.failures.push(now);
  if (breaker.failures.length >= BREAKER_THRESHOLD) {
    breaker.openUntil = now + BREAKER_COOLDOWN_MS;
  }
}

function recordSuccess(key) {
  breakerState[key] = { failures: [], openUntil: 0 };
}

/**
 * Snapshot pro dashboard (/api/status) — lê o MESMO breakerState que
 * sendMessage() usa de verdade, nunca um contador paralelo. "Tempo
 * real" aqui significa isto: se um provider falhou na última chamada
 * real, este snapshot mostra o circuito aberto contando pra fechar —
 * não é simulação separada da lógica de failover.
 */
export function statusProviders() {
  const agora = Date.now();
  return Object.entries(PROVIDERS).map(([nome, def]) => {
    const envVar = ENV_VAR_POR_PROVIDER[nome];
    const keyless = envVar === null;
    const configurada = keyless || Boolean(process.env[envVar]);
    const tiers = (TIERS_POR_CAMPO[def.tierField] || []).map((tier) => {
      const b = getBreaker(breakerKey(nome, tier));
      const reabreEmMs = Math.max(0, b.openUntil - agora);
      return { tier, circuitoAberto: reabreEmMs > 0, reabreEmMs, falhasRecentes: b.failures.length };
    });
    return { nome, keyless, configurada, naOrdemDefault: ORDEM_DEFAULT.includes(nome), tiers };
  });
}

/**
 * Limpa o estado do circuit breaker. Existe só pra teste isolar um
 * caso do outro (adicionado 2026-08-17) — o breaker é o único estado
 * mutável de módulo do runtime, e sem isso um teste contamina o
 * seguinte. Nunca chamado em produção.
 */
export function _resetBreakerParaTeste() {
  for (const k of Object.keys(breakerState)) delete breakerState[k];
}

/** Exposto pra teste inspecionar decisão de retry sem rede. */
export const _isTransienteParaTeste = (err) => isTransient(err);

/** Timeout duro por chamada — um provider lento não trava o chat pra sempre. */
function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout após ${ms}ms (${label})`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Erro de rede/rate-limit/sobrecarga = tenta de novo. Erro de config
 * (chave ausente, modelo inválido) = não adianta re-tentar o mesmo
 * provider, falha rápido e deixa o failover cuidar.
 */
function isTransient(err) {
  const status = err.status || err.statusCode;
  if ([408, 429, 500, 502, 503, 504, 529].includes(status)) return true;
  const msg = String(err.message || "").toLowerCase();
  return /timeout|rate.?limit|overloaded|econnreset|etimedout|enotfound|network|\b(429|500|502|503|529)\b/.test(msg);
}

/**
 * Retry com backoff exponencial + jitter (±20%), só pra erro transiente
 * e só dentro do MESMO provider. Deliberadamente curto (base 300ms, teto
 * 2s) — isto é um chat de terminal interativo, não um worker de fundo;
 * a escala de 1s→32s que cabe num job assíncrono deixaria o Thiago
 * encarando um terminal parado. Depois de esgotar as tentativas, quem
 * decide o próximo passo é o circuit breaker + failover, não mais retry.
 */
async function withRetry(fn) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_MAX_ATTEMPTS; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt === RETRY_MAX_ATTEMPTS || !isTransient(err)) throw err;
      const delay = Math.min(RETRY_BASE_DELAY_MS * 2 ** attempt, RETRY_MAX_DELAY_MS);
      const jitter = delay * (0.8 + Math.random() * 0.4);
      await new Promise((resolve) => setTimeout(resolve, jitter));
    }
  }
  throw lastErr;
}

/**
 * Tenta o primeiro provider da ordem; se falhar (rede, rate limit,
 * chave ausente/inválida), tenta o próximo. Mesmo princípio de "nunca
 * travar" que os agentes seguem no conteúdo — aqui aplicado na
 * camada de infra: uma falha de provider não derruba o chat.
 *
 * Dentro de cada provider: timeout duro, retry curto com backoff+jitter
 * só pra erro transiente, e circuit breaker (`BREAKER_THRESHOLD` falhas
 * em `BREAKER_WINDOW_MS` abre o circuito por `BREAKER_COOLDOWN_MS` —
 * evita insistir num provider fora do ar mensagem após mensagem).
 *
 * O tier (quão capaz o modelo precisa ser) vem do próprio agente —
 * `agent.model` pro lado Claude, `agent.modelFallback` pro lado
 * Gemini — nunca hardcoded aqui. Um agente crítico (fiscal, security,
 * backend-master...) continua crítico mesmo rodando no provider de
 * fallback.
 *
 * `providers` existe SÓ para teste (adicionado 2026-08-17): permite
 * injetar providers falsos e exercitar failover, retry e circuit
 * breaker sem gastar uma chave de API. Antes disso o router — a parte
 * com mais lógica condicional e o único estado mutável do repo — não
 * era coberto por nenhum teste, e foi exatamente por isso que dois
 * bugs graves (modelo morto da Cerebras, resposta vazia virando
 * sucesso) passaram por 42 checagens verdes. Em produção nunca é
 * passado: o default é o mapa real.
 *
 * @param {{agent: {systemPrompt: string, model: string, modelFallback: string}, history: Array, userMessage: string, order?: string[], providers?: object}} params
 * @returns {Promise<{text: string, provider: string, tier: string, usage: {input: number, output: number}, attempts: {provider: string, error: string}[]}>}
 */
export async function sendMessage({ agent, history, userMessage, order = ORDEM_DEFAULT, providers = PROVIDERS }) {
  const attempts = [];

  for (const providerName of order) {
    const providerDef = providers[providerName];
    if (!providerDef) {
      attempts.push({ provider: providerName, error: `provider desconhecido (use: ${Object.keys(providers).join(", ")})` });
      continue;
    }

    const tier = agent[providerDef.tierField];
    const bKey = breakerKey(providerName, tier);

    if (isBreakerOpen(bKey)) {
      const waitS = Math.ceil((getBreaker(bKey).openUntil - Date.now()) / 1000);
      attempts.push({ provider: providerName, error: `circuito aberto (${providerName}/${tier}) — falhou demais recentemente, pulando por mais ${waitS}s` });
      continue;
    }

    try {
      const { text, usage } = await withRetry(() =>
        withTimeout(
          providerDef.send({ systemPrompt: agent.systemPrompt, history, userMessage, tier }),
          TIMEOUT_MS,
          providerName
        )
      );
      recordSuccess(bKey);
      return { text, provider: providerName, tier, usage: usage || { input: 0, output: 0 }, attempts };
    } catch (err) {
      recordFailure(bKey);
      attempts.push({ provider: providerName, error: err.message });
      // segue pro próximo provider da ordem — não relança aqui.
    }
  }

  const detalhe = attempts.map((a) => `${a.provider}: ${a.error}`).join(" | ");
  throw new Error(`Todos os provedores falharam. ${detalhe}`);
}
