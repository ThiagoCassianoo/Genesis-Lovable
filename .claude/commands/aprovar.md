---
description: Grava o marcador que destrava, por uma única vez, um comando exato bloqueado pelo guard-red-lines.sh (install/rm/deploy) depois de aprovação explícita do diretor
---

Use quando o diretor aprovar, no chat, uma ação que o `guard-red-lines.sh`
bloqueou — instalar dependência, apagar arquivo, deploy/produção.
**Não use pra commit** — commit tem gate próprio (marcador do
`fiscal-agent`, já existente, não mexe aqui).

1. Confirme o comando **exato** que foi bloqueado — copie literal da
   mensagem de erro do hook, não parafraseie. O marcador é por hash do
   comando exato: um espaço ou aspa diferente gera hash diferente e o
   marcador não destrava nada.
2. Grave o marcador:
   ```bash
   CMD='<comando exato aprovado, literal>'
   HASH=$(printf '%s' "$CMD" | sha256sum | awk '{print $1}')
   mkdir -p .claude/logs
   cat > ".claude/logs/aprovacao-${HASH:0:12}.json" <<EOF
   {
     "command": "$CMD",
     "command_hash": "$HASH",
     "approved_by": "Thiago",
     "approved_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
     "approved_epoch": $(date -u +%s)
   }
   EOF
   ```
3. Avise o agente que estava bloqueado pra tentar de novo o **mesmo
   comando, literal**.
4. Marcador é de uso único — o hook apaga sozinho ao consumir.
   Validade: 15 minutos. Depois disso, trata como se não tivesse
   aprovação (peça de novo).
5. Se o diretor aprovou um comando **parecido mas não idêntico** ao que
   o agente vai realmente rodar (ex.: versão diferente do pacote),
   grave o marcador com o comando que **vai rodar de verdade**, não o
   que foi discutido em texto — o hash tem que bater com o que o
   agente vai executar.
