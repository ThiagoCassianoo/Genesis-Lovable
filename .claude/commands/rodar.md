---
description: Roda o pedido cru do diretor pelo fluxo inteiro (Etapas 1-6) sem pausar entre etapas — só entra na conversa em bloqueio real
argument-hint: [pedido cru do cliente/projeto]
---

Pedido: $ARGUMENTS

Execute as Etapas 1-6 de `.claude/rules/orchestration.md` em sequência,
**sem pedir confirmação entre etapas ou entre agentes** (regra vigente
desde 2026-08-16 — audita no final, não passo a passo). Você
(orquestrador) só aparece pro diretor em 4 situações, nunca por rotina:

1. Uma das 5 ações de `guard-red-lines.sh` foi atingida: instalar
   dependência, apagar arquivo, produção/deploy — pede `/aprovar`;
   commit — exige marcador do `fiscal-agent` e sai só do terminal do
   diretor, nunca do seu Bash; descartar trabalho não-commitado —
   **bloqueio duro, sem desbloqueio automático**, não insista.
2. Um agente devolveu veredito `escalate` — sobe com recomendação
   própria, nunca como pergunta seca.
3. Faltou input que nenhuma PREMISSA segura resolve — devolve a
   pergunta estratégica + o que ela muda + sua recomendação padrão, e
   continua com o que não depende dela.
4. Etapa 5 (Auditoria) e Etapa 6 (Fechamento) terminaram — reporte
   final.

Passos:
1. `navigator-agent` (Etapa 1) monta o brief a partir do pedido cru —
   uma pergunta objetiva de cada vez, PREMISSA quando faltar resposta.
   `docs-agent` grava o brief em `docs/clientes/<nome>/brief.md` antes
   de seguir — sem isso a Etapa 5/6 audita contra nada.
2. Aplique o checklist binário da Etapa 1b (reversível? afeta todo
   projeto futuro? dado real/financeiro/produção?). 2+ "sim" ou pedido
   explícito do diretor → convoque `conselho-otimista`,
   `conselho-advogado-diabo`, `conselho-analista-neutro` em paralelo
   antes de seguir.
3. Registre o entendimento em 3-5 frases no log de delegação e acione
   direto os especialistas recomendados (Etapa 2) — sem esperar
   "confirmo" do diretor.
4. `swarm-planner` gera o plano (Etapa 3).
5. `parallel-task` executa as ondas (Etapa 4) — só para nas 5 ações
   irreversíveis.
6. Cadeia de auditoria (Etapa 5), pela linha de produto certa
   (`orchestration.md` § Roteamento): `qa-agent` (se houver
   formulário/integração) → `security-agent` (se houver
   login/pagamento/dado pessoal) → `reviewer-agent` → `infra-agent`
   (obrigatório antes do 1º deploy) → `fiscal-agent`.
7. `docs-agent` fecha (Etapa 6): conhecimento, post-mortem se algo
   quebrou, decisão revogada se houve.

Toda vez que acordar um agente (passos 1, 3, 6, 7), registre a linha
do "Registro de delegação": agente · objetivo · contexto enviado ·
output esperado · motivo da escolha — é o que sustenta a auditoria de
roteamento na Etapa 5/6.

Relatório final pro diretor: **máximo 10 linhas**. O que foi entregue,
o que ficou bloqueado (com a pergunta exata), veredito de cada portão
de auditoria. Sem narrar processo — só resultado.
