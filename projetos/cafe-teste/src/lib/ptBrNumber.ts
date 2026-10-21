/**
 * Converte número digitado em pt-BR ("1,5") ou com ponto ("1.5").
 * Não aceita separador de milhar — área de talhão raramente passa de 3 dígitos,
 * e "1.500" seria ambíguo (1,5 ou mil e quinhentos).
 * Retorna null quando o texto não é um número.
 */
export function parseNumeroPtBr(texto: string): number | null {
  const limpo = texto.trim();
  if (!/^\d+([.,]\d+)?$/.test(limpo)) return null;
  const n = Number(limpo.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

const formatadorArea = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 });

export function formatarArea(areaHa: number): string {
  return `${formatadorArea.format(areaHa)} ha`;
}
