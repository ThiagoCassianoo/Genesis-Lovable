# Regras de memória e conhecimento

Lido sob demanda: ao fechar entrega, ao registrar decisão, ou quando um
agente precisar saber o que já foi feito.

## Três camadas, propósitos diferentes

| Camada | Arquivo | O que guarda | Vida |
|---|---|---|---|
| **Decisão** | `docs/decisoes.md` | O que foi decidido, por quem, por quê | Permanente, append-only |
| **Conhecimento** | `docs/conhecimento/` | O que já foi construído e funcionou | Permanente, evolui |
| **Estado** | O arquivo de plano do projeto | O que está em execução agora | Descartável ao fim |

Confundir as três é o erro comum: estado virando permanente incha o
contexto, e decisão vivendo só no chat some quando a sessão acaba.

## `docs/decisoes.md` — append-only
**Nunca reescrever linha antiga.** Mudou de ideia? Linha nova revogando
a anterior, com o motivo. O histórico de por que algo mudou vale mais
que o estado final limpo.

Se uma decisão não está aqui, para uma sessão nova **ela não foi
tomada**. Não vale "a gente combinou no chat".

## `docs/conhecimento/` — busque antes de criar
**Regra dura:** nenhum agente cria do zero antes de procurar aqui.

1. `grep -ri "<termo do domínio>" docs/conhecimento/`
2. Ler o índice.
3. Achou → declarar na saída **de onde partiu** e **o que adaptou**.
4. Não achou → dizer "nada no banco". Isso é sinal de que a entrega
   atual deve virar entrada nova.

**Entra aqui:** arquitetura que sobreviveu a entrega real; efeito
visual aprovado com nota alta; bug de produção + correção + a checagem
que impede ele de voltar; objeção de cliente que se repetiu + a
resposta que funcionou.

**Não entra:** ideia nunca executada (é hipótese, não conhecimento);
código de projeto encerrado sem lição extraída; qualquer dado pessoal
de cliente, credencial ou informação sensível.

## Ciclo de fechamento (obrigatório, não é boa intenção)
Nenhuma entrega é dada como concluída sem:
1. O que funcionou → entrada em `docs/conhecimento/`.
2. O que quebrou → post-mortem **e** a regra nova **proposta** em
   `docs/decisoes.md`, marcada `[a aplicar pelo diretor]`, dizendo
   exatamente qual arquivo de agente e qual seção mudariam.
3. Decisão revogada na prática → linha nova em `docs/decisoes.md`.

**Por que "proposta" e não "aplicada" (corrigido 2026-08-17).** A
redação anterior era *"regra nova no agente responsável"* — e a
auditoria de arquitetura provou que isso era **impossível de cumprir**:
nenhum dos 16 agentes pode escrever em `.claude/agents/`. O
`docs-agent` é explicitamente barrado (*"Proibido, sem exceção:
qualquer coisa em `src/`, `.claude/agents/`, `.claude/rules/`"*), o
`implementation-agent` só toca `src/`, e os outros 14 são só-leitura.
Como o `fiscal-agent` cobrava esse item como gate, ele reprovava
**permanentemente** todo fechamento que tivesse tido qualquer falha —
uma trava que nenhum trabalho bem-feito conseguia destravar.

Duas saídas eram possíveis: dar ao `docs-agent` permissão de reescrever
contratos de agente, ou mudar a regra. Escolhida a segunda, por dois
motivos: (1) mudar o contrato de um agente é decisão de arquitetura, e
`agent-contracts.md` já diz que **nenhum agente aprova o próprio
resultado** — um agente reescrevendo o contrato de outro é a mesma
falha de separação; (2) dar escrita em `.claude/agents/` ao `docs-agent`
abriria caminho pro sistema se auto-modificar sem o diretor ver, que é
o oposto do modelo "audito no final".

**O que o `fiscal-agent` checa agora:** existe a proposta registrada,
com arquivo e seção nomeados? Se sim, o fechamento passa. A aplicação
é do diretor — e é rápida, porque a proposta já vem escrita.

Entrega fechada sem esse passo é entrega que não ensinou nada ao
sistema — e o próximo projeto repete o mesmo erro.

## Faixa comercial — fora do escopo do time, por decisão (2026-08-17)
Preço da Missões Tech, proposta comercial e contrato **não têm agente
dono, e isso é deliberado**. A auditoria apontou como "lacuna", mas
criar um 17º agente falharia o critério 1 de contratação
(`agent-contracts.md`): o trabalho não existe em volume — não há
cliente pago ainda — e o dado que ele precisaria (custo-hora, margem
alvo, ticket) só o diretor tem, e está registrado como pendente em
`docs/decisoes.md` desde 2026-08-15.

Onde isso aparece no fluxo, o agente **devolve a pergunta ao diretor
com recomendação**, e segue com o que não depende dela (é a regra
"nunca supor em silêncio, nunca travar"):
- `infra-agent` — janela de suporte e mensalidade de manutenção.
- `backend-master` — condição 4 da aprovação de stack (contrato com
  janela explícita antes do deploy).

Revisar quando: existir o primeiro cliente pago e o ticket estiver
registrado. Aí o volume justifica, e o critério 1 passa.

## Lembrar / esquecer / nunca guardar
**Lembrar:** decisões aprovadas, preferências visuais, stack definida,
regras anti-genérico, erros recorrentes e sua correção.

**Esquecer:** sugestões rejeitadas, código de implementações antigas,
detalhes de projetos encerrados, tentativas falhas que não geraram
aprendizado.

**Nunca guardar:** dado pessoal sensível, dado de menor de 18 anos,
credencial ou token, informação médica ou financeira. Vale para o log
também — ver `rules/security.md`.
