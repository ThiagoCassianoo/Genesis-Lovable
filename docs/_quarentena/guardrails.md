# Guardrails — as 5 camadas e onde cada uma vive

## Por que NÃO usamos NeMo Guardrails
NeMo é biblioteca **Python em runtime**: exige Python 3.10+, config em
Colang, credencial de LLM, e roda entre o código da aplicação e o
modelo. Nós não temos código Python chamando API — temos Claude Code
lendo arquivo de configuração. Adotar NeMo exigiria um proxy Python na
frente do Claude Code, que não é como ele funciona.

Mesma decisão que tomamos com ECC, superpowers e LangChain: **o
conceito serve, o framework não**. A taxonomia de 5 rails do NeMo é
excelente e está implementada abaixo com os mecanismos nativos do
Claude Code.

## As 5 camadas

### 1. Input rails — o que entra
**Implementado:** contrato de entrada em cada um dos 13 agentes.
Declara o que ele precisa receber, o que deve ler antes
(`docs/decisoes.md` + `docs/conhecimento/`), e o que fazer quando
falta — perguntar com recomendação padrão, nunca supor nem travar.
**Verificação:** `docs/testes-agentes.md`, caso fixo por agente.

### 2. Dialog rails — o que pode acontecer em cada momento
**Implementado:** os gates do `docs/workflow.md` (nada avança sem
aprovação), o roteamento por linha de produto no `CLAUDE.md`, e as
arestas do `docs/grafo-agentes.md` (quem fala com quem, e o que é
proibido).
**Verificação:** aresta não listada no grafo é violação.

### 3. Retrieval rails — o que pode ser reaproveitado
**Implementado:** `docs/conhecimento/README.md` define o que entra, o
que não entra (ideia nunca executada, dado pessoal, credencial) e
obriga a busca antes de criar. Decisão revogada em `decisoes.md` fica
marcada como revogada, não some — o agente precisa enxergar que
mudou.
**Verificação:** saída que não declara "de onde partiu / o que
adaptou" quando existia caso no banco é reprovação.

### 4. Execution rails — o que a ferramenta pode fazer
**Implementado em código, não em confiança:**
- `.claude/hooks/guard-red-lines.sh` (PreToolUse/Bash) bloqueia com
  exit 2: instalar dependência, `rm`, `git push`, `git commit`,
  `git reset --hard`.
- Allowlist `tools` no frontmatter: dos 13 agentes, só o
  `implementation-agent` tem Write/Edit. Os outros **não conseguem**
  editar arquivo — não é regra que eles lembram, é permissão que não
  têm.
**Verificação:** rodar `npm install lodash` deve bloquear. Ver
`docs/testes-agentes.md`.

### 5. Output rails — o que sai
**Implementado:** formato de saída fixo em todos os 13, sem variação.
Mais as proibições transversais: zero dado inventado (`[a preencher
pelo diretor]`), zero recomendação sem ter lido, zero risco sem sinal
de alerta, zero projeção sem premissa aberta.
**Verificação:** teste de conformidade, 13 de 13.

## A camada que o NeMo não tem e nós precisamos
**Decisão sem árbitro.** `docs/prioridades.md` — função de utilidade
que resolve conflito entre agentes sem passar pelo diretor, com
desempate em cascata e, quando o empate é real, pergunta estratégica
com recomendação padrão em vez de travar.
