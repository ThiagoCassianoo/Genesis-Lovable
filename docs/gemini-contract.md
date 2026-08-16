# Gemini contract — o que muda quando o agente roda em Gemini, não Claude

**Status: HIPÓTESE, não FATO.** Nada aqui foi validado rodando de
verdade contra os agentes desta fábrica — esta sessão não tem chave de
API pra testar. É o ponto de partida pra quando Thiago rodar o
`runtime/` de verdade no terminal dele; depois de um teste real, cada
item abaixo deveria virar FATO (confirmado) ou ser corrigido/apagado.
Tratar isso como verdade sem testar seria exatamente o tipo de
alucinação técnica que `fiscal-agent` item 1b existe pra pegar.

## O que não muda
- O **conteúdo** do agente (system prompt, contrato, formato de saída)
  é o mesmo — `runtime/src/agent-loader.js` lê o mesmo `.md`, não
  existe uma segunda versão do prompt pra Gemini.
- O objetivo (FATO/HIPÓTESE/PREMISSA, nunca travar, formato fixo) não
  é negociável por provider — se Gemini não conseguir seguir isso de
  forma confiável, o achado correto é "este agente precisa de mais
  instrução explícita" ou "este agente devia ser capaz, não
  econômico", não "relaxar a regra pro Gemini".

## Hipóteses a validar (fonte: conhecimento geral sobre diferença de
comportamento entre famílias de modelo — **não testado nesta fábrica
ainda**)
1. **Formato de saída pode precisar de reforço extra.** Alguns modelos
   seguem menos rigidamente instrução de "sempre este formato, sem
   variação" sem repetição/exemplo. Se um agente em Gemini começar a
   fugir do formato fixo, primeiro teste é adicionar um exemplo
   preenchido no próprio `.md`, não reescrever o contrato.
2. **Instrução negativa ("não faça X") pode ter menos efeito que
   instrução positiva ("faça Y").** Se um agente alucinar ou ficar
   genérico em Gemini mesmo com a regra escrita, tentar reformular a
   regra como o que fazer, não só o que evitar, antes de concluir que
   o modelo "não dá conta".
3. **Contexto mais longo (histórico de conversa extenso) pode degradar
   adesão ao contrato mais rápido que no Claude.** Se isso acontecer,
   o `runtime/` precisaria resumir/truncar histórico — não existe essa
   lógica no v0 ainda.
4. **Alucinação técnica (fiscal-agent 1b) pode ser mais frequente em
   Gemini pra tarefas de código.** Reforça por que `implementation-agent`
   em modo degradado precisa de fiscalização extra — ver
   `docs/fiscal-protocolo-degradado.md`.

## Como validar (quando Thiago rodar de verdade)
Rodar o mesmo agente (`navigator-agent`, por exemplo) com o mesmo
input em `--order=claude` e depois `--order=gemini`, comparar as duas
saídas lado a lado. Perguntas concretas:
- O formato de saída ficou idêntico?
- FATO/HIPÓTESE/PREMISSA foram rotulados do mesmo jeito?
- Alguma informação foi inventada que não estava no input nem é
  inferência razoável?

O resultado desse teste vira entrada em `docs/conhecimento/` (achado
real, com evidência) — não fica só nesta lista de hipóteses.

## O que fazer se um agente falhar sistematicamente em Gemini
Não é "reescrever o agente pra Gemini" — o mesmo `.md` tem que
funcionar nos dois. É: (1) reforçar a instrução (exemplo, repetição,
formato mais explícito) igual pra ambos os providers, porque isso
também melhora o Claude; ou (2) se depois de reforçar ainda falhar só
em Gemini, esse agente talvez devesse ser `capaz` mesmo no fallback,
mesmo que hoje esteja `economico` — atualizar o frontmatter e registrar
o motivo em `docs/decisoes.md`.
