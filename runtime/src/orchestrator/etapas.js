/**
 * MÁQUINA DE ESTADO DO FLUXO — 100% determinística, zero token.
 *
 * Esta é a peça que torna "80% sem IA" real em vez de meta. Decidir
 * "qual etapa vem depois desta" e "qual agente entra agora" nunca
 * precisou de LLM: está escrito como regra fixa em
 * `.claude/rules/orchestration.md` desde o começo. Até 2026-08-17 um
 * modelo relia e reinterpretava essa regra a cada passo — caro e
 * frágil. Agora é `switch`.
 *
 * Fonte da verdade continua sendo `orchestration.md`. Este arquivo é a
 * tradução executável dela; `self-test.mjs` compara os dois pra
 * garantir que não divirjam (foi assim que CLAUDE.md e
 * orchestration.md divergiram uma vez sem ninguém notar).
 */

/** As 6 etapas oficiais. 1b (Conselho) é condicional, não sequencial. */
export const ETAPAS = {
  INTAKE: 1,
  CONSELHO: "1b",
  ANALISE: 2,
  PLANO: 3,
  IMPLEMENTACAO: 4,
  AUDITORIA: 5,
  FECHAMENTO: 6,
};

/**
 * Roteamento por linha de produto — espelha `orchestration.md`.
 * Cada entrada: { etapa, agente, condicao? }
 * `condicao` é uma função pura sobre o brief — SEM IA.
 */
export const LINHAS = {
  "site": [
    { etapa: 1, agente: "navigator-agent" },
    { etapa: 2, agente: "business-agent" },
    { etapa: 2, agente: "creative-agent" },
    { etapa: 2, agente: "technical-agent" },
    { etapa: 3, agente: "swarm-planner", tipo: "skill" },
    { etapa: 4, agente: "implementation-agent" },
    { etapa: 5, agente: "qa-agent", condicao: "temFormularioOuIntegracao" },
    { etapa: 5, agente: "security-agent", condicao: "temDadoPessoal" },
    { etapa: 5, agente: "reviewer-agent" },
    { etapa: 5, agente: "infra-agent", condicao: "vaiParaDeploy" },
    { etapa: 5, agente: "fiscal-agent" },
    { etapa: 6, agente: "docs-agent" },
  ],
  "sistema": [
    { etapa: 1, agente: "navigator-agent" },
    { etapa: 2, agente: "business-agent" },
    { etapa: 2, agente: "backend-master" },
    { etapa: 2, agente: "creative-agent" },
    { etapa: 2, agente: "technical-agent" },
    { etapa: 3, agente: "swarm-planner", tipo: "skill" },
    { etapa: 4, agente: "implementation-agent" },
    { etapa: 5, agente: "qa-agent" },
    { etapa: 5, agente: "security-agent" },
    { etapa: 5, agente: "reviewer-agent" },
    { etapa: 5, agente: "infra-agent", condicao: "vaiParaDeploy" },
    { etapa: 5, agente: "fiscal-agent" },
    { etapa: 6, agente: "docs-agent" },
  ],
  "marketing": [
    { etapa: 1, agente: "navigator-agent" },
    { etapa: 2, agente: "business-agent", condicao: "duvidaDeOfertaOuPosicionamento" },
    { etapa: 2, agente: "marketing-master" },
    { etapa: 5, agente: "fiscal-agent" },
    { etapa: 6, agente: "docs-agent" },
  ],
};

/**
 * Condições — funções PURAS sobre o brief. Zero token, resultado
 * reprodutível. Cada uma responde uma pergunta que antes um LLM
 * respondia relendo o brief inteiro.
 */
export const CONDICOES = {
  temFormularioOuIntegracao: (brief = {}) =>
    Boolean(brief.temFormulario || brief.temIntegracao || brief.capturaLead),
  // Captura de lead É dado pessoal (LGPD). Landing que capta lead
  // aciona security-agent — a regra sempre disse isso, a tabela de
  // roteamento é que não refletia (corrigido 2026-08-17).
  temDadoPessoal: (brief = {}) =>
    Boolean(brief.temLogin || brief.temPagamento || brief.capturaLead || brief.temDadoPessoal),
  vaiParaDeploy: (brief = {}) => brief.vaiParaDeploy !== false, // default: sim
  duvidaDeOfertaOuPosicionamento: (brief = {}) =>
    Boolean(brief.duvidaDeOferta || brief.duvidaDePosicionamento),
};

