// Truncagem cabeça+cauda pra exibição no terminal — padrão importado
// de github.com/LoFi-Monk/lofi-gate (2026-08-26): mantém o diagnóstico
// inicial e a conclusão final, descarta o meio verboso.
//
// REGRA DE OURO: isto é SÓ pra tela. Nunca aplicar no que vai pro
// arquivo de transcript/log — perder evidência de auditoria seria o
// mesmo erro que a Regra 6 do CLAUDE.md existe pra evitar (autoridade
// zero de conteúdo não vira "descarte silencioso" de conteúdo real).
// Quem chama isto continua gravando o texto ORIGINAL em disco; só troca
// o que é impresso.
const LIMITE_CHARS = 2000;
const METADE = 1000;

export function truncarParaExibicao(texto) {
  const s = String(texto ?? "");
  if (s.length <= LIMITE_CHARS) return s;
  const cabeca = s.slice(0, METADE);
  const cauda = s.slice(-METADE);
  const cortados = s.length - 2 * METADE;
  return `${cabeca}\n... [${cortados} caracteres omitidos na tela — arquivo de log tem o texto completo] ...\n${cauda}`;
}
