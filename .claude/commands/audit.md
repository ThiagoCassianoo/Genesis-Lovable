---
description: Cadeia de auditoria da etapa 5 — qa, security, reviewer e fiscal, nesta ordem
---

Execute a etapa 5 do fluxo (`.claude/rules/orchestration.md`). Todos
são somente leitura: reportam, nunca corrigem.

Acione **nesta ordem**, parando se algum devolver `escalate`:

1. **`qa-agent`** — funciona? Fluxo completo, caso de borda, dado
   inválido, regressão, permissão. Só em entrega de sistema/SaaS.
2. **`security-agent`** — obrigatório se houver login, pagamento, dado
   pessoal ou integração externa. Nunca opcional nesses casos.
3. **`reviewer-agent`** — padrão visual e conversão: checklist geral,
   por biblioteca, performance numérica, mobile, psicologia, SEO,
   sistema de design e estados de interface.
4. **`fiscal-agent`** — sempre, e por último: a entrega cumpre a
   documentação? Sobrou genérico, pela metade, sem evidência, fora de
   contrato? O ciclo de fechamento foi executado?

Cada um devolve `pass`, `revise` ou `escalate`. A entrega só sai com
`pass` de todos os aplicáveis. `escalate` sobe pro diretor **com a
recomendação do agente**, nunca como pergunta seca.