/**
 * Checklist do Conselho (Etapa 1b) — binário, não impressão.
 * Espelha `orchestration.md`. 2+ "sim" convoca automaticamente.
 * @returns {{convoca: boolean, sims: number, motivo: string}}
 */
export function avaliarConselho(decisao = {}) {
  const respostas = [
    ["reverter exige reconstrução manual", Boolean(decisao.reverterExigeReconstrucao)],
    ["afeta o padrão de todos os projetos futuros", Boolean(decisao.afetaTodosProjetos)],
    ["envolve dado real de cliente, dinheiro ou é irreversível", Boolean(decisao.irreversivelOuFinanceiro)],
  ];
  const sims = respostas.filter(([, v]) => v).length;
  if (decisao.diretorPediu) {
    return { convoca: true, sims, motivo: "o diretor pediu explicitamente (sempre convoca)" };
  }
  if (sims >= 2) {
    return {
      convoca: true,
      sims,
      motivo: `${sims} respostas "sim": ${respostas.filter(([, v]) => v).map(([k]) => k).join("; ")}`,
    };
  }
  return {
    convoca: false,
    sims,
    motivo: sims === 1
      ? `só 1 "sim" (${respostas.find(([, v]) => v)[0]}) — decisão do orquestrador, sem convocar`
      : 'nenhum "sim" no checklist',
  };
}

/**
 * Detecta a linha de produto a partir do brief. Determinístico:
 * palavras-chave e flags, não julgamento. Se não der pra decidir com
 * confiança, devolve null — e AÍ SIM o gate chama IA. É exatamente o
 * desenho "80% código, 20% IA": o código resolve o caso claro e
 * escala só a ambiguidade real.
 */
export function detectarLinha(brief = {}) {
  if (brief.linha && LINHAS[brief.linha]) {
    return { linha: brief.linha, fonte: "declarado no brief", confianca: "alta" };
  }
  if (brief.temLogin || brief.temPagamento || brief.multiUsuario || brief.precisaPersistencia) {
    return { linha: "sistema", fonte: "brief indica login/pagamento/multi-usuário/persistência", confianca: "alta" };
  }
  const texto = String(brief.objetivo || brief.pedido || "").toLowerCase();
  if (/campanha|an[úu]ncio|tr[áa]fego|funil|aquisi[çc][ãa]o|instagram|ads\b/.test(texto)) {
    return { linha: "marketing", fonte: "objetivo menciona aquisição/campanha", confianca: "media" };
  }
  if (/landing|site|p[áa]gina|institucional/.test(texto)) {
    return { linha: "site", fonte: "objetivo menciona site/landing", confianca: "media" };
  }
  return { linha: null, fonte: "não deu pra decidir por regra — escalar pra IA", confianca: "nenhuma" };
}

/**
 * O CORAÇÃO: dado o estado atual, qual é o próximo passo?
 * Determinístico, sem rede, sem token.
 *
 * @param {{linha: string, concluidos: string[], brief?: object}} estado
 * @returns {{acao: "acionar"|"pular"|"fim", agente?: string, etapa?: number|string, motivo: string}}
 */
export function proximoPasso({ linha, concluidos = [], brief = {} }) {
  const rota = LINHAS[linha];
  if (!rota) {
    return { acao: "fim", motivo: `linha de produto desconhecida: "${linha}" (use: ${Object.keys(LINHAS).join(", ")})` };
  }

  const feitos = new Set(concluidos);
  for (const passo of rota) {
    if (feitos.has(passo.agente)) continue;

    if (passo.condicao) {
      const fn = CONDICOES[passo.condicao];
      if (!fn) {
        return { acao: "fim", motivo: `condição desconhecida: ${passo.condicao}` };
      }
      if (!fn(brief)) {
        return {
          acao: "pular",
          agente: passo.agente,
          etapa: passo.etapa,
          motivo: `condição "${passo.condicao}" não satisfeita pelo brief — pulado por regra, sem gastar token`,
        };
      }
    }

    return {
      acao: "acionar",
      agente: passo.agente,
      etapa: passo.etapa,
      tipo: passo.tipo || "agente",
      motivo: `próximo da linha "${linha}", etapa ${passo.etapa}`,
    };
  }

  return { acao: "fim", motivo: `todos os passos da linha "${linha}" concluídos` };
}
