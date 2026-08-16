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
2. O que quebrou → post-mortem **e** regra nova no agente responsável.
3. Decisão revogada na prática → linha nova em `docs/decisoes.md`.

Entrega fechada sem esse passo é entrega que não ensinou nada ao
sistema — e o próximo projeto repete o mesmo erro.

## Lembrar / esquecer / nunca guardar
**Lembrar:** decisões aprovadas, preferências visuais, stack definida,
regras anti-genérico, erros recorrentes e sua correção.

**Esquecer:** sugestões rejeitadas, código de implementações antigas,
detalhes de projetos encerrados, tentativas falhas que não geraram
aprendizado.

**Nunca guardar:** dado pessoal sensível, dado de menor de 18 anos,
credencial ou token, informação médica ou financeira. Vale para o log
também — ver `rules/security.md`.
