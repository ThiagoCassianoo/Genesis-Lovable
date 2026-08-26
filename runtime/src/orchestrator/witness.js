/**
 * WITNESS — compara o que o agente AFIRMOU contra o FATO que a
 * ferramenta já tinha coletado. Padrão importado de
 * github.com/juyterman1000/entroly (2026-08-26): "compara o que a IA
 * disse contra a evidência que ela recebeu, na própria máquina, sem
 * pagar 2ª chamada de API".
 *
 * A versão deles usa um classificador de ML local (84.92% em
 * HaluEval-QA) — fora de proporção pro tamanho desta fábrica. A nossa
 * não precisa disso: `ferramentas.js` já produz um FATO binário
 * (exit code de `npm test`/`npm audit`/lint+build) ANTES do agente
 * responder, e vários agentes (`qa-agent`, `security-agent`,
 * `fiscal-agent`...) já declaram `Veredito: pass|revise|escalate` no
 * próprio formato de saída. Contradição entre os dois é regra, zero
 * token — mesmo princípio do `gate.js`. Isto é o mesmo tema do
 * "Checkpoint" importado de lofi-gate (não minta sobre teste passar),
 * só que aqui é código que verifica, não checklist que o agente segue
 * por conta própria.
 */

const VEREDITO_RX = /veredito\s*:\s*\**\s*(pass|revise|escalate)/i;

/**
 * @param {{agente: string, evidenciaBruta?: {exitCode?: number}, saidaAgente: string}} params
 * @returns {{aplicavel: boolean, contradiz?: boolean, motivo?: string}}
 */
export function verificarContradicao({ agente, evidenciaBruta, saidaAgente }) {
  // Sem exit code binário, não tem fato pra comparar — não é "sem
  // problema", é "esta checagem não se aplica aqui" (ex.: business-agent
  // não tem exit code, tem texto de docs/decisoes.md).
  if (!evidenciaBruta || evidenciaBruta.exitCode === undefined || evidenciaBruta.exitCode === null) {
    return { aplicavel: false };
  }

  const m = String(saidaAgente || "").match(VEREDITO_RX);
  if (!m) return { aplicavel: false };

  const veredito = m[1].toLowerCase();
  const ferramentaFalhou = evidenciaBruta.exitCode !== 0;
  const contradiz = ferramentaFalhou && veredito === "pass";

  return {
    aplicavel: true,
    contradiz,
    motivo: contradiz
      ? `WITNESS: ferramenta reportou exit ${evidenciaBruta.exitCode} (falhou) mas ${agente} declarou "Veredito: pass" — contradição objetiva, não julgamento`
      : `WITNESS: veredito "${veredito}" bate com o fato da ferramenta (exit ${evidenciaBruta.exitCode})`,
  };
}
