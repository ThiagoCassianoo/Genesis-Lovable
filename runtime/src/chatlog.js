import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "..", "logs");

/**
 * MEMÓRIA DE CHAT POR CLIENTE — mesmo padrão de gravação atômica de
 * `orchestrator/fila.js` (escreve .tmp, renomeia), reaproveitado aqui
 * em vez de duplicado com lógica nova.
 *
 * Por que arquivo separado de fila-*.json: a fila guarda o estado do
 * FLUXO determinístico (agente/etapa/status, usado pelo context-engine
 * pra decidir o próximo passo). O chat é conversa livre com 1 agente,
 * formato diferente (role/text, não agente/saida) — misturar os dois
 * quebraria o parser de `context-engine.js`. Mesmo `filaId` amarra os
 * dois arquivos ao mesmo cliente.
 */

function caminho(filaId) {
  return join(DIR, `chat-${filaId}.json`);
}

/** @returns {{role:"user"|"assistant", text:string, agente:string, timestampMs:number}[]} */
export function carregarChat(filaId) {
  const p = caminho(filaId);
  if (!existsSync(p)) return [];
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    throw new Error(`chat "${filaId}" está corrompido (${e.message}) — não vou adivinhar o conteúdo. Arquivo: ${p}`);
  }
}

export function salvarChat(filaId, historico) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  const p = caminho(filaId);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(historico, null, 2), "utf-8");
  renameSync(tmp, p);
}

/** Acrescenta 1 par (pergunta do diretor + resposta do agente) e salva. */
export function registrarTroca(filaId, { agente, pergunta, resposta, timestampMs }) {
  const historico = carregarChat(filaId);
  historico.push({ role: "user", text: pergunta, agente, timestampMs });
  historico.push({ role: "assistant", text: resposta, agente, timestampMs });
  salvarChat(filaId, historico);
  return historico;
}
