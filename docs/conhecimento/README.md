# Banco de conhecimento — busque antes de criar

**Regra dura:** nenhum agente cria do zero antes de procurar aqui. Se
existe caso parecido, o trabalho é **partir dele e adaptar ao contexto
real**, não recomeçar. Recomeçar é caro e reintroduz bug já resolvido.

## Como buscar (obrigatório, antes de recomendar)
1. `grep -ri "<termo do domínio>" docs/conhecimento/` — domínio,
   biblioteca, tipo de cliente.
2. Ler o índice abaixo.
3. Se achou: declare na sua saída **de onde partiu** e **o que adaptou**.
4. Se não achou: diga "nada no banco" — isso vira sinal de que a
   entrega atual deve virar entrada nova aqui.

## Índice

### Arquitetura
| Arquivo | Domínio | Reutilizável para |
|---|---|---|
| `../arquitetura-agendamento.md` | Agendamento de espaços/eventos (igreja) | Qualquer sistema com reserva de recurso e conflito de horário: salão, sala, quadra, equipamento, consulta |

### Referência de design (meta-sistema)
| Arquivo | Domínio | Reutilizável para |
|---|---|---|
| `./principios-natureza-orquestrador.md` | Princípios de sistemas distribuídos/natureza vs. arquitetura real do orquestrador | Qualquer proposta futura de "deixar o sistema mais resiliente/autônomo" — confere aqui antes de reavaliar do zero |

### Padrões visuais
`../patterns/` — efeito 3D/scroll/microinteração que funcionou, com a
biblioteca usada, o princípio de psicologia aplicado e onde reusar.

### Pós-entrega (post-mortem)
`./post-mortem/` — o que quebrou, por que quebrou, e a regra que
nasceu disso. Vazio até a primeira entrega real.

## O que entra aqui
- Arquitetura que sobreviveu a uma entrega real.
- Efeito visual aprovado com nota alta pelo `reviewer-agent`.
- Bug que apareceu em produção + a correção + a checagem que impede
  ele de voltar (vira item fixo no `qa-agent`).
- Objeção de cliente que se repetiu + a resposta que funcionou.

## O que NÃO entra
- Ideia que nunca foi executada (é hipótese, não conhecimento).
- Código de projeto encerrado sem lição extraída.
- Qualquer dado pessoal de cliente, credencial ou informação sensível.

## Ciclo de feedback (obrigatório, não é boa intenção)
Ao fechar qualquer entrega, o orquestrador executa — antes de
considerar o projeto concluído:
1. O que funcionou e vale catalogar? → vira entrada aqui.
2. O que quebrou? → vira post-mortem **e** regra nova no agente
   responsável.
3. Alguma decisão foi revogada na prática? → linha nova em
   `docs/decisoes.md`.

Entrega fechada sem esse passo é entrega que não ensinou nada ao
sistema — e o próximo projeto vai repetir o mesmo erro.
