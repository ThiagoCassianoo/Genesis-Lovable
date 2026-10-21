function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/**
 * Data de hoje no fuso do aparelho, formato YYYY-MM-DD.
 * Não usa toISOString(): às 23:30 em UTC-3 ele já devolveria o dia seguinte.
 */
export function hojeLocal(agora: Date = new Date()): string {
  return `${agora.getFullYear()}-${pad2(agora.getMonth() + 1)}-${pad2(agora.getDate())}`;
}

/** Verifica se a string é uma data de calendário real no formato YYYY-MM-DD. */
export function isDataIsoValida(valor: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valor);
  if (!m) return false;
  const ano = Number(m[1]);
  const mes = Number(m[2]);
  const dia = Number(m[3]);
  const d = new Date(ano, mes - 1, dia);
  return d.getFullYear() === ano && d.getMonth() === mes - 1 && d.getDate() === dia;
}

/** '2026-10-21' → '21/10/2026'. */
export function formatarDataBr(iso: string): string {
  const [ano, mes, dia] = iso.split('-');
  return `${dia}/${mes}/${ano}`;
}
