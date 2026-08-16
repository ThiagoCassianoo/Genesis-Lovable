# Escopo do projeto + Análise de gaps — Missões Tech
2026-08-16 · Modos ativados: TRUTHMODE + Redteam · Fechamento: Retro (SSC)

## 1. Escopo real (o que o projeto É, hoje)

**Missões Tech** é uma consultoria de tecnologia cristã: entrega site,
landing page, marketing digital e sistemas/SaaS pra igrejas,
ministérios e empreendedores. Diretor decide tudo. Missão declarada:
Mateus 6:33 — servir primeiro, vender depois.

O que existe **de fato, com evidência**:
- **A fábrica de agentes** (`missoes-tech-agentes`, GitHub, commit
  `75f71a6`): 14 subagentes Claude Code, 5 regras, 9 comandos, 2 hooks
  mecânicos (red lines + observabilidade sanitizada), skills de
  planejamento (`swarm-planner`, `parallel-task`).
- **Um molde de arquitetura** pronto: `docs/arquitetura-agendamento.md`
  (978 linhas, SQL real) — sistema de agendamento de espaços de igreja
  com RLS, migration, teste negativo.
- **Uma decisão de stack recomendada e não aprovada**: Supabase,
  instância por cliente, pagamento fora do v1 — Conselho deliberou,
  5 condições registradas, **aguardando "aprovado" há 2 dias**.

O que **não existe ainda, apesar de soar como se existisse**:
- Nenhum cliente real. Nenhum site entregue. Nenhum projeto além da
  própria fábrica.
- Nenhum dado de quantos clientes pediram sistema nos próximos 12
  meses, nem ticket médio — o próprio Conselho registrou essa lacuna.
- Nenhum agente de economia/token — 13 dos 14 agentes são só leitura,
  ninguém mede consumo real.

## 2. TRUTHMODE — o que é sólido vs. o que é aparência

**Sólido de verdade:** a disciplina de processo. Gate de aprovação
mecânico (hook bloqueia commit/push/rm/install sem "aprovado"), log
sanitizado por padrão, política de descarte (quarentena antes de
apagar), registro de decisão append-only. Isso é raro — a maioria dos
sistemas de agente promete isso em prompt e quebra na primeira pressa.
Aqui está em código, não em boa vontade.

**Aparência que precisa de teste real:** 14 agentes com frontmatter
perfeito não é a mesma coisa que 14 agentes que produzem valor
comprovado. Nenhum rodou numa tarefa de cliente de verdade ainda — só
a auto-referência da própria fábrica e uma deliberação do Conselho.
O guia de provocações que você trouxe aponta exatamente isso: "o
sistema é realmente multiagente ou é um agente principal com prompts
diferentes?" — pergunta que a fábrica ainda não respondeu com
evidência, só com estrutura.

**Risco que ninguém disse em voz alta:** você está otimizando a
fábrica (agentes, regras, hooks) há dias sem ter testado num cliente
real. Isso é o padrão clássico de "construir a ferramenta perfeita
antes de usar a ferramenta" — o próprio guia de provocações chama isso
de prematuro quando não há evidência de necessidade.

## 3. Redteam — onde isso quebra

1. **Stack de backend travada há 2 dias.** `backend-master` não pode
   modelar nada. Todo projeto de sistema/SaaS está bloqueado até você
   digitar "aprovado" numa linha do `decisoes.md`. Ninguém está te
   cobrando isso — é o tipo de trava que fica invisível até o primeiro
   cliente pedir prazo.
2. **Ticket e custo mensal por cliente também travado.** `infra-agent`
   não fecha margem sem isso. Você pode entregar um sistema e só
   descobrir depois que a manutenção custa mais do que cobrou.
3. **Zero dado de demanda real.** 14 agentes prontos pra atender um
   cliente que ainda não apareceu. Se isso não converter em cliente
   pago nos próximos 30-60 dias, o tempo virou manutenção de fábrica,
   não de negócio.
4. **Agente de economia inexistente.** Você identificou isso na
   conversa mas ainda não decidiu criar. Sem ele, cada sessão nova
   reaprende consumo do zero — o problema que o guia de provocações
   descreve como "orquestrador que não sabe quando parar".
5. **9Router parado no meio.** Instalação começou, parou pra essa
   análise. Se ficar parado por muito tempo, quando o limite bater de
   verdade você não vai ter fallback pronto — vai estar exatamente na
   situação que motivou a ideia.
6. **Você (Thiago) é o único ponto de aprovação de tudo.** Correto pela
   regra de ouro, mas é também o gargalo real do sistema — nenhuma
   decisão avança sem você, e você tá dividido entre 3 frentes agora
   (fábrica, 9Router, essa análise).

## 4. Retro — Start / Stop / Continue

**Start (começar):**
- Aprovar ou rejeitar a stack Supabase — é a decisão de maior
  alavancagem parada no sistema hoje.
- Definir o dado que falta: quantos clientes reais nos próximos 12
  meses, a que ticket — sem isso, tudo é fábrica sem destino.

**Stop (parar):**
- Parar de expandir a fábrica (novo agente, nova regra, novo hook)
  antes do primeiro cliente real passar pelo fluxo inteiro uma vez.
- Parar de tratar o 9Router e a fábrica como a mesma prioridade —
  são frentes diferentes, uma é ferramenta pessoal, outra é o negócio.

**Continue:**
- Gate de aprovação mecânico, log sanitizado, política de descarte —
  está funcionando, não mexer.
- Retomar sessão via `/retomar` + `docs/RETOMADA.md` — resolveu o
  problema de continuidade de verdade.

## 5. Pergunta que fecha (regra do próprio sistema)

*Se você não aprovar a stack esta semana, qual problema concreto
continua existindo? Como você vai medir que aprovar resolveu isso?
Existe uma decisão menor que destrava o mesmo tanto de trabalho?*

Resposta honesta: sem aprovar, `backend-master` fica parado e nenhum
projeto de sistema sai do papel — mas um site institucional simples
(sem backend) já poderia rodar hoje, sem essa decisão. Se você tem um
cliente de site na fila, isso destrava trabalho sem esperar a decisão
de stack.
