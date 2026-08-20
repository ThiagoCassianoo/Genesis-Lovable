// Extraído de cli.js em 2026-08-17 pra ser reaproveitado pela futura
// web API (Bloco 4) sem duplicar a lógica — mesma regra que Thiago
// pediu em toda esta sessão: melhora o que existe, não duplica.
//
// Causa raiz encontrada em 2026-08-16: o histórico era enviado INTEIRO
// a cada turno — turno 10 pagava o peso dos 9 anteriores de novo, e de
// novo no 11. Foi o que zerou o token antes do 3º agente numa conversa
// real. Janela deslizante: manda só os últimos N turnos (par
// user+assistant), não a conversa inteira.
export const DEFAULT_MAX_HISTORY_TURNS = Number(process.env.RUNTIME_MAX_HISTORY_TURNS) || 6;

/**
 * @param {{role: "user"|"assistant", text: string}[]} history
 * @param {number} maxTurns
 * @returns {{trimmed: Array, dropped: number}}
 */
export function trimHistory(history, maxTurns = DEFAULT_MAX_HISTORY_TURNS) {
  const maxMessages = maxTurns * 2; // cada turno = 1 user + 1 assistant
  if (history.length <= maxMessages) return { trimmed: history, dropped: 0 };

  let start = history.length - maxMessages;

  // CORREÇÃO 2026-08-17 (auditoria): o corte era por CONTAGEM, não por
  // fronteira de turno — com histórico de comprimento ímpar,
  // trimHistory([user, assistant, user], 1) devolvia [assistant, user],
  // começando com "assistant". A API da Anthropic exige que a primeira
  // mensagem seja "user" → 400. Hoje o cli.js sempre empurra em par, o
  // que mascara o bug; a web API (que grava a mensagem do usuário antes
  // da resposta chegar) geraria comprimento ímpar naturalmente.
  // Avança o início até cair numa mensagem "user".
  while (start < history.length && history[start].role !== "user") {
    start += 1;
  }

  return { trimmed: history.slice(start), dropped: start };
}
