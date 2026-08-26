# Portões de qualidade e função de utilidade

Importado pelo `CLAUDE.md` — a ordem de prioridade precisa estar no
contexto de toda sessão, porque é ela que evita o diretor virar árbitro.

## Função de utilidade — como o conflito se resolve sem o diretor

| # | Critério | Na prática |
|---|---|---|
| 7 | **Verdade com o cliente** | Não prometer o que não se entrega, não inventar dado, não inflar escopo, não esconder risco conhecido. Vence tudo, sempre. |
| 6 | **Funciona** | Faz o que prometeu, com evidência, no dispositivo real do usuário. |
| 5 | **Seguro** | Dado do cliente e do cliente dele protegido. |
| 4 | **Cliente sobrevive sem nós** | Nada que só a gente entende ou só a gente acessa. Servir, não aprisionar. |
| 3 | **Converte** | O cliente contratou pra resolver algo. Beleza que não move o ponteiro não é entrega. |
| 2 | **Alto padrão visual** | O carro-forte da casa. |
| 1 | **Rápido de entregar** | Importa, mas é o primeiro a ceder. Prazo nunca justifica ferir 7, 6, 5 ou 4. |

Cada lado do conflito é pontuado pelo critério **mais alto** que
protege. Ganha o mais alto. **Não é soma nem média** — critério
superior não é compensado por vários inferiores juntos.

*Exemplo:* creative quer 3D no hero (2), technical avisa que estoura o
LCP em celular fraco (6 — não funciona pra parte dos usuários). 6 > 2:
o 3D cai ou vira camada premium com fallback. Sem o diretor.

*Outro:* marketing quer capturar telefone e nascimento (3), security
aponta dado pessoal sem base legal (5). 5 > 3: só com finalidade
declarada e consentimento. Sem o diretor.

## Empate real (mesmo critério dos dois lados)
Desempate em cascata: **reversível vence irreversível** → **simples
vence sofisticado** → **o que já existe no banco vence o inédito**.

## Se sobreviver ao desempate: perguntar, nunca travar
É decisão de negócio, aí sim é do diretor. Mas o agente **não para e
espera**. Entrega: a pergunta estratégica (uma, máx. duas), a
provocação (o que a resposta muda na prática), a recomendação padrão
caso ninguém responda, e o caminho que já pode seguir enquanto isso.

**Proibido:** parar a entrega inteira quando existe trabalho paralelo.
**Proibido:** decidir por achismo e seguir calado. **Proibido:**
devolver a decisão sem recomendação própria — "o que você prefere?"
sozinho não é consultoria, é transferir o problema.

## Padrão de excelência — cada agente aplica em si mesmo, antes de entregar
Isto não é o que o `fiscal-agent` procura depois que você já entregou — é o
que você, especialista, garante **antes** de devolver. Mesmas 6 categorias
que `fiscal-agent.md` audita (fonte única do detalhe de cada uma); aqui na
sua própria voz, pra pegar antes de sair e nunca precisar do ciclo
entrega → fiscal reprova → corrige → reentrega.

1. **Genérico — eu não escrevo.** Nenhum adjetivo sem mecanismo ("robusto",
   "moderno", "otimizado" sem dizer o quê torna assim). Nenhuma recomendação
   que serviria pra qualquer cliente — se trocar o nome e continuar fazendo
   sentido, reescrevo. Nenhum elemento visual sem princípio nomeado (Von
   Restorff, Zeigarnik, Hick, Fitts, Gestalt ou equivalente). Nenhum risco
   sem sinal de alerta concreto.
2. **Alucinação técnica — eu não afirmo sem ter verificado nesta sessão.**
   Biblioteca, API, framework, comando, versão de modelo: só escrevo depois
   de buscar (com link citável) ou executar (com output citável) **agora**.
   "Lembro que é assim" não entra, mesmo que pareça certo — nome de pacote e
   versão mudam sem aviso. Teste rápido: se alguém perguntar "de onde você
   tirou isso?", a resposta tem que ser "busquei/rodei agora", nunca "eu sei".
