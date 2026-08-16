# Protocolo do fiscal em modo degradado

Isto **não** substitui `.claude/agents/fiscal-agent.md` — as 6
fiscalizações (Genérico, Alucinação técnica, Pela metade, Sem
evidência, Fora de contrato, Roteamento, Promessa, Fechamento)
continuam valendo integralmente, provider nenhum muda isso. Este
documento cobre só o que é **específico de rodar fora do tier normal**
— via `runtime/`, em fallback (Claude sem token) ou em Gemini.

## Quando isso se aplica
Qualquer saída de agente que foi gerada com `model_fallback: economico`
(hoje: `implementation-agent`, `qa-agent`, `reviewer-agent`, `docs-agent`,
`infra-agent` — ver `docs/model-assignment.md`) **e** rodou de fato em
modo degradado (não no Claude Code normal).

## Regra extra: dois vereditos, não um
Em modo degradado, `fiscal-agent` sempre roda no tier **capaz** (nunca
degrada — ver `docs/model-assignment.md`, é o motivo dele divergir do
pedido inicial do Thiago). Ele audita a saída econômica com o mesmo
rigor de sempre, mas o relatório ganha um campo a mais:

```
Rodou em modo degradado: [sim | não]
Se sim — tier econômico teve mais achado que a média histórica: [sim/não, com número se houver histórico]
```

Isso não muda o veredito (`pass`/`revise`/`escalate` continuam vindo
das 6 fiscalizações normais) — é sinal pro diretor: se o tier
econômico está gerando mais achado que o normal, é hora de reclassificar
aquele agente pra `capaz` no fallback, não insistir no barato.

## Regra extra: `implementation-agent` degradado não commita sozinho
Isso já era verdade no Claude Code (hook `guard-red-lines.sh` bloqueia
commit sem aprovação) — mas o `runtime/` **não tem esse hook**. Em modo
degradado, nenhuma saída de `implementation-agent` vira commit sem: (1)
`fiscal-agent` (capaz) ter auditado essa saída específica, (2) o
diretor ter aprovado manualmente. O `runtime/README.md` já avisa que a
disciplina de aprovação não existe automaticamente lá fora — isto aqui
é a instância concreta dessa regra pro caso mais arriscado (código).

## Regra extra: acúmulo de achado vira gatilho de reclassificação
Critério objetivo, não impressão: se um agente `economico` acumular
achado de `fiscal-agent` em **3 rodadas seguidas** rodando em modo
degradado, ele deixa de ser `economico` nesse fallback — o diretor é
avisado e o frontmatter é atualizado pra `model_fallback: capaz`,
registrado em `docs/decisoes.md`. Três tentativas iguais que falham já
é o padrão de "para e escala" do resto do sistema
(`agent-contracts.md` item 4); aqui é a mesma lógica aplicada a tier de
modelo, não a uma tarefa específica.
