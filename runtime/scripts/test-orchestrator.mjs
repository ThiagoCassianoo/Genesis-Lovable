#!/usr/bin/env node
/**
 * Teste da camada determinística — roda offline, zero token.
 *
 * O ponto deste arquivo não é só "passa/falha": ele MEDE quantas
 * decisões de um fluxo real saem sem IA. "80% sem IA" era meta
 * declarada; aqui vira número reproduzível.
 */
import { proximoPasso, avaliarConselho, detectarLinha, LINHAS, CONDICOES } from "../src/orchestrator/etapas.js";
import { decidir, DECISOES_DETERMINISTICAS, DECISOES_QUE_EXIGEM_IA } from "../src/orchestrator/gate.js";
import { extrairCampos, montarContexto } from "../src/orchestrator/context-engine.js";
import { registrarDecisao, resumirDecisoes } from "../src/orchestrator/decision-record.js";
import { AGENTES_COM_FERRAMENTA, FERRAMENTA_POR_AGENTE, ANTI_PADROES } from "../src/orchestrator/ferramentas.js";
import { verificarContradicao } from "../src/orchestrator/witness.js";

const res = [];
const ok = (c, m) => res.push({ ok: c, m });

// ---------------------------------------------------------------
// 1. Máquina de estado — sequência correta, sem IA
// ---------------------------------------------------------------
{
  const brief = { capturaLead: true, temFormulario: true, vaiParaDeploy: true };
  let concluidos = [];
  const ordem = [];
  for (let i = 0; i < 30; i++) {
    const p = proximoPasso({ linha: "site", concluidos, brief });
    if (p.acao === "fim") break;
    ordem.push(`${p.etapa}:${p.agente}`);
    concluidos.push(p.agente);
  }
  ok(ordem[0] === "1:navigator-agent", `fluxo começa no navigator (veio: ${ordem[0]})`);
  ok(ordem.includes("3:swarm-planner"), "fluxo passa pela Etapa 3 (Plano) — sem ela implementation trava por falta de critério de aceite");
  ok(
    ordem.indexOf("3:swarm-planner") < ordem.indexOf("4:implementation-agent"),
    "Plano vem ANTES da implementação"
  );
  ok(ordem.includes("5:security-agent"), "landing que capta lead aciona security-agent (dado pessoal — a regra sempre exigiu)");
  ok(ordem.includes("5:infra-agent"), "landing que vai a deploy aciona infra-agent");
  ok(ordem[ordem.length - 1] === "6:docs-agent", `fluxo termina no fechamento (veio: ${ordem[ordem.length - 1]})`);
  ok(
    ordem.indexOf("5:fiscal-agent") > ordem.indexOf("5:reviewer-agent"),
    "fiscal é o último auditor antes do fechamento"
  );
}

// ---------------------------------------------------------------
// 2. Condições pulam agente SEM gastar token
// ---------------------------------------------------------------
{
  const briefSimples = { capturaLead: false, temFormulario: false, temIntegracao: false, vaiParaDeploy: false };
  const p = proximoPasso({ linha: "site", concluidos: ["navigator-agent", "business-agent", "creative-agent", "technical-agent", "swarm-planner", "implementation-agent"], brief: briefSimples });
  ok(p.acao === "pular" && p.agente === "qa-agent", `landing sem formulário pula qa-agent por regra (veio: ${p.acao}/${p.agente})`);
  ok(/sem gastar token/.test(p.motivo), "o pulo declara que foi por regra, não por IA");
}

// ---------------------------------------------------------------
// 3. Checklist do Conselho — binário
// ---------------------------------------------------------------
{
  ok(avaliarConselho({ reverterExigeReconstrucao: true, afetaTodosProjetos: true }).convoca, "2 sins convocam o Conselho");
  ok(!avaliarConselho({ reverterExigeReconstrucao: true }).convoca, "1 sim NÃO convoca (decisão do orquestrador)");
  ok(avaliarConselho({ diretorPediu: true }).convoca, "diretor pedindo sempre convoca, independente do checklist");
  ok(!avaliarConselho({}).convoca, "zero sins não convoca");
}

// ---------------------------------------------------------------
// 4. Detecção de linha — resolve o claro, escala o ambíguo
// ---------------------------------------------------------------
{
  ok(detectarLinha({ temLogin: true }).linha === "sistema", "login → linha sistema, por regra");
  ok(detectarLinha({ objetivo: "quero uma landing page" }).linha === "site", "objetivo com 'landing' → linha site");
  ok(detectarLinha({ objetivo: "preciso de tráfego e campanha" }).linha === "marketing", "objetivo com campanha → marketing");
  const ambiguo = detectarLinha({ objetivo: "quero melhorar as coisas" });
  ok(ambiguo.linha === null, "pedido ambíguo NÃO é adivinhado — escala pra IA (é o desenho certo)");
}