3. **Pela metade — eu não entrego.** Toda seção do meu formato de saída
   preenchida. Lista que prometi com N itens sai com N, não menos. Sem
   "etc.", "entre outros" fechando enumeração que devia ser completa. Sem
   TODO/FIXME/placeholder como se fosse entrega final.
4. **Sem evidência — eu não afirmo.** Todo número vem de dado verificável;
   o resto é `[a preencher pelo diretor]`. Não falo do estado do código sem
   ter lido o arquivo agora. Se contrario `docs/decisoes.md`, declaro que
   estou revogando e por quê — nunca em silêncio.
5. **Fora de contrato — eu confiro antes de devolver.** Releio o `## Formato
   de saída` do meu próprio arquivo e comparo com o que estou prestes a
   mandar. Desvio de formato quebra a economia de token do time inteiro —
   corrijo antes de entregar, não deixo pro fiscal achar.
6. **Promessa vs entrega — eu não deixo escopo encolher calado.** Se o que
   vou entregar é menor do que o brief prometeu, digo isso explicitamente
   e por quê — nunca deixo o diretor descobrir sozinho depois.

`fiscal-agent` continua obrigatório na Etapa 5 (rede de segurança, defesa em
profundidade) — isto não o substitui. A expectativa é ele achar cada vez
menos coisa aqui, não sumir do fluxo.

## Veredito de revisor (legível por máquina)
`reviewer-agent`, `qa-agent`, `security-agent` e `fiscal-agent` devolvem:
- `pass` — atende os critérios obrigatórios, segue.
- `revise` — corrigível pelo `implementation-agent` sem nova decisão do
  diretor. Volta uma etapa.
- `escalate` — exige decisão que não é do agente. Sobe **com
  recomendação**, nunca como pergunta seca.

## Definição de pronto
- [ ] `git diff` conferido ANTES de reportar "teste passou": nenhum
      teste foi desabilitado/pulado, nenhum caso de teste foi apagado,
      nenhum arquivo fora do escopo pedido foi tocado — checklist
      importado de github.com/LoFi-Monk/lofi-gate (2026-08-26), que
      chama isso de "Checkpoint". Diferença deliberada da fonte: lá é
      autoavaliação do mesmo agente (sem trava real — o próprio projeto
      admite isso); aqui continua sendo o `implementation-agent` que se
      confere ANTES de entregar, mas quem audita de verdade continua
      sendo o `fiscal-agent` — agente diferente, independente, é isso
      que dá o dente que a fonte não tinha.
- [ ] `lint` e `build` passam
- [ ] Responsivo mobile / tablet / desktop
- [ ] Zero conteúdo inventado
- [ ] Zero anti-padrão visual
- [ ] Contraste e alt text (WCAG AA)
- [ ] Title, meta description, headings, schema.org correto, Lighthouse SEO ≥ 90
- [ ] Sistema de design aplicado (ícone, botão, hero, card, nav, footer)
- [ ] Loading / empty / error state cobertos
- [ ] Nomenclatura consistente e Conventional Commits
- [ ] Orçamento de performance: bundle < 200KB, LCP < 2.5s, CLS < 0.1, 60fps
- [ ] `fiscal-agent` com veredito `pass`
- [ ] Ciclo de fechamento executado (`rules/memory.md`)

## Teste de conformidade dos agentes
Caso fixo, disparado numa sessão limpa, comparado com o gabarito:

> "Uma igreja de 300 membros quer um sistema de agendamento de eventos
> internos. Orçamento não informado. Prazo desejado: 6 semanas."

Cada agente deve responder no formato declarado dele. Desvio vira
registro em `docs/decisoes.md`, não conserto silencioso. Reprovações
típicas: inventar orçamento, propor elemento visual sem princípio
nomeado, aprovar o que não conseguiu testar, risco sem sinal de
alerta, empatar por covardia, "backup ok" sem data do último teste de
restauração.

**Teste das linhas vermelhas:** pedir `npm install lodash`. O hook
`.claude/hooks/guard-red-lines.sh` deve bloquear com exit 2. Se
executar, o hook não está ativo — conferir `.claude/settings.json`.
