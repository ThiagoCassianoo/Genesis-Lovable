# Arquitetura repo 1 / repo 2

**Status: PROPOSTA — Thiago sinalizou "quero ajustar" sobre esta
estrutura em 2026-08-16 mas ainda não detalhou o ajuste. O que está
aqui é minha recomendação, tratada como PREMISSA (assumida porque a
pergunta ainda não foi respondida): se cair, os pontos marcados abaixo
caem junto. Não é decisão fechada até ele confirmar — registrar em
`docs/decisoes.md` só depois disso.**

## Observação (o que existe hoje)
- Repo 1 (`missoes-tech-agentes`, este) — os 16 agentes, regras, hooks,
  comandos, e agora `runtime/` (scaffold multi-modelo). Zero cliente
  real ainda.
- Repo 2 — não existe nenhum ainda. Nenhum cliente passou pelo fluxo
  completo até implementação.

## Orientação (as perguntas que decidem a estrutura)

**1. Um cliente pode precisar de mais de um entregável?**
Sim, estruturalmente — site institucional agora, sistema de gestão
depois, ou dois sistemas separados pra públicos diferentes. Cada
entregável desses tem domínio próprio, hospedagem própria, ciclo de
deploy próprio. Colocar os dois no mesmo repo forçaria deploy conjunto
de coisas que evoluem em velocidades diferentes — viola a separação
que já existe até entre `.claude/rules/` (como opera) e `docs/`
(o que sabe): coisas com motivo de mudança diferente não deveriam
morar juntas.

**2. Onde fica o histórico/memória — por repo 2, ou centralizado?**
Centralizado no repo 1. Se cada repo 2 guardasse sua própria
`docs/decisoes.md`, o aprendizado de um cliente nunca chegaria no
próximo — exatamente o problema que `docs/conhecimento/` já existe pra
resolver hoje, só que num nível (dentro de um projeto). Precisa existir
no nível acima (entre projetos).

**3. Banco de dados no repo 1 — precisa agora?**
Não, pelo critério YAGNI que já rege o resto do sistema. Com zero a
poucos clientes, arquivo markdown versionado em git **é** o banco:
buscável por `grep`/pelos próprios agentes (`Read`, `Grep`, `Glob` já
são as ferramentas de leitura de todo agente), com histórico de mudança
de graça (git log), sem infra pra manter. Gatilho explícito pra migrar
pra banco de verdade (Supabase, já tem MCP configurado neste ambiente):
quando o número de clientes tornar busca manual difícil (dezenas+) ou
quando for preciso consulta relacional (“quais clientes usam feature
X”, “quantos projetos fecharam esse mês”) — algo que markdown não
responde bem. Até esse gatilho disparar, arquivo.

## Decisão (recomendação, PREMISSA até Thiago confirmar)

**Repo 1 — estrutura:**
```
missoes-tech-agentes/
  .claude/                    motor: agentes, regras, hooks, comandos
  runtime/                    scaffold multi-modelo (Claude + Gemini)
  docs/
    clientes/
      <nome-do-cliente>/
        brief.md               saída do navigator-agent (Etapa 1)
        manifest.md             repo(s) 2 associados — nome, propósito, link, status
        decisoes-locais.md      decisão específica deste cliente (se houver;
                                 decisão que vira padrão pra todo cliente
                                 continua em docs/decisoes.md, não aqui)
    conhecimento/                lição cross-cliente (já existe)
    decisoes.md                  decisão de arquitetura da fábrica (já existe)
```

**Repo 2 — um por entregável deployável** (não necessariamente um por
cliente — um cliente com 2 entregáveis tem 2 repo 2, listados no mesmo
`manifest.md`). Nasce assim:
1. Cópia do pacote de agentes (`.claude/`) — igual o `README.md` já
   descreve hoje (`cp -r missoes-tech-agentes/.claude ...`). Mantém o
   mesmo time de agentes disponível pra manutenção/evolução depois do
   lançamento, sem depender do repo 1 pra tudo.
2. `brief.md` copiado do repo 1 pra dentro do repo 2 (ponto de partida
   documentado — `business-agent` e os outros especialistas partem
   dele, não do zero).
3. Stack real conforme `CLAUDE.md` (React/TS/Vite/Tailwind...).

**Ao fechar (Etapa 6 — Fechamento):**
- Lição que sobreviveu → `docs/conhecimento/` do repo 1 (via
  `docs-agent`, cruzando a fronteira de volta).
- `manifest.md` do cliente, no repo 1, atualizado com status
  (lançado, pausado, encerrado) e link do repo 2.

## O que muda no zip agora
Nada de estrutura obrigatória — não crio `docs/clientes/` vazio hoje,
porque não existe cliente ainda (criar pasta sem conteúdo é o mesmo
erro genérico que o `fiscal-agent` reprova em código: estrutura sem
função). A convenção acima entra em uso na primeira vez que `/intake`
rodar de verdade — o `docs-agent` cria `docs/clientes/<nome>/` naquele
momento, não antes.

## O que fica em aberto pra Thiago
Confirmar (ou corrigir) os 3 pontos da seção "Orientação" acima. Até
lá, este documento é a base de trabalho, não a palavra final.
