import { CONDICOES, avaliarConselho, detectarLinha, proximoPasso } from "./etapas.js";

/**
 * IA GATE — a peça que faz o 80/20 acontecer.
 *
 * Toda decisão do orquestrador passa por aqui, e a pergunta é sempre a
 * mesma: **existe regra ou ferramenta que resolve isto?** Se existe, a
 * IA não é chamada. Só o que sobra — julgamento real, geração de
 * conteúdo, interpretação de ambiguidade — vira token.
 *
 * A régua de 4 níveis (do material que o Thiago trouxe, e que virou o
 * Bloco 1 de `docs/arquitetura-orquestrador-offline.md`):
 *   1. Determinístico — mesma entrada, mesma saída, sempre. Zero token.
 *   2. Heurístico — regra com limiar. Zero token, mas pode errar, então
 *      vira SINAL pra IA olhar, nunca veredito sozinho.
 *   3. IA sobre evidência já extraída — a IA recebe o achado da
 *      ferramenta, não o projeto cru. É onde token é bem gasto.
 *   4. IA sem ferramenta — só quando 1, 2 e 3 não cobrem.
 *
 * REGRA DE OURO DESTE ARQUIVO: IA nunca é a fonte da evidência quando
 * uma ferramenta produz a evidência.
 */

/**
 * Decisões que o código resolve sozinho — cada uma era, antes, um
 * pedaço de prompt que um LLM relia e reinterpretava a cada passo.
 */
export const DECISOES_DETERMINISTICAS = {
  /** Qual agente entra agora? — máquina de estado, não julgamento. */
  proximo_agente: (ctx) => {
    const r = proximoPasso(ctx);
    return { resolvido: true, resultado: r, evidencia: `etapas.js/proximoPasso: ${r.motivo}` };
  },

  /** Este agente entra ou é pulado? — condição pura sobre o brief. */
  agente_aplicavel: ({ condicao, brief }) => {
    const fn = CONDICOES[condicao];
    if (!fn) return { resolvido: false, motivo: `condição "${condicao}" não existe como regra` };
    const v = fn(brief);
    return {
      resolvido: true,
      resultado: v,
      evidencia: `etapas.js/CONDICOES.${condicao}(brief) = ${v}`,
    };
  },

  /** Convoca o Conselho? — checklist binário, 2+ "sim". */
  convocar_conselho: ({ decisao }) => {
    const r = avaliarConselho(decisao);
    return { resolvido: true, resultado: r, evidencia: `etapas.js/avaliarConselho: ${r.motivo}` };
  },

  /** Qual linha de produto? — regra quando dá; escala quando não dá. */
  linha_de_produto: ({ brief }) => {
    const r = detectarLinha(brief);
    if (!r.linha) {
      return { resolvido: false, motivo: r.fonte }; // ← vira chamada de IA, e está certo
    }
    return { resolvido: true, resultado: r.linha, evidencia: `etapas.js/detectarLinha: ${r.fonte}` };
  },

  /** A saída do agente respeita o formato declarado? — parser, não leitura. */
  saida_no_formato: ({ saida, camposObrigatorios = [] }) => {
    const faltando = camposObrigatorios.filter((c) => {
      const rx = new RegExp(`^\\s*\\*?\\*?${c}\\*?\\*?\\s*:`, "im");
      return !rx.test(String(saida || ""));
    });
    return {
      resolvido: true,
      resultado: { conforme: faltando.length === 0, faltando },
      evidencia: faltando.length === 0
        ? `todos os ${camposObrigatorios.length} campos obrigatórios presentes`
        : `campos ausentes: ${faltando.join(", ")}`,
    };
  },

  /** A entrega pode avançar? — vereditos são valores, não opinião. */
  pode_avancar: ({ vereditos = {} }) => {
    const reprovados = Object.entries(vereditos).filter(([, v]) => v !== "pass");
    return {
      resolvido: true,
      resultado: { avanca: reprovados.length === 0, reprovados: reprovados.map(([k, v]) => `${k}=${v}`) },
      evidencia: reprovados.length === 0
        ? "todos os auditores aplicáveis deram pass"
        : `bloqueado por: ${reprovados.map(([k, v]) => `${k}=${v}`).join(", ")}`,
    };
  },
};

/**
 * Decisões que EXIGEM IA — listadas explicitamente pra que "chamar IA"
 * seja uma escolha declarada, nunca o default preguiçoso.
 * Cada uma tem o motivo escrito: se um dia uma ferramenta cobrir o
 * caso, ela sai desta lista e entra na de cima.
 */
export const DECISOES_QUE_EXIGEM_IA = {
  gerar_conteudo: "produzir copy, código, análise ou diagnóstico — não existe ferramenta que gere julgamento novo",
  interpretar_pedido_cru: "traduzir o que o diretor disse em brief estruturado; ambiguidade humana não tem parser",
  classificar_severidade: "a ferramenta ACHA o problema (npm audit, Semgrep); priorizar impacto no negócio é julgamento",
  julgar_conversao: "número de Lighthouse é fato; 'essa copy converte pra esse público' não é medível por regra",
  deliberar_conselho: "as 3 lentes existem justamente para serem 3 julgamentos independentes — é o ponto do desenho",
  achar_generico_novo: "checklist pega o genérico já listado; o fiscal existe pra pegar o que ainda não está na lista",
};

/**
 * O gate propriamente dito.
 *
 * @param {string} tipo — chave de DECISOES_DETERMINISTICAS ou DECISOES_QUE_EXIGEM_IA
 * @param {object} ctx
 * @returns {{precisaIa: boolean, resultado?: any, fonte: "regra"|"ia", evidencia: string, motivoIa?: string}}
 */
export function decidir(tipo, ctx = {}) {
  const det = DECISOES_DETERMINISTICAS[tipo];
  if (det) {
    const r = det(ctx);
    if (r.resolvido) {
      return { precisaIa: false, resultado: r.resultado, fonte: "regra", evidencia: r.evidencia };
    }
    // A regra existe mas não deu conta deste caso — escalada honesta.
    return {
      precisaIa: true,
      fonte: "ia",
      evidencia: `regra "${tipo}" tentou e não resolveu`,
      motivoIa: r.motivo,
    };
  }

  const motivo = DECISOES_QUE_EXIGEM_IA[tipo];
  if (motivo) {
    return { precisaIa: true, fonte: "ia", evidencia: `tipo "${tipo}" é judgment-bound por natureza`, motivoIa: motivo };
  }

  // Tipo desconhecido: falha ALTO em vez de assumir "chama IA". Assumir
  // IA silenciosamente é como o sistema volta pra 100% de token sem
  // ninguém perceber — exatamente o que este arquivo existe pra evitar.
  throw new Error(
    `decidir: tipo "${tipo}" não está classificado. ` +
    `Adicione em DECISOES_DETERMINISTICAS (se regra resolve) ou em ` +
    `DECISOES_QUE_EXIGEM_IA (com o motivo escrito). Não existe default.`
  );
}
