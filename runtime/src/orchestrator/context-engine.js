/**
 * CONTEXT ENGINE — passa contexto compacto entre agentes, sem IA.
 *
 * O problema que resolve (diagnóstico do próprio Thiago, 2026-08-16):
 * "gasta muito token porque gera o mesmo contexto e ele vai ter que
 * ficar relendo". Sem esta peça, a saída em prosa do agente A é
 * repassada crua pro agente B, que relê e repensa o que A já concluiu.
 *
 * A extração é DETERMINÍSTICA porque os agentes desta fábrica têm
 * formato de saída fixo declarado no contrato (`## Formato de saída`).
 * Extrair campo de texto com estrutura conhecida é parser, não
 * julgamento — nível 1 da régua do `gate.js`.
 *
 * Regra de segurança: se a saída NÃO estiver no formato esperado, este
 * módulo **não inventa campo vazio** — devolve `conforme: false` e o
 * texto bruto, pra que o orquestrador decida (e o `fiscal-agent` veja
 * o desvio). Preencher campo ausente com "" seria o mesmo padrão de
 * falha silenciosa que a auditoria de 2026-08-17 removeu dos providers.
 */

/**
 * Contratos de saída — quais campos cada agente PROMETE emitir.
 * Espelha a seção `## Formato de saída` de cada `.claude/agents/*.md`.
 * `self-test.mjs` compara os dois pra não divergirem.
 */
export const CAMPOS_DE_SAIDA = {
  "navigator-agent": ["Problema real", "Nicho/segmento", "Público-alvo", "Objetivo principal", "Especialistas recomendados"],
  // A Etapa 3 não é agente, é skill — mas PRODUZ contrato, e sem ele
  // aqui a extração devolvia vazio: o plano era gerado e jogado fora, e
  // o implementation-agent reportava "falta critério de aceite" logo
  // depois de o critério ter sido criado. Bug encontrado pela simulação
  // de fluxo completo em 2026-08-17 — nenhum teste unitário pegava,
  // porque cada peça passava sozinha.
  "swarm-planner": ["Critério de aceite", "Arquivos previstos"],
  "business-agent": ["Diagnóstico", "ICP", "Modelo de conversão", "Insights", "Riscos", "Recomendação prioritária"],
  "creative-agent": ["Direção criativa", "Fluxo mapeado", "Conceitos visuais", "Estados cobertos", "Riscos de percepção", "Recomendação"],
  "technical-agent": ["Arquitetura recomendada", "Decisões técnicas", "Riscos", "Stack sugerido"],
  "backend-master": ["Modelo de dados", "Auth e autorização", "Premissas", "Riscos", "Recomendação"],
  "marketing-master": ["Gargalo real", "Jornada", "Riscos", "Recomendação"],
  "infra-agent": ["Checklist", "Bloqueantes", "Custo estimado", "Recomendação"],
  "implementation-agent": ["Etapa implementada", "Arquivos alterados", "Lint", "Build", "Riscos encontrados", "Pendências fora do escopo"],
  "qa-agent": ["Veredito", "Casos testados", "Falhas encontradas"],
  "security-agent": ["Veredito", "Superfície avaliada", "Achados"],
  "reviewer-agent": ["Veredito", "Nota", "Não verificável", "Problemas críticos"],
  "fiscal-agent": ["Veredito", "Achados", "Conformidade de contrato"],
};

/**
 * Campos que cada agente PRECISA receber. Espelha `## Contrato de
 * entrada` de cada `.claude/agents/*.md`.
 *
 * É isto que permite detectar, SEM IA e ANTES de gastar chamada, que
 * a cadeia vai quebrar — o achado (g) da auditoria de arquitetura:
 * `creative-agent` declara 11 inputs obrigatórios e o formato do
 * `business-agent` não emitia nenhum deles nominalmente.
 */
export const CAMPOS_DE_ENTRADA = {
  "business-agent": ["Nicho/segmento", "Público-alvo", "Objetivo principal"],
  "creative-agent": ["Objetivo principal", "Público-alvo", "ICP", "Modelo de conversão"],
  "technical-agent": ["Direção criativa", "Estados cobertos"],
  "backend-master": ["Objetivo principal", "Público-alvo"],
  "implementation-agent": ["Critério de aceite", "Arquivos previstos"],
  "reviewer-agent": ["Critério de aceite", "Arquivos alterados"],
  "qa-agent": ["Critério de aceite", "Arquivos alterados"],
};

/**
 * Extrai os campos declarados de uma saída em formato fixo.
 * Zero token. Aceita `Campo: valor` e `**Campo:** valor`.
 *
 * @returns {{conforme: boolean, campos: object, faltando: string[], bruto: string}}
 */
export function extrairCampos(saida, agente) {
  const esperados = CAMPOS_DE_SAIDA[agente] || [];
  const texto = String(saida || "");
  const campos = {};
  const faltando = [];

  for (const campo of esperados) {
    const rx = new RegExp(`^\\s*\\*{0,2}${escaparRegex(campo)}\\*{0,2}\\s*:\\s*(.+?)\\s*$`, "im");
    const m = texto.match(rx);
    if (m) campos[campo] = m[1].trim();
    else faltando.push(campo);
  }

  return { conforme: faltando.length === 0, campos, faltando, bruto: texto };
}

/**
 * Monta o contexto compacto pro PRÓXIMO agente: só o que ele declarou
 * precisar, vindo do que os anteriores já produziram.
 *
 * Devolve também `lacunas` — campos que o próximo agente exige e que
 * ninguém antes dele produziu. Detectar isso ANTES de chamar a IA é o
 * que evita a cadeia rodar por premissa em vez de dado.
 *
 * @param {string} agenteDestino
 * @param {Array<{agente: string, saida: string}>} historico
 * @returns {{contexto: object, lacunas: string[], textoCompacto: string, economiaEstimadaChars: number}}
 */
export function montarContexto(agenteDestino, historico = []) {
  const precisa = CAMPOS_DE_ENTRADA[agenteDestino] || [];
  const disponivel = {};
  let charsBrutos = 0;

  for (const item of historico) {
    charsBrutos += String(item.saida || "").length;
    const { campos } = extrairCampos(item.saida, item.agente);
    for (const [k, v] of Object.entries(campos)) {
      // Mais recente vence — o agente posterior refina o anterior.
      disponivel[k] = { valor: v, origem: item.agente };
    }
  }

  const contexto = {};
  const lacunas = [];
  for (const campo of precisa) {
    if (disponivel[campo]) contexto[campo] = disponivel[campo];
    else lacunas.push(campo);
  }

  const linhas = Object.entries(contexto).map(([k, v]) => `${k}: ${v.valor}  [via ${v.origem}]`);
  if (lacunas.length > 0) {
    linhas.push(`LACUNAS (ninguém produziu ainda): ${lacunas.join(", ")}`);
  }
  const textoCompacto = linhas.join("\n");

  return {
    contexto,
    lacunas,
    textoCompacto,
    economiaEstimadaChars: Math.max(0, charsBrutos - textoCompacto.length),
  };
}

function escaparRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
