import { appendFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const LOG_DIR = join(__dirname, "..", "..", "logs");
const LOG_PATH = join(LOG_DIR, "decisions.jsonl");

/**
 * DECISION RECORD — rastro auditável de cada decisão do orquestrador.
 *
 * Regra que isto implementa: **IA nunca é a fonte da evidência quando
 * uma ferramenta já produz a evidência.** `npm audit` encontra a
 * vulnerabilidade (FATO); a IA classifica a prioridade (JULGAMENTO).
 * O registro separa as duas coisas de forma que o Thiago possa provar
 * pro cliente de onde veio cada decisão.
 *
 * É também a MEDIÇÃO do 80/20: `resumirDecisoes()` conta quantas
 * decisões saíram por regra e quantas exigiram IA. Sem isso, "80% sem
 * IA" seria meta declarada; com isso, é número verificável a cada
 * execução.
 *
 * Não substitui `docs/decisoes.md` — aquele é a memória de decisões do
 * DIRETOR entre sessões; este é a memória operacional do SISTEMA por
 * execução. Escopos diferentes, arquivos diferentes, de propósito.
 */

/**
 * @param {{
 *   etapa: number|string,
 *   agente: string,
 *   fonte: "regra"|"ferramenta"|"ia",
 *   evidencia: string,
 *   decisao: string,
 *   motivoIa?: string,
 *   timestampMs: number
 * }} rec
 */
export function registrarDecisao({ etapa, agente, fonte, evidencia, decisao, motivoIa, timestampMs }) {
  // Contrato duro: decisão sem fonte ou sem evidência NÃO é gravada —
  // é erro. Registro incompleto derruba exatamente a credibilidade que
  // este arquivo existe pra sustentar.
  if (!fonte || !["regra", "ferramenta", "ia"].includes(fonte)) {
    throw new Error(`registrarDecisao: fonte inválida "${fonte}" (use: regra | ferramenta | ia)`);
  }
  if (!evidencia || !String(evidencia).trim()) {
    throw new Error("registrarDecisao: `evidencia` é obrigatória — decisão sem evidência não é auditável");
  }
  if (fonte === "ia" && !motivoIa) {
    throw new Error("registrarDecisao: decisão com fonte=ia exige `motivoIa` (por que uma ferramenta não resolveu?)");
  }

  if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });
  const linha = JSON.stringify({
    ts: new Date(timestampMs ?? 0).toISOString(),
    etapa,
    agente,
    fonte,
    ia_usada: fonte === "ia",
    evidencia: String(evidencia).slice(0, 500),
    decisao: String(decisao).slice(0, 500),
    ...(motivoIa ? { motivo_ia: String(motivoIa).slice(0, 300) } : {}),
  });
  appendFileSync(LOG_PATH, linha + "\n", "utf-8");
}

/**
 * A prova do 80/20. Lê o log e devolve a proporção real.
 */
export function resumirDecisoes() {
  const vazio = {
    total: 0, porRegra: 0, porFerramenta: 0, porIa: 0,
    percentualSemIa: 0, porEtapa: {}, corrompidas: 0,
  };
  if (!existsSync(LOG_PATH)) return vazio;

  const linhas = readFileSync(LOG_PATH, "utf-8").trim().split("\n").filter(Boolean);
  const s = { ...vazio, porEtapa: {} };

  for (const l of linhas) {
    let r;
    try {
      r = JSON.parse(l);
    } catch {
      s.corrompidas += 1;
      continue;
    }
    s.total += 1;
    if (r.fonte === "regra") s.porRegra += 1;
    else if (r.fonte === "ferramenta") s.porFerramenta += 1;
    else if (r.fonte === "ia") s.porIa += 1;

    const k = String(r.etapa);
    s.porEtapa[k] ??= { total: 0, semIa: 0, comIa: 0 };
    s.porEtapa[k].total += 1;
    if (r.ia_usada) s.porEtapa[k].comIa += 1;
    else s.porEtapa[k].semIa += 1;
  }

  s.percentualSemIa = s.total === 0 ? 0 : Math.round(((s.porRegra + s.porFerramenta) / s.total) * 100);
  return s;
}

export const DECISION_LOG_PATH = LOG_PATH;
