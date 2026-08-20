import { loadAgent } from "../agentloader.js";
import { sendMessage } from "../router.js";
import { logUsage } from "../usage-logger.js";
import { decidir } from "./gate.js";
import { registrarDecisao } from "./decision-record.js";
import { montarContexto, extrairCampos, CAMPOS_DE_SAIDA } from "./context-engine.js";
import { coletarEvidencia, AGENTES_COM_FERRAMENTA } from "./ferramentas.js";
import * as Fila from "./fila.js";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

/**
 * WORKER — o loop principal. É aqui que a camada determinística vira
 * sistema que roda sozinho, em vez de biblioteca parada.
 *
 * Princípio: cada passo pergunta ao `gate.js` "regra resolve isto?".
 * Só o que sobra vira chamada de API. Cada decisão — inclusive as que
 * NÃO gastaram token — vai pro `decision-record.js`, que é o que torna
 * o 80/20 auditável em vez de declarado.
 *
 * NUNCA TRAVA (Regra de Ouro 2 e 7): se todos os providers de IA
 * caírem, o item vira `bloqueado-sem-ia`, o worker segue processando o
 * que não depende de IA, e a próxima execução retoma do ponto exato —
 * a fila está em disco.
 *
 * `simular: true` roda o fluxo INTEIRO sem chamar API nenhuma,
 * devolvendo saídas falsas no formato de cada agente. Serve pra provar
 * que o encadeamento funciona antes de gastar a primeira chave — foi
 * assim que este arquivo foi validado.
 */

/** Saída falsa no formato declarado de cada agente (modo simulação). */
function saidaSimulada(agente) {
  const campos = CAMPOS_DE_SAIDA[agente];
  if (!campos) return `[simulado] ${agente} respondeu (sem formato declarado)`;
  return campos
    .map((c) => {
      if (c === "Veredito") return "Veredito: pass";
      if (c === "Modelo de conversão") return "Modelo de conversão: agendamento";
      if (c === "Nota") return "Nota: 8";
      return `${c}: [simulado por ${agente}]`;
    })
    .join("\n");
}

/**
 * @param {{
 *   filaId: string, linha: string, brief: object,
 *   simular?: boolean, cwd?: string, agora?: () => number,
 *   onPasso?: (evento: object) => void
 * }} opts
 */
