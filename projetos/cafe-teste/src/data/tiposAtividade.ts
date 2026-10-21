export const TIPOS_ATIVIDADE = [
  'Adubação',
  'Aplicação (defensivo)',
  'Poda',
  'Capina/Roçada',
  'Irrigação',
  'Colheita',
  'Monitoramento (praga/doença)',
  'Outro',
] as const;

export type TipoAtividade = (typeof TIPOS_ATIVIDADE)[number];
