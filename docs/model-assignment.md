# Model assignment — por que cada agente está no tier que está

**Fonte da verdade é o frontmatter de cada agente**, não este arquivo.
Todo `.claude/agents/*.md` declara dois campos:
- `model: opus | sonnet` — tier no Claude, condição normal.
- `model_fallback: capaz | economico` — tier no fallback (Gemini,
  via `runtime/`), condição degradada (tokens do Claude acabaram).

Se este documento e o frontmatter algum dia divergirem, **o
frontmatter manda** — ele é lido pelo Claude Code e pelo `runtime/`
de verdade; este arquivo só existe pra explicar o critério, e existe
o risco real de ficar desatualizado se um agente mudar de tier depois.

## O critério: compliance-bound vs. judgment-bound

Não é "importante vs. não importante" — todo agente que existe é
importante, senão seria cortado (critério 1 de contratação em
`agent-contracts.md`). O critério real é **onde instrução detalhada
consegue substituir capacidade do modelo, e onde não consegue**.

**Compliance-bound** (checklist, formato fixo, comparação contra regra
escrita) — instrução rígida fecha a maior parte do gap entre modelo
caro e barato, porque a tarefa é "seguir a régua", não "inventar a
régua". Modelo econômico é aceitável aqui.

**Judgment-bound** (interpretar ambiguidade, decidir estratégia, notar
o que **não** foi escrito explicitamente como regra) — nenhuma
instrução fecha esse gap, porque a tarefa é justamente lidar com o que
a régua não previu. Precisa de modelo capaz, mesmo em fallback.

Teste rápido pra classificar um agente novo: **"se eu escrevesse um
checklist perfeito, um estagiário sem contexto conseguiria fazer o
trabalho só seguindo o checklist?"** Se sim, compliance-bound
(econômico). Se a resposta certa muda de caso pra caso e exige
interpretar contexto que não está no checklist, judgment-bound
(capaz).

## Tabela (derivada do frontmatter em 2026-08-16 — pode ficar desatualizada, confira lá)

| Tier | Agentes | Por quê |
|---|---|---|
| **capaz** | `navigator-agent`, `business-agent`, `creative-agent`, `backend-master`, `marketing-master`, `technical-agent`, `security-agent`, `fiscal-agent`, `conselho-otimista`, `conselho-advogado-diabo`, `conselho-analista-neutro` | Interpretar entrada ambígua, decidir estratégia/arquitetura, ou notar o que não estava previsto (auditoria, segurança). |
| **econômico** | `implementation-agent`, `qa-agent`, `reviewer-agent`, `docs-agent`, `infra-agent` | Seguir brief/checklist/template já definido por outro agente antes. |

## Onde este documento diverge do que Thiago propôs em 2026-08-16

Thiago sugeriu `fiscal-agent` e `implementation-agent` no tier
econômico. Mantive `fiscal-agent` em **capaz** — é o único agente cujo
trabalho é pegar o que não foi escrito como regra ainda (genérico
novo, alucinação nova); checklist rígido só pega o que já está na
lista. "Fiscal que passa a mão vira carimbo" é frase do próprio
`fiscal-agent.md`, não minha invenção — um fiscal fraco não audita
pior, audita com confiança falsa, que é o cenário que o próprio agente
existe pra evitar.

`implementation-agent` foi pro econômico como Thiago propôs — mas com
compensação: em modo degradado, toda saída dele passa por `fiscal-agent`
(que continua capaz) antes de qualquer coisa ser considerada pronta.
Ver `docs/fiscal-protocolo-degradado.md`.

Dois agentes que Thiago não mencionou e eu classifiquei: `marketing-master`
e `technical-agent` foram pra **capaz** (jornada de consultoria e
decisão de arquitetura são julgamento real, não checklist) e
`infra-agent` foi pro **econômico** (checklist de deploy/custo é mais
mecânico). `security-agent` ficou em **capaz**, mantendo a lógica que
já existia hoje pro tier normal (`model: opus`).

## Quando revisar este critério
- Um agente muda de escopo o suficiente pra trocar de natureza
  (compliance→judgment ou o inverso).
- Uso real no `runtime/` mostrar que um agente "econômico" está
  produzindo saída ruim mesmo com o contrato rígido — sinal de que a
  tarefa era judgment-bound e eu classifiquei errado.
- Thiago decidir diferente — é premissa minha, não regra travada.
