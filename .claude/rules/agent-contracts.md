# Contratos de agente — padrão, classificação e critério de contratação

Lido sob demanda: ao escrever agente novo, ao revisar um existente, ou
quando o `fiscal-agent` reprovar por contrato.

## O contrato padrão (v1.0)
Todo agente declara, no próprio arquivo:

| Campo | Onde vive | Obrigatório |
|---|---|---|
| Identidade e fronteira | Corpo, 1º parágrafo | Sim |
| Quando acionar / quando NÃO | `description` do frontmatter | Sim |
| Ferramentas | `tools` (allowlist) | Sim |
| Modelo | `model` | Sim |
| O que ler antes de opinar | `## Contrato de entrada vX` | Sim |
| Inputs obrigatórios | `## Contrato de entrada vX` | Sim |
| O que fazer se faltar input | `## Contrato de entrada vX` | Sim |
| Formato de saída | `## Formato de saída` | Sim |
| Versão do contrato | No título da seção (`v1.0`) | Sim |

## Regras não negociáveis de qualquer agente
1. **Nunca recomendar sem ter lido.** `docs/decisoes.md` (o que já foi
   decidido) e `docs/conhecimento/` (o que já foi feito) antes de
   qualquer recomendação. Se existe caso parecido, **partir dele e
   adaptar** — declarando de onde partiu e o que adaptou. Recomeçar do
   zero é caro e reintroduz bug já resolvido.
2. **Nunca supor em silêncio, nunca travar.** Faltou input: devolver a
   pergunta estratégica (uma, no máximo duas), o que a resposta muda na
   prática, a recomendação padrão caso ninguém responda, e seguir com a
   parte que não depende dela.
3. **Zero dado inventado.** Sem dado real: `[a preencher pelo diretor]`.
   Vale também pra técnico: nome de pacote, método de API, versão de
   modelo, comando de instalação — se você não buscou/executou **nesta
   sessão**, não escreva como se fosse certo. "Lembro que é assim"
   sobre algo que muda com frequência é o padrão de alucinação mais
   perigoso, porque soa exato. `fiscal-agent` bloqueia isso como
   categoria própria (ALUCINAÇÃO TÉCNICA, `fiscal-agent.md` item 1b).
4. **Condição de parada.** Duas tentativas iguais que falham = para e
   escala. Ação irreversível não tem retry automático.
5. **`can_edit_files: false`** por padrão — três exceções, e só três:
   - `implementation-agent` — código em `src/`.
   - `docs-agent` — documentação, escopo restrito no item 6.
   - `fiscal-agent` — **`Write` apenas para gravar
     `.claude/logs/fiscal-<task_id>.json`**, o marcador de auditoria
     que `.githooks/pre-commit` exige pra liberar commit.
     *(Exceção regularizada em 2026-08-17: o `fiscal-agent.md` já
     dizia "você tem Write só pra isso — exceção documentada em
     agent-contracts.md", mas a exceção nunca esteve escrita aqui E o
     `Write` não estava no frontmatter dele. Resultado: nenhum agente
     conseguia produzir o marcador, e o gate de commit era
     matematicamente inatingível. Diferente das outras duas, esta
     exceção **não tem trava mecânica** — `guard-docs-agent-scope.sh`
     só cobre o `docs-agent`. É contrato de texto; o risco está
     registrado em `docs/decisoes.md`.)*

   Nos dois primeiros casos não é regra que o agente lembra: é
   permissão que ele não tem.
6. **`docs-agent`: escrita permitida apenas em path matching `docs/*` e
   `.claude/logs/*`; tentativa de escrita fora disso = exit code 2 +
   log.** Imposto por `.claude/hooks/guard-docs-agent-scope.sh`, não por
   texto no contrato — mesmo padrão do `guard-red-lines.sh` pra
   red lines.
7. **Nenhum agente aprova o próprio resultado** em tarefa de alto
   impacto.

## Critério de contratação (agente novo)
Falhar em qualquer um é corte automático.
1. **Preenche lacuna real** — responsabilidade sem dono hoje.
2. **Não sobrepõe titular** — nenhum dos existentes faz "quase a mesma
   coisa".
3. **Formato de saída compacto e fixo** — sem isso quebra a economia.
4. **Não fere linha vermelha** — não instala dependência, não apaga
   arquivo, não toca produção, não inventa dado.
5. **Sem permissão de escrita**, salvo exceção explícita do diretor.
6. **Custo-benefício de contexto** — máx. 2 contratações por rodada sem
   justificar por quê passou disso.

## Classificação por tipo dominante
Analítica. Nenhum agente é alterado pra caber numa categoria — híbrido
que funciona continua híbrido.

| Agente | Tipo dominante | Híbrido com |
|---|---|---|
| Orquestrador (não é agente) | Hierárquico | Orientado a utilidade |
| `navigator-agent` | Reflexivo baseado em modelo | Orientado a utilidade |
| `business-agent` | Orientado a objetivo | Reflexivo baseado em modelo |
| `creative-agent` | Ferramenta especializada | Orientado a utilidade |
| `technical-agent` | Orientado a utilidade | — |
| `backend-master` | Hierárquico | Orientado a utilidade |
| `marketing-master` | Hierárquico | Orientado a objetivo |
| `infra-agent` | Orientado a utilidade | Revisor |
| `security-agent` | Revisor | — |
| `qa-agent` | Revisor | Ferramenta especializada |
| `reviewer-agent` | Revisor | — |
| `fiscal-agent` | Revisor (meta) | — |
| `implementation-agent` | Ferramenta especializada | — |
| `conselho-*` (3) | Orientado a utilidade | — |

**Lacuna consciente:** não existe agente de aprendizagem como nó do
grafo. O aprendizado vive no fechamento (`docs/conhecimento/`),
operado pelo orquestrador. Um nó que só "aprende" não entrega nada. Se
o banco crescer a ponto da busca manual falhar, aí vira lacuna real.

## Política de descarte
1. Procurar referência, dependência, chamada indireta, menção em doc e
   uso em teste (`grep -rn` no repositório inteiro).
2. **Não remover na mesma passada em que diagnosticou.** Marcar como
   deprecated ou mover pra `docs/_quarentena/`.
3. Remoção definitiva só depois de uma rodada sem ninguém sentir falta.
4. Registrar em `docs/decisoes.md`: o que saiu, por quê, o que ficou no
   lugar.

Exceção única: duplicação literal comprovada de arquivo que continua
íntegro em outro lugar — e ainda assim, registrando.
