# Post-mortem

Formato por arquivo: `AAAA-MM-DD-nome-curto.md` com: o que quebrou,
por que, quanto tempo levou pra detectar, a correção, e **a regra nova
que impede voltar** — proposta em `docs/decisoes.md` com o marcador
`[a aplicar pelo diretor]`, nomeando arquivo e seção (nenhum agente
escreve direto em `.claude/agents/` ou `.claude/hooks/`).

## Entradas
| Arquivo | O que quebrou |
|---|---|
| `2026-08-26-chave-real-em-env-example.md` | Chave real de API colada em `.env.example` (tracked) em vez de `.env` (gitignored), 2x na mesma sessão |
