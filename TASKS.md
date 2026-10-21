# TASKS — lugar único de prioridade

Regra: ideia nova entra em **Depois** e só sobe se algo de **Agora** fechar.
Mudou prioridade? Muda aqui primeiro, com data.

## Agora (máx. 3)
- [ ] **Case-Study** — notebooks 01 e 02 executados com saída real, números no README, push. (iniciado 2026-10-21 — fecha sozinho, treino rodando)
- [ ] **Instagram da Missões Tech** — plano em `docs/clientes/missoes-tech/brief.md`. Passos do diretor: (1) fechar preço/termos das 3 vagas-piloto; (2) criar o @ (conferir disponibilidade); (3) publicar posts 1, 2 e 6; (4) contar conversas "Vim pelo Instagram" por 30 dias. (iniciado 2026-10-21)
- [ ] **Validar o café com gente real** — mostrar `projetos/cafe-teste` a 3-5 produtores antes de qualquer v2 (`business-agent`).

## Próximo
- [ ] Landing da própria Missões Tech (vitrine da Landing de Contato) — só depois do preço do piloto.
- [ ] Decidir regra de produto do café — atividade real em talhão de exemplo é apagada junto no "Remover exemplos". Preservar ou mover? (rebaixado de "Agora" em 2026-10-21 pra abrir vaga pro Instagram)
- [ ] Merge da branch `claude/elegant-volta-l8ubca` em `main` (decisão do diretor).
- [ ] Na máquina Windows: `git config core.hooksPath .githooks`; conferir status line (`jq`); `/mcp`; apagar `runtime/web/UsersLenovo...js` se existir.

## Depois (congelado até "Agora" esvaziar)
- Botão único / Agent SDK headless no painel.
- Orquestração automática dos 16 agentes no `runtime/`.
- Busca local no painel vs. aprofundar Parte 4.
- Hook de filtro de output verboso.
- Café v2: editar/apagar atividade; quantidade na colheita; favicon.

## Concluído
- 2026-10-21 — Teste café ponta a ponta (navigator → business → technical → plano → implementation → fiscal `pass` → docs), esqueleto em `projetos/cafe-teste/`.
- 2026-10-21 — Exceção alto-ticket ratificada pra MVP de sistema/SaaS (`CLAUDE.md` § Stack).
- 2026-10-21 — Hook `guard-env-example-secret.sh` aplicado (proposta de 2026-08-26).
- 2026-10-21 — `docs/RETOMADA.md` atualizado; bit +x dos hooks restaurado; self-test verde (188/0).