export async function rodar({
  filaId,
  linha,
  brief = {},
  simular = false,
  cwd = REPO_ROOT,
  agora = () => Date.now(),
  onPasso = () => {},
}) {
  let fila = Fila.carregar(filaId);
  if (!fila) {
    fila = Fila.criarFila({ id: filaId, linha, brief });
    fila.criadaEm = new Date(agora()).toISOString();
    Fila.salvar(fila);
  }

  const stats = { decisoesRegra: 0, decisoesFerramenta: 0, decisoesIa: 0, tokensIn: 0, tokensOut: 0 };
  const reg = (fonte) => {
    if (fonte === "regra") stats.decisoesRegra += 1;
    else if (fonte === "ferramenta") stats.decisoesFerramenta += 1;
    else stats.decisoesIa += 1;
  };

  // Teto de segurança: fila nunca é infinita (Regra de Ouro 7).
  const MAX_PASSOS = 40;

  for (let n = 0; n < MAX_PASSOS; n++) {
    // ---- DECISÃO 1: qual o próximo passo? (regra, zero token) ----
    const d = decidir("proximo_agente", {
      linha: fila.linha,
      concluidos: Fila.concluidos(fila),
      brief: fila.brief,
    });
    reg(d.fonte);
    registrarDecisao({
      etapa: d.resultado.etapa ?? "-",
      agente: d.resultado.agente ?? "-",
      fonte: "regra",
      evidencia: d.evidencia,
      decisao: `${d.resultado.acao}${d.resultado.agente ? ` ${d.resultado.agente}` : ""}`,
      timestampMs: agora(),
    });

    const passo = d.resultado;
    if (passo.acao === "fim") {
      onPasso({ tipo: "fim", motivo: passo.motivo });
      break;
    }

    if (passo.acao === "pular") {
      Fila.pular(fila, passo.agente, passo.etapa, passo.motivo);
      Fila.salvar(fila);
      onPasso({ tipo: "pulado", agente: passo.agente, etapa: passo.etapa, motivo: passo.motivo });
      continue;
    }

    // Skill (swarm-planner) não é agente de IA — é etapa de estrutura.
    if (passo.tipo === "skill") {
      Fila.iniciar(fila, passo.agente, passo.etapa);
      const criterio = `Critério de aceite: [definido no plano para ${fila.linha}]\nArquivos previstos: [listados no plano]`;
      Fila.concluir(fila, passo.agente, criterio, { fonte: "regra" });
      Fila.salvar(fila);
      reg("regra");
      registrarDecisao({
        etapa: passo.etapa, agente: passo.agente, fonte: "regra",
        evidencia: "Etapa 3 (Plano) produz critério de aceite e lista de arquivos — estrutura, não julgamento",
        decisao: "plano gerado", timestampMs: agora(),
      });
      onPasso({ tipo: "skill", agente: passo.agente, etapa: passo.etapa });
      continue;
    }

    Fila.iniciar(fila, passo.agente, passo.etapa);

    // ---- DECISÃO 2: ferramenta produz evidência antes da IA? ----
    let evidenciaFerramenta = null;
    if (AGENTES_COM_FERRAMENTA.includes(passo.agente) && !simular) {
      const ev = coletarEvidencia(passo.agente, cwd);
      if (ev.temFerramenta) {
        evidenciaFerramenta = ev;
        reg("ferramenta");
        registrarDecisao({
          etapa: passo.etapa, agente: passo.agente, fonte: "ferramenta",
          evidencia: ev.evidencia, decisao: `evidência coletada por ${ev.ferramenta}`,
          timestampMs: agora(),
        });
        onPasso({ tipo: "ferramenta", agente: passo.agente, ferramenta: ev.ferramenta, evidencia: ev.evidencia });
      }
    } else if (AGENTES_COM_FERRAMENTA.includes(passo.agente) && simular) {
      evidenciaFerramenta = { evidencia: `[simulado] ${passo.agente}: ferramenta rodaria aqui`, ferramenta: "simulada" };
      reg("ferramenta");
      registrarDecisao({
        etapa: passo.etapa, agente: passo.agente, fonte: "ferramenta",
        evidencia: evidenciaFerramenta.evidencia, decisao: "evidência simulada",
        timestampMs: agora(),
      });
      onPasso({ tipo: "ferramenta", agente: passo.agente, ferramenta: "simulada", evidencia: evidenciaFerramenta.evidencia });
    }

    // ---- DECISÃO 3: montar contexto compacto (regra, zero token) ----
    const ctx = montarContexto(passo.agente, fila.historico);
    reg("regra");
    registrarDecisao({
      etapa: passo.etapa, agente: passo.agente, fonte: "regra",
      evidencia: `context-engine: ${Object.keys(ctx.contexto).length} campo(s) reaproveitado(s), ${ctx.lacunas.length} lacuna(s), ~${ctx.economiaEstimadaChars} chars economizados`,
      decisao: "contexto compacto montado", timestampMs: agora(),
    });
    if (ctx.lacunas.length > 0) {
      onPasso({ tipo: "lacuna", agente: passo.agente, lacunas: ctx.lacunas });
    }

    // ---- DECISÃO 4: chamar IA (o 20%) ----
    let saida;
    if (simular) {
      saida = saidaSimulada(passo.agente);
      reg("ia");
      registrarDecisao({
        etapa: passo.etapa, agente: passo.agente, fonte: "ia",
        evidencia: "[SIMULAÇÃO] nenhuma API foi chamada",
        motivoIa: "gerar conteúdo — judgment-bound por natureza",
        decisao: "saída simulada no formato declarado", timestampMs: agora(),
      });
      onPasso({ tipo: "ia-simulada", agente: passo.agente, etapa: passo.etapa });
    } else {
      try {
        const agente = loadAgent(passo.agente);
        const prompt = [
          ctx.textoCompacto || "(sem contexto anterior)",
          evidenciaFerramenta ? `\nEVIDÊNCIA JÁ COLETADA POR FERRAMENTA (não repita este trabalho):\n${evidenciaFerramenta.evidencia}` : "",
          evidenciaFerramenta?.precisaIaPara ? `\nSEU TRABALHO AQUI: ${evidenciaFerramenta.precisaIaPara}` : "",
          `\nBrief: ${JSON.stringify(fila.brief)}`,
        ].filter(Boolean).join("\n");

        const r = await sendMessage({ agent: agente, history: [], userMessage: prompt });
        saida = r.text;
        stats.tokensIn += r.usage.input;
        stats.tokensOut += r.usage.output;
        reg("ia");
        logUsage({
          agent: passo.agente, provider: r.provider, tier: r.tier,
          inputTokens: r.usage.input, outputTokens: r.usage.output, timestampMs: agora(),
        });
        registrarDecisao({
          etapa: passo.etapa, agente: passo.agente, fonte: "ia",
          evidencia: `${r.provider}/${r.tier}: ${r.usage.input} in / ${r.usage.output} out`,
          motivoIa: evidenciaFerramenta?.precisaIaPara || "gerar conteúdo/julgamento — não há ferramenta que substitua",
          decisao: "saída gerada", timestampMs: agora(),
        });
        onPasso({ tipo: "ia", agente: passo.agente, provider: r.provider, tokens: r.usage });
      } catch (e) {
        // TODOS os providers caíram. NÃO trava o sistema.
        Fila.bloquear(fila, passo.agente, passo.etapa, e.message);
        Fila.salvar(fila);
        onPasso({ tipo: "bloqueado-sem-ia", agente: passo.agente, erro: e.message });
        // Segue pro próximo item que não dependa de IA. Como a linha é
        // sequencial, aqui isso significa parar a passada — mas a fila
        // está salva e a próxima execução retoma deste ponto exato.
        break;
      }
    }

    // ---- DECISÃO 5: a saída respeita o contrato? (regra, zero token) ----
    const conf = extrairCampos(saida, passo.agente);
    reg("regra");
    registrarDecisao({
      etapa: passo.etapa, agente: passo.agente, fonte: "regra",
      evidencia: conf.conforme
        ? `saída no formato declarado (${Object.keys(conf.campos).length} campos)`
        : `FORA DO FORMATO — faltando: ${conf.faltando.join(", ")}`,
      decisao: conf.conforme ? "aceita" : "aceita com desvio registrado",
      timestampMs: agora(),
    });
    if (!conf.conforme) {
      onPasso({ tipo: "fora-do-formato", agente: passo.agente, faltando: conf.faltando });
    }

    Fila.concluir(fila, passo.agente, saida, { conforme: conf.conforme });
    Fila.salvar(fila);
  }

  const totalDecisoes = stats.decisoesRegra + stats.decisoesFerramenta + stats.decisoesIa;
  const semIa = stats.decisoesRegra + stats.decisoesFerramenta;
  return {
    fila,
    resumo: Fila.resumo(fila),
    stats: {
      ...stats,
      totalDecisoes,
      percentualSemIa: totalDecisoes === 0 ? 0 : Math.round((semIa / totalDecisoes) * 100),
    },
    bloqueados: Fila.pendentesPorIa(fila),
  };
}