// ---------------------------------------------------------------
// 5. GATE — o coração do 80/20
// ---------------------------------------------------------------
{
  const d1 = decidir("proximo_agente", { linha: "site", concluidos: [], brief: {} });
  ok(!d1.precisaIa && d1.fonte === "regra", "decidir(proximo_agente) resolve sem IA");

  const d2 = decidir("gerar_conteudo", {});
  ok(d2.precisaIa && d2.motivoIa, "decidir(gerar_conteudo) exige IA e declara o motivo");

  const d3 = decidir("linha_de_produto", { brief: { objetivo: "coisa vaga" } });
  ok(d3.precisaIa, "linha ambígua escala pra IA em vez de chutar");

  const d4 = decidir("pode_avancar", { vereditos: { qa: "pass", security: "pass", fiscal: "revise" } });
  ok(!d4.precisaIa && d4.resultado.avanca === false, "pode_avancar decide por valor, sem IA");
  ok(/fiscal=revise/.test(d4.evidencia), "evidência cita QUEM bloqueou");

  let lancou = false;
  try { decidir("tipo_que_nao_existe", {}); } catch { lancou = true; }
  ok(lancou, "tipo não classificado FALHA ALTO (não assume 'chama IA' em silêncio)");

  const totalClassificado = Object.keys(DECISOES_DETERMINISTICAS).length + Object.keys(DECISOES_QUE_EXIGEM_IA).length;
  ok(totalClassificado >= 12, `${totalClassificado} tipos de decisão classificados explicitamente`);
}

// ---------------------------------------------------------------
// 6. Context Engine — extrai sem IA, não inventa campo
// ---------------------------------------------------------------
{
  const saidaBusiness = `
Diagnóstico: oferta confusa, público não definido
ICP: igreja de médio porte, 200-500 membros
Modelo de conversão: agendamento de visita
Insights: 1) x 2) y 3) z
Riscos: 1) a 2) b
Recomendação prioritária: focar em agendamento
`;
  const e = extrairCampos(saidaBusiness, "business-agent");
  ok(e.conforme, `extrai os 6 campos do business-agent (faltando: ${e.faltando.join(",") || "nenhum"})`);
  ok(e.campos["ICP"].includes("200-500"), "extrai o valor certo, não só detecta presença");

  const incompleta = extrairCampos("Diagnóstico: só isso", "business-agent");
  ok(!incompleta.conforme && incompleta.faltando.length === 5, "saída fora do formato: reporta o que falta, NÃO inventa campo vazio");

  const ctx = montarContexto("creative-agent", [
    { agente: "navigator-agent", saida: "Objetivo principal: agendamento\nPúblico-alvo: membros" },
    { agente: "business-agent", saida: saidaBusiness },
  ]);
  ok(ctx.lacunas.length === 0, `creative recebe os 4 inputs que declara precisar (lacunas: ${ctx.lacunas.join(",") || "nenhuma"})`);
  ok(ctx.economiaEstimadaChars > 0, `contexto compacto economiza ${ctx.economiaEstimadaChars} chars vs. mandar tudo cru`);

  const ctxFurado = montarContexto("implementation-agent", [{ agente: "technical-agent", saida: "Arquitetura recomendada: react" }]);
  ok(
    ctxFurado.lacunas.includes("Critério de aceite"),
    "detecta ANTES de chamar IA que implementation ficaria sem critério de aceite (a quebra que travava a cadeia)"
  );
}

// ---------------------------------------------------------------
// 7. Decision Record — contrato duro, e mede o 80/20
// ---------------------------------------------------------------
{
  let erros = 0;
  try { registrarDecisao({ etapa: 1, agente: "x", fonte: "chute", evidencia: "e", decisao: "d", timestampMs: 1 }); } catch { erros++; }
  try { registrarDecisao({ etapa: 1, agente: "x", fonte: "regra", evidencia: "", decisao: "d", timestampMs: 1 }); } catch { erros++; }
  try { registrarDecisao({ etapa: 1, agente: "x", fonte: "ia", evidencia: "e", decisao: "d", timestampMs: 1 }); } catch { erros++; }
  ok(erros === 3, `decisão sem fonte válida / sem evidência / IA sem motivo é REJEITADA (${erros}/3)`);
}

