# Custos — setor de economia (limites reais por provider e critério de ordem)

**Status: dados pesquisados em 2026-08-16, não testados de verdade
contra este `runtime/` ainda** (mesma ressalva de `docs/gemini-contract.md`
— vira FATO depois que Thiago rodar com chave real e confirmar). Fonte:
documentação oficial de cada provider + comparativo de mercado, ver
rodapé.

## Por que essa ordem no `router.js` (`claude → groq → cerebras → gemini`)

O critério é **quem trava por último**, não "quem é melhor modelo".
Um provider free só serve de backup se ele aguentar volume de agente
trabalhando o dia inteiro — não é uso humano esporádico.

| Ordem | Provider | RPM | RPD / teto diário | Cartão exigido | Por que essa posição |
|---|---|---|---|---|---|
| 1 | **Claude** (Anthropic) | — | limite de conta/plano | — | Condição normal — melhor qualidade, é o cérebro. |
| 2 | **Groq** | 30 | até 14,4K req/dia (varia por modelo) | Não | Free mais robusto do mercado — RPD alto o bastante pra não travar num dia normal de agentes. |
| 3 | **Cerebras** | 30 | ~1M tokens/dia | Não | Teto por token (não por request) — segundo backup, sobra fôlego se Groq abrir circuito. |
| 4 | **Gemini** (Google AI Studio) | 5-15 | 20-1.500 (varia MUITO por modelo) | Não | Fica por último: em alguns modelos o RPD é baixíssimo (20/dia) — trava rápido se virar primeira opção. |

## Providers pesquisados e NÃO integrados ainda (candidatos futuros)

| Provider | RPM / teto | Observação | Por que não entrou nesta rodada |
|---|---|---|---|
| NVIDIA NIM | Alto, sem trava rígida divulgada | Exige conta NVIDIA Developer | Falta confirmar processo de chave — próxima rodada se Thiago topar. |
| GitHub Models | 15 RPM / 150-1.000 RPD | Dá acesso a GPT-4o-mini e até Claude 3.5 de graça (via Azure) | Redundante com Claude direto — mais útil como *outro* jeito de acessar Claude/GPT que como 3º backup independente. |
| OpenRouter (pool free) | 20 RPM / **50 RPD** | Unifica 20+ modelos num endpoint só | RPD de 50/dia é baixo demais pra agente rodando o dia todo — zera em poucas horas, não é boa 1ª nem 2ª opção de fallback. |
| DeepSeek direto | créditos de marketing, expiram | R1/V3, boa qualidade | É crédito temporário, não free tier permanente — não dá pra depender como base do sistema, viraria trava surpresa quando expirar. |
| "Grok" (xAI) | — | Confirmado: **não tem free tier de API** hoje, só via assinatura X Premium | Descartado — não é grátis, apesar do nome parecido com Groq. |

## Como pegar cada chave (grátis, sem cartão)

- **Groq**: https://console.groq.com/keys
- **Cerebras**: https://cloud.cerebras.ai
- **Gemini**: https://aistudio.google.com/apikey

Cola cada chave em `runtime/.env` (nunca commitar — já está no
`.gitignore`). Ver `runtime/.env.example` pros nomes exatos de
variável.

## O que o painel ainda não faz (v0 — sem persistência de custo real)

Hoje o `router.js` só decide **ordem** e abre/fecha circuito por
falha — ele não soma quantos tokens/requests cada provider gastou.
Contagem de uso real (pra saber quando um provider free está perto do
teto ANTES de travar, não só depois) é próxima etapa, não construída
nesta rodada — registrar como pendência se Thiago quiser esse nível.

## Quando revisar este documento

- Depois do primeiro teste real com chave (vira FATO ou é corrigido).
- Se algum provider mudar limite (eles mudam sem aviso) — atualiza
  aqui primeiro, ordem do `router.js` depois, nunca ao contrário.
- Se Thiago decidir integrar NVIDIA NIM ou outro da lista de
  candidatos — atualiza esta tabela E `runtime/src/providers/`
  E `router.js` juntos, mesmo padrão dos 4 já integrados.

## Fontes da pesquisa (2026-08-16)
- OpenRouter Blog — "Free LLM API in 2026: 13 Options Ranked and Compared"
- Groq — documentação oficial de rate limits (console.groq.com/docs/rate-limits)
