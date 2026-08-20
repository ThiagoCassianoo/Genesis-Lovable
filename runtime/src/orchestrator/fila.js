import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIR = join(__dirname, "..", "..", "logs");

/**
 * FILA PERSISTENTE — o que faz o sistema retomar de onde parou.
 *
 * Sem isto, se o token acabar no meio da Etapa 4, todo o trabalho das
 * etapas 1-3 se perde e a próxima sessão recomeça do zero (foi o que
 * aconteceu com o Thiago em 2026-08-16). Com isto, a próxima execução
 * lê o estado do disco e continua do passo exato.
 *
 * Estado em JSON simples, gravação atômica (escreve .tmp e renomeia)
 * pra que uma interrupção no meio da escrita não corrompa a fila.
 */

export const STATUS = {
  PENDENTE: "pendente",
  EM_ANDAMENTO: "em-andamento",
  FEITO: "feito",
  PULADO: "pulado",
  BLOQUEADO_SEM_IA: "bloqueado-sem-ia",
  FALHOU: "falhou",
};

function caminho(id) {
  return join(DIR, `fila-${id}.json`);
}

/** Cria uma fila nova pra um projeto/cliente. */
export function criarFila({ id, linha, brief = {} }) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  const fila = {
    id,
    linha,
    brief,
    criadaEm: null, // preenchido por quem chama (Date.now não é determinístico em teste)
    itens: [],
    historico: [], // saídas dos agentes, pro context-engine
  };
  salvar(fila);
  return fila;
}

export function carregar(id) {
  const p = caminho(id);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf-8"));
  } catch (e) {
    throw new Error(`fila "${id}" está corrompida (${e.message}) — não vou adivinhar o conteúdo. Arquivo: ${p}`);
  }
}

/** Gravação atômica: interrupção no meio não deixa arquivo pela metade. */
export function salvar(fila) {
  if (!existsSync(DIR)) mkdirSync(DIR, { recursive: true });
  const p = caminho(fila.id);
  const tmp = `${p}.tmp`;
  writeFileSync(tmp, JSON.stringify(fila, null, 2), "utf-8");
  renameSync(tmp, p); // rename é atômico no mesmo filesystem
}

/** Registra que um agente foi acionado. */
export function iniciar(fila, agente, etapa) {
  fila.itens.push({ agente, etapa, status: STATUS.EM_ANDAMENTO, tentativas: 1 });
  return fila;
}

/** Marca conclusão e guarda a saída pro context-engine. */
export function concluir(fila, agente, saida, meta = {}) {
  const item = [...fila.itens].reverse().find((i) => i.agente === agente);
  if (item) {
    item.status = STATUS.FEITO;
    Object.assign(item, meta);
  }
  fila.historico.push({ agente, saida });
  return fila;
}

export function pular(fila, agente, etapa, motivo) {
  fila.itens.push({ agente, etapa, status: STATUS.PULADO, motivo });
  return fila;
}

export function bloquear(fila, agente, etapa, motivo) {
  const item = [...fila.itens].reverse().find((i) => i.agente === agente);
  if (item) {
    item.status = STATUS.BLOQUEADO_SEM_IA;
    item.motivo = motivo;
  } else {
    fila.itens.push({ agente, etapa, status: STATUS.BLOQUEADO_SEM_IA, motivo });
  }
  return fila;
}

/** Quem já terminou — é o que `proximoPasso` precisa saber. */
export function concluidos(fila) {
  return fila.itens
    .filter((i) => i.status === STATUS.FEITO || i.status === STATUS.PULADO)
    .map((i) => i.agente);
}

/** Itens que ficaram esperando IA voltar. */
export function pendentesPorIa(fila) {
  return fila.itens.filter((i) => i.status === STATUS.BLOQUEADO_SEM_IA);
}

export function resumo(fila) {
  const c = (s) => fila.itens.filter((i) => i.status === s).length;
  return {
    id: fila.id,
    linha: fila.linha,
    total: fila.itens.length,
    feitos: c(STATUS.FEITO),
    pulados: c(STATUS.PULADO),
    bloqueados: c(STATUS.BLOQUEADO_SEM_IA),
    falhou: c(STATUS.FALHOU),
  };
}

export const FILA_DIR = DIR;