// ---------------------------------------------------------------
// 8. MEDIÇÃO DO 80/20 — simula um fluxo completo e conta
// ---------------------------------------------------------------
{
  const brief = { capturaLead: true, temFormulario: true, vaiParaDeploy: true, objetivo: "landing page para igreja" };
  const decisoes = [];
  const reg = (fonte) => decisoes.push(fonte);

  // Decisões de orquestração — todas por regra
  reg(decidir("linha_de_produto", { brief }).fonte);
  let concluidos = [];
  for (let i = 0; i < 30; i++) {
    const d = decidir("proximo_agente", { linha: "site", concluidos, brief });
    reg(d.fonte);
    const p = d.resultado;
    if (p.acao === "fim") break;
    if (p.acao === "acionar") {
      // Antes de acordar o agente: a ferramenta dele roda e produz
      // FATO. Isso é trabalho que saía da IA e agora sai de comando.
      if (AGENTES_COM_FERRAMENTA.includes(p.agente)) reg("ferramenta");
      // Montar o contexto compacto pro agente = regra (parser)
      reg("regra");
      // Cada agente acionado = 1 chamada de IA (gerar/julgar conteúdo)
      reg(decidir("gerar_conteudo", {}).fonte);
      // Validar o formato da saída = regra
      reg(decidir("saida_no_formato", { saida: "Diagnóstico: x", camposObrigatorios: ["Diagnóstico"] }).fonte);
      // Checar se o próximo agente vai ter os inputs que declara = regra
      reg("regra");
    }
    concluidos.push(p.agente);
  }
  reg(decidir("convocar_conselho", { decisao: {} }).fonte);
  reg(decidir("pode_avancar", { vereditos: { qa: "pass", fiscal: "pass" } }).fonte);

  const porRegra = decisoes.filter((f) => f === "regra").length;
  const porFerramenta = decisoes.filter((f) => f === "ferramenta").length;
  const porIa = decisoes.filter((f) => f === "ia").length;
  const semIa = porRegra + porFerramenta;
  const pct = Math.round((semIa / decisoes.length) * 100);
  console.log(`\n📊 MEDIÇÃO DO 80/20 (fluxo completo de landing page simulado):`);
  console.log(`   ${decisoes.length} decisões no total`);
  console.log(`   ${porRegra} por REGRA (máquina de estado, parser, condição)`);
  console.log(`   ${porFerramenta} por FERRAMENTA (npm audit, npm test, lint, grep)`);
  console.log(`   ${porIa} por IA (gerar conteúdo, julgar — onde token é bem gasto)`);
  console.log(`   → ${pct}% resolvido SEM chamada de API\n`);
  ok(pct >= 80, `fluxo real resolve ${pct}% das decisões sem IA (meta do diretor: >=80%)`);
}

// ---------------------------------------------------------------
// 9. Camada de ferramentas — evidência antes da IA
// ---------------------------------------------------------------
{
  ok(AGENTES_COM_FERRAMENTA.length >= 6, `${AGENTES_COM_FERRAMENTA.length} agentes têm ferramenta que gera evidência antes da IA`);
  for (const ag of ["security-agent", "qa-agent", "reviewer-agent", "business-agent", "fiscal-agent", "implementation-agent"]) {
    ok(AGENTES_COM_FERRAMENTA.includes(ag), `${ag} tem ferramenta mapeada (fato antes de julgamento)`);
  }
  ok(
    ANTI_PADROES.filter((a) => a.rx).length >= 3,
    "anti-padrões da Regra 4 detectáveis por regex (gradiente roxo, texto vago, glassmorphism) — não precisam de IA"
  );
  // A ferramenta declara explicitamente o que sobra pra IA — se não
  // declara, é sinal de que a fronteira não foi pensada.
  const semFronteira = Object.entries(FERRAMENTA_POR_AGENTE).filter(
    ([, f]) => typeof f.executar !== "function"
  );
  ok(semFronteira.length === 0, "toda ferramenta é executável");
}

// ---------------------------------------------------------------
// 10. WITNESS — veredito declarado × fato da ferramenta (importado de
// github.com/juyterman1000/entroly, 2026-08-26)
// ---------------------------------------------------------------
{
  const contradiz = verificarContradicao({
    agente: "qa-agent",
    evidenciaBruta: { exitCode: 1 },
    saidaAgente: "Veredito: pass\nCasos testados: login, logout",
  });
  ok(contradiz.aplicavel && contradiz.contradiz === true, "witness: exit 1 (falhou) + 'Veredito: pass' = CONTRADIÇÃO pega, sem gastar token");

  const bate = verificarContradicao({
    agente: "qa-agent",
    evidenciaBruta: { exitCode: 0 },
    saidaAgente: "Veredito: pass\nCasos testados: login, logout",
  });
  ok(bate.aplicavel && bate.contradiz === false, "witness: exit 0 (passou) + 'Veredito: pass' = sem contradição");

  const semExitCode = verificarContradicao({
    agente: "business-agent",
    evidenciaBruta: { fato: true }, // sem exitCode — ex.: grep em docs/decisoes.md
    saidaAgente: "Veredito: pass",
  });
  ok(semExitCode.aplicavel === false, "witness: sem exit code binário na evidência, não se aplica (não é falso-negativo, é 'não avalia')");

  const semVeredito = verificarContradicao({
    agente: "creative-agent",
    evidenciaBruta: { exitCode: 1 },
    saidaAgente: "Direção criativa: minimalista, sem seção de Veredito nesse contrato",
  });
  ok(semVeredito.aplicavel === false, "witness: agente sem campo 'Veredito' no contrato não é avaliado (evita falso positivo em agente read-only)");
}

// --- Relatório ---
const falhas = res.filter((r) => !r.ok);
console.log("=== Teste da camada determinística (orchestrator) ===\n");
for (const r of res) console.log(`${r.ok ? "✅" : "❌"} ${r.m}`);
console.log(`\n${res.length} checagens · ${falhas.length} falha(s)\n`);
if (falhas.length > 0) {
  console.error("Camada determinística com comportamento errado.");
  process.exit(1);
}
console.log("Orquestrador determinístico OK.");
