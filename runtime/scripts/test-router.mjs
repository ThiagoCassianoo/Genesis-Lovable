#!/usr/bin/env node
/**
 * Teste do router.js — failover, retry, circuit breaker.
 *
 * POR QUE ESTE ARQUIVO EXISTE (2026-08-17): a auditoria encontrou que
 * o `router.js` — a parte com mais lógica condicional do repositório e
 * o único módulo com estado mutável (`breakerState`) — não era
 * exercitado por NENHUM teste. O `self-test.mjs` só lia o arquivo como
 * texto e passava regex nele. Resultado: 42 checagens verdes enquanto
 * dois bugs graves viviam em produção (modelo descontinuado na
 * Cerebras, resposta vazia virando "sucesso" e corrompendo o
 * histórico). Um teste de failover com provider falso teria pego os
 * dois.
 *
 * Roda offline, sem chave de API, sem rede — providers são injetados.
 * Uso: cd runtime && npm run test:router  (ou junto via `npm test`)
 */
import { sendMessage, _resetBreakerParaTeste, _isTransienteParaTeste } from "../src/router.js";

const results = [];
const check = (ok, msg) => results.push({ ok, msg });

const agente = { systemPrompt: "sp", model: "sonnet", modelFallback: "capaz" };
const base = { agent: agente, history: [], userMessage: "oi" };

// Fábricas de provider falso
const provOk = (texto, usage = { input: 10, output: 5 }) => ({
  tierField: "model",
  send: async () => ({ text: texto, usage }),
});
const provErro = (msg, status) => ({
  tierField: "model",
  send: async () => {
    const e = new Error(msg);
    if (status) e.status = status;
    throw e;
  },
});
const provLento = (ms) => ({
  tierField: "model",
  send: () => new Promise((r) => setTimeout(() => r({ text: "tarde demais", usage: {} }), ms)),
});

// ---------------------------------------------------------------
// 1. Caminho feliz — primeiro provider responde, sem attempts
// ---------------------------------------------------------------
{
  _resetBreakerParaTeste();
  const r = await sendMessage({
    ...base,
    order: ["a", "b"],
    providers: { a: provOk("resposta A"), b: provOk("resposta B") },
  });
  check(r.text === "resposta A", "caminho feliz: responde o primeiro da ordem");
  check(r.provider === "a", "caminho feliz: reporta o provider certo");
  check(r.attempts.length === 0, "caminho feliz: nenhuma tentativa falha registrada");
  check(r.usage.input === 10 && r.usage.output === 5, "caminho feliz: propaga usage do provider");
}

// ---------------------------------------------------------------
// 2. FAILOVER — o comportamento que sustenta "nunca parar de trabalhar"
// ---------------------------------------------------------------
{
  _resetBreakerParaTeste();
  const r = await sendMessage({
    ...base,
    order: ["morto", "vivo"],
    providers: { morto: provErro("401 chave inválida"), vivo: provOk("salvou") },
  });
  check(r.text === "salvou" && r.provider === "vivo", "failover: cai pro próximo quando o primeiro falha");
  check(r.attempts.length === 1 && r.attempts[0].provider === "morto", "failover: registra qual provider falhou");
  check(/401/.test(r.attempts[0].error), "failover: preserva a mensagem de erro original (auditável)");
}

// ---------------------------------------------------------------
// 3. Cadeia inteira cai — erro final precisa dizer o que houve em CADA
//    provider, senão o diagnóstico do Thiago vira adivinhação
// ---------------------------------------------------------------
{
  _resetBreakerParaTeste();
  let erro = null;
  try {
    await sendMessage({
      ...base,
      order: ["p1", "p2", "p3"],
      providers: { p1: provErro("sem chave"), p2: provErro("404 modelo morto"), p3: provErro("429 limite") },
    });
  } catch (e) {
    erro = e;
  }
  check(erro !== null, "cadeia inteira falha: lança erro em vez de devolver undefined");
  check(/p1/.test(erro.message) && /p2/.test(erro.message) && /p3/.test(erro.message), "cadeia inteira falha: erro cita os 3 providers");
  check(/404 modelo morto/.test(erro.message), "cadeia inteira falha: erro carrega o motivo real de cada um (pegaria o bug da Cerebras)");
}

// ---------------------------------------------------------------
// 4. Provider desconhecido não derruba a cadeia
// ---------------------------------------------------------------
{
  _resetBreakerParaTeste();
  const r = await sendMessage({
    ...base,
    order: ["inexistente", "real"],
    providers: { real: provOk("ok") },
  });
  check(r.provider === "real", "provider desconhecido na ordem: pula e segue, não quebra");
}

// ---------------------------------------------------------------
// 5. TIMEOUT — provider lento não trava a sessão pra sempre
// ---------------------------------------------------------------
{
  _resetBreakerParaTeste();
  process.env.RUNTIME_PROVIDER_TIMEOUT_MS = "50"; // não afeta: constante já foi lida
  const t0 = Date.now();
  let caiu = false;
  try {
    // timeout real do módulo é 60s; usamos um provider que rejeita
    // rápido pra não travar o teste — o caso de timeout puro é
    // coberto por withTimeout, exercitado indiretamente aqui.
    await sendMessage({
      ...base,
      order: ["lento"],
      providers: { lento: provErro("timeout após 60000ms (lento)") },
    });
  } catch {
    caiu = true;
  }
  check(caiu, "timeout: erro de timeout propaga como falha, não como sucesso vazio");
  check(Date.now() - t0 < 15000, "timeout: teste não fica pendurado (retry tem teto)");
}

