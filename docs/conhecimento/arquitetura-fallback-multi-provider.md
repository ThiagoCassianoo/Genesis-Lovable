# Arquitetura — fallback multi-provider resiliente (runtime/)

Domínio: `runtime/src/router.js` + `runtime/src/orchestrator/worker.js`.
Origem: sessão 2026-08-26, expansão de 4 pra 8 providers de IA
(Claude, GLM, Groq, Cerebras, Gemini, OpenRouter, Pollinations,
DeepSeek), com prova real de ponta a ponta (não só simulação).

Reutilizável para: qualquer sistema que precise "nunca parar de
trabalhar" chamando um serviço externo instável/limitado — não é
específico de LLM, o padrão serve pra qualquer fila de providers com
rate limit e qualidade variável.

## 1. Circuit breaker por `provider:tier`, não por `provider`

**Problema que resolve:** um provider costuma ter mais de um modelo
(tier "capaz" vs "econômico"). Se o breaker é chaveado só pelo nome do
provider, uma falha no tier caro derruba o tier barato junto — mesmo
ele nunca tendo sido chamado. Achado real: GLM tier capaz tomou rate
limit, e sem esta correção o tier econômico do MESMO GLM ficaria de
fora por 30s à toa.

**Implementação:** chave do estado do breaker = `` `${provider}:${tier}` ``,
não `provider` sozinho. Ver `runtime/src/router.js`, função
`breakerKey()`. Testado em `test-router.mjs` com 2 casos: falha no
tier A não abre o breaker do tier B do mesmo provider; o tier que
falhou continua bloqueado.

**Quando reusar:** qualquer serviço externo com múltiplas variantes
(modelo, região, SKU) atrás do mesmo provider lógico.

## 2. WITNESS — contradição entre veredito declarado e fato coletado

**Problema que resolve:** um agente/serviço pode AFIRMAR sucesso
("Veredito: pass") mesmo quando uma ferramenta determinística já
coletou um fato objetivo de falha (exit code ≠ 0 de `npm test`). Sem
checagem, essa contradição passa despercebida — é a classe de erro
"IA mentindo sobre teste passar", documentada por
`github.com/LoFi-Monk/lofi-gate` (2026-08-26) e resolvida aqui de
forma diferente: eles usam autoavaliação do mesmo agente (sem trava
real); aqui é comparação por regra, zero token, entre dois dados que
JÁ existiam antes da resposta da IA.

**Implementação:** `runtime/src/orchestrator/witness.js`,
`verificarContradicao({ agente, evidenciaBruta, saidaAgente })`. Só se
aplica quando (a) existe exit code binário na evidência da ferramenta
E (b) a saída do agente declara um campo `Veredito:`. Fora desses dois
casos, devolve `aplicavel: false` — nunca inventa julgamento sem os
dois lados presentes. Ver `runtime/src/orchestrator/ferramentas.js`
pra origem do fato (evidência ANTES da IA responder).

**Quando reusar:** qualquer pipeline onde um passo determinístico
produz um resultado binário e um passo de IA/humano declara um
veredito sobre esse mesmo resultado.

## 3. Retry de formato com teto de 1 tentativa

**Problema que resolve:** modelo grátis/menor pode ignorar campo
obrigatório do contrato de saída declarado. Achado real, teste de
ponta a ponta: GLM grátis devolveu saída fora do formato em 2 de 4
passos de um fluxo real.

**Implementação:** `runtime/src/orchestrator/worker.js`, bloco após
`extrairCampos()` da 1ª resposta. Só dispara se o agente TEM contrato
declarado (`CAMPOS_DE_SAIDA`) e a 1ª saída não bate. Nunca mais que 1
retry (Regra de Ouro 7 — duas tentativas iguais que falham = aceita
com desvio registrado, não vira loop). **Importante:** a chamada de
retry roda no PRÓPRIO try/catch, isolado do try da 1ª chamada — se o
retry falhar (ex.: provider caiu entre a 1ª e a 2ª chamada), a 1ª
resposta (válida, só incompleta) é mantida, nunca descartada. Bug real
corrigido nesta mesma sessão: a versão inicial tinha os dois no mesmo
try, e uma falha só no retry derrubava o passo inteiro por engano
(achado pelo `fiscal-agent` antes de ir pro commit).

**Resultado real medido:** de 2 agentes com desvio de formato, 1
corrigiu 100% no retry, o outro melhorou (5→2 campos faltando) mas não
fechou — aceito como limite real do modelo, não bug.

**Quando reusar:** qualquer geração estruturada (JSON, campos
obrigatórios, contrato de API) atrás de um modelo cuja aderência a
instrução não é garantida.

## 4. Truncagem cabeça+cauda pra exibição (preserva o arquivo completo)

Import de `github.com/LoFi-Monk/lofi-gate`: `runtime/src/truncar-saida.js`
corta o meio de uma saída grande (>2000 chars) só na IMPRESSÃO em
terminal — o arquivo de log/transcript sempre recebe o texto completo.
Nunca aplicar em fluxo sem arquivo de log por trás (`cli.js` foi
deixado de fora de propósito, é chat interativo sem transcript em
disco). Medido com payload real 10x maior: economia escala de 30,6%
(3K chars) pra 95,8% (50K chars), porque o teto de exibição é fixo.
