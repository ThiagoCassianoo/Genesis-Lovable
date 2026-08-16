# Fluxo de orquestração — gate de aprovação

Este é o fluxo obrigatório definido no `CLAUDE.md`. Nenhuma etapa
avança sem aprovação explícita do diretor na etapa anterior. O
orquestrador (Claude Code rodando neste projeto) segue isso sozinho,
sem precisar que você repita a regra a cada conversa.

## As 8 etapas

### 1. Intake & Confirmação
Orquestrador faz no máximo 8 perguntas objetivas sobre a tarefa em
questão (uma seção do site, uma campanha, uma feature, um sistema).
Sem código, sem agentes acionados ainda. Depois de reunir as respostas,
**reafirma o entendimento em 3-5 frases** ("entendi que você quer X,
pro público Y, com objetivo Z — confirma?") antes de montar a tabela
de delegação (qual agente entra, o que cada um recebe como task).

**Gate:** aguardar confirmação explícita do diretor — tanto das
respostas quanto do playback de entendimento.

### 1b. Conselho (só em decisão de peso)
Se a decisão é cara de desfazer (stack, arquitetura, escopo com
cliente, preço, nova linha de produto) ou o diretor pediu, o
orquestrador vira **Mestre do Conselho** e aciona os 3 conselheiros em
paralelo, cada um sem ver a resposta do outro: `conselho-otimista`,
`conselho-advogado-diabo`, `conselho-analista-neutro`.

Depois sintetiza em 4 blocos: onde os 3 convergiram (isso é sinal
forte), onde divergiram de verdade (e por quê), qual premissa precisa
ser verificada antes de seguir, e 1 recomendação.

**Gate:** o Conselho recomenda, o diretor decide. Deliberação nunca
vira execução automática.

Pular esta etapa em tarefa rotineira é o comportamento correto —
3 conselheiros custam 3 contextos.

### 2. Análise dos especialistas
Orquestrador aciona os agentes relevantes (`business-agent`,
`creative-agent`, `technical-agent` — conforme a tarefa, nem sempre os
três). Todos leem o contexto e devolvem o formato fixo de saída
(diagnóstico + insights + riscos + recomendação). Nenhum edita nada.

**Gate:** sem edição de arquivos nesta etapa, sob nenhuma circunstância.

### 3. Consolidação
Orquestrador remove repetições entre as análises, identifica conflitos
entre especialistas (ex.: creative quer uma coisa, technical avisa que
custa performance) e prioriza.

**Gate:** sem edição de arquivos.

### 4. Recomendação
Orquestrador apresenta UMA recomendação principal + UMA alternativa,
com justificativa e riscos — não uma lista de 5 opções.

**Gate:** aguardar aprovação explícita do diretor antes de prosseguir.

### 5. Pacote de implementação
Orquestrador gera os documentos necessários (briefing, direção
criativa, plano técnico, roadmap de etapas, critérios de aceite).
Zero código.

**Gate:** sem código, somente documentos.

### 6. Implementação
`implementation-agent` executa **uma etapa do roadmap por vez**. Antes
de cada etapa: lista arquivos que vai tocar. Depois de cada etapa:
confirma o que foi feito, roda lint/build, reporta problemas.

**Gate:** aprovação do diretor para CADA etapa individual — não para o
roadmap inteiro de uma vez.

### 7. Auditoria
`reviewer-agent` audita a etapa entregue usando o checklist de 15
itens, sem modificar nada.

**Gate:** ajustes finais só com aprovação do diretor.

### 8. Repetir 6-7 até o roadmap terminar
Cada etapa seguinte do roadmap passa de novo pelos passos 6 e 7.

## Exemplo de bom uso

> Diretor: "Cria o site da Missões Tech agora, sem perguntas."
>
> Orquestrador: "Antes de gerar qualquer código, preciso confirmar 3
> pontos essenciais para não desperdiçar sua direção:
> 1. Qual ação principal o visitante deve realizar no site?
> 2. Divulgação orgânica ou com anúncios pagos?
> 3. Já existe identidade visual definida ou construímos agora?"

## Exemplo de mau uso (o que NÃO fazer)

> Diretor: "Cria o site da Missões Tech agora, sem perguntas."
>
> Orquestrador: "Claro! Vou criar um site incrível com gradiente
> roxo, hero centralizado e animações..."
>
> **Errado:** ignorou o gate de discovery e caiu em anti-padrão visual
> proibido no primeiro parágrafo.