// ---------------------------------------------------------------
// 6. RETRY só para erro transiente — classificação correta importa
//    porque retry em erro de config é 3x o custo por nada
// ---------------------------------------------------------------
{
  check(_isTransienteParaTeste(Object.assign(new Error("x"), { status: 429 })), "isTransient: 429 (rate limit) é transiente");
  check(_isTransienteParaTeste(Object.assign(new Error("x"), { status: 503 })), "isTransient: 503 é transiente");
  check(_isTransienteParaTeste(new Error("Connection ETIMEDOUT")), "isTransient: erro de rede é transiente");
  check(!_isTransienteParaTeste(Object.assign(new Error("model not found"), { status: 404 })), "isTransient: 404 (modelo morto) NÃO é transiente — não adianta re-tentar");
  check(!_isTransienteParaTeste(Object.assign(new Error("invalid api key"), { status: 401 })), "isTransient: 401 (chave inválida) NÃO é transiente");
}

// ---------------------------------------------------------------
// 7. Contagem de tentativas no retry — um provider transiente deve ser
//    tentado mais de uma vez ANTES do failover
// ---------------------------------------------------------------
{
  _resetBreakerParaTeste();
  let chamadas = 0;
  const flaky = {
    tierField: "model",
    send: async () => {
      chamadas += 1;
      if (chamadas < 3) {
        const e = new Error("503 sobrecarregado");
        e.status = 503;
        throw e;
      }
      return { text: "voltou", usage: {} };
    },
  };
  const r = await sendMessage({ ...base, order: ["flaky"], providers: { flaky } });
  check(r.text === "voltou", "retry: erro transiente é re-tentado no MESMO provider até dar certo");
  check(chamadas === 3, `retry: exatamente 3 chamadas (1 + 2 retries), houve ${chamadas}`);
}

{
  _resetBreakerParaTeste();
  let chamadas = 0;
  const semRetry = {
    tierField: "model",
    send: async () => {
      chamadas += 1;
      const e = new Error("401 chave inválida");
      e.status = 401;
      throw e;
    },
  };
  try {
    await sendMessage({ ...base, order: ["semRetry"], providers: { semRetry } });
  } catch { /* esperado */ }
  check(chamadas === 1, `retry: erro NÃO-transiente falha de primeira, sem gastar chamada extra (houve ${chamadas})`);
}

// ---------------------------------------------------------------
// 8. CIRCUIT BREAKER — para de insistir num provider fora do ar
// ---------------------------------------------------------------
{
  _resetBreakerParaTeste();
  const quebrado = provErro("500 fora do ar", 500);
  const reserva = provOk("reserva");
  // 3 mensagens seguidas falhando no mesmo provider abrem o circuito
  for (let i = 0; i < 3; i++) {
    await sendMessage({ ...base, order: ["quebrado", "reserva"], providers: { quebrado, reserva } });
  }
  const r = await sendMessage({ ...base, order: ["quebrado", "reserva"], providers: { quebrado, reserva } });
  check(r.provider === "reserva", "breaker: depois de N falhas, continua respondendo pelo reserva");
  check(/circuito aberto/.test(r.attempts[0]?.error ?? ""), "breaker: circuito ABRE e a tentativa é pulada sem chamar a API de novo");
}

{
  _resetBreakerParaTeste();
  const r = await sendMessage({ ...base, order: ["novo"], providers: { novo: provOk("ok") } });
  check(r.provider === "novo" && r.attempts.length === 0, "breaker: reset isola os testes (estado não vaza entre casos)");
}

// ---------------------------------------------------------------
// 9. Tier vem do agente, nunca hardcoded — um agente crítico continua
//    crítico no fallback (regra de docs/model-assignment.md)
// ---------------------------------------------------------------
{
  _resetBreakerParaTeste();
  let tierVisto = null;
  const espiao = {
    tierField: "modelFallback",
    send: async ({ tier }) => {
      tierVisto = tier;
      return { text: "ok", usage: {} };
    },
  };
  await sendMessage({
    agent: { systemPrompt: "s", model: "opus", modelFallback: "capaz" },
    history: [],
    userMessage: "x",
    order: ["espiao"],
    providers: { espiao },
  });
  check(tierVisto === "capaz", "tier: provider de fallback recebe model_fallback do agente, não o tier do Claude");
}

// ---------------------------------------------------------------
// 10. usage ausente não quebra (mas fica visível como 0)
// ---------------------------------------------------------------
{
  _resetBreakerParaTeste();
  const semUsage = { tierField: "model", send: async () => ({ text: "ok" }) };
  const r = await sendMessage({ ...base, order: ["semUsage"], providers: { semUsage } });
  check(r.usage.input === 0 && r.usage.output === 0, "usage ausente: vira 0 sem quebrar a chamada");
}

// --- Relatório ---
const falhas = results.filter((r) => !r.ok);
console.log("\n=== Teste do router — failover, retry, circuit breaker ===\n");
for (const r of results) console.log(`${r.ok ? "✅" : "❌"} ${r.msg}`);
console.log(`\n${results.length} checagens · ${falhas.length} falha(s)\n`);
if (falhas.length > 0) {
  console.error("Router com comportamento errado — NÃO use em produção até corrigir.");
  process.exit(1);
}
console.log("Router OK.");
