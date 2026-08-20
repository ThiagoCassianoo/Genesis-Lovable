import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, "..", "logs");
const LOG_PATH = join(LOG_DIR, "usage.jsonl");

/**
 * Memória de uso — JSONL (uma linha = uma chamada), append-only, sem
 * dependência externa. Cada linha é um registro fechado: nunca reescreve
 * uma linha antiga, então corromper uma escrita não destrói o histórico.
 * Formato de linha e agregação pensados pra alimentar a futura página
 * web (item 1 do pedido do Thiago em 2026-08-16) sem precisar mudar o
 * formato depois — a página só vai ler e agregar isto.
 *
 * `ok:false` registra uma TENTATIVA QUE FALHOU (adicionado 2026-08-17
 * por achado de auditoria): antes, só o provider que respondeu era
 * gravado, e as tentativas falhas eram descartadas depois de virarem
 * uma linha decorativa no terminal. Isso tornava o relatório de custo
 * cego justamente no caso caro — ex.: Claude Opus recebe 40k tokens de
 * contexto, estoura o timeout de 60s (mas a Anthropic já processou e
 * COBROU), o router tenta de novo, e no fim quem responde é o Groq. O
 * relatório mostrava "Claude: R$ 0,00" num turno que gastou 3× 40k de
 * Opus. Tokens de tentativa falha normalmente não voltam na resposta
 * de erro, então gravamos 0 — mas a LINHA existe, com `ok:false` e o
 * motivo, pra que "falhou N vezes no Claude hoje" seja visível em vez
 * de invisível. Custo não medido e declarado é melhor que custo
 * silenciosamente ausente.
 *
 * @param {{agent: string, provider: string, tier: string, inputTokens: number, outputTokens: number, timestampMs: number, ok?: boolean, error?: string}} record
 */
export function logUsage({ agent, provider, tier, inputTokens, outputTokens, timestampMs, ok = true, error }) {
  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  const line = JSON.stringify({
    ts: new Date(timestampMs).toISOString(),
    agent,
    provider,
    tier,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: inputTokens + outputTokens,
    ok,
    ...(error ? { error: String(error).slice(0, 300) } : {}),
  });
  appendFileSync(LOG_PATH, line + "\n", "utf-8");
}

/**
 * Lê o log inteiro e agrega por agente e por provider — é isto que
 * `npm run custos` (script novo) e a futura página web vão consumir.
 * Lê tudo em memória de propósito: log de uso de chat é pequeno
 * (milhares de linhas, não milhões); se um dia crescer demais, troca
 * por leitura em stream, não antes.
 */
export function summarizeUsage() {
  const empty = { totalCalls: 0, totalInput: 0, totalOutput: 0, totalFailed: 0, corruptLines: 0, byAgent: {}, byProvider: {} };
  if (!existsSync(LOG_PATH)) return empty;

  const lines = readFileSync(LOG_PATH, "utf-8").trim().split("\n").filter(Boolean);
  const summary = { ...empty, byAgent: {}, byProvider: {} };

  for (const line of lines) {
    let rec;
    try {
      rec = JSON.parse(line);
    } catch {
      // Linha corrompida não derruba o resumo inteiro — mas agora é
      // CONTADA e reportada (2026-08-17): antes o `continue` mudo
      // podia esconder metade do log sem ninguém notar.
      summary.corruptLines += 1;
      continue;
    }
    // Registros antigos (antes de 2026-08-17) não têm o campo `ok`.
    // Ausente = sucesso, que é o que eles eram.
    const ok = rec.ok !== false;
    if (!ok) summary.totalFailed += 1;

    summary.totalCalls += 1;
    summary.totalInput += rec.input_tokens || 0;
    summary.totalOutput += rec.output_tokens || 0;

    summary.byAgent[rec.agent] ??= { calls: 0, failed: 0, input: 0, output: 0, byProvider: {} };
    const a = summary.byAgent[rec.agent];
    a.calls += 1;
    if (!ok) a.failed += 1;
    a.input += rec.input_tokens || 0;
    a.output += rec.output_tokens || 0;
    a.byProvider[rec.provider] = (a.byProvider[rec.provider] || 0) + 1;

    summary.byProvider[rec.provider] ??= { calls: 0, failed: 0, input: 0, output: 0 };
    const p = summary.byProvider[rec.provider];
    p.calls += 1;
    if (!ok) p.failed += 1;
    p.input += rec.input_tokens || 0;
    p.output += rec.output_tokens || 0;
  }

  return summary;
}

export const USAGE_LOG_PATH = LOG_PATH;
