import type { EstadoArmazenado } from '@/lib/schemas';
import { hojeLocal } from '@/lib/dates';

export const PREFIXO_EXEMPLO = '[EXEMPLO]';

function diasAtras(agora: Date, dias: number): string {
  const d = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - dias);
  return hojeLocal(d);
}

/**
 * Dados fictícios exibidos só no primeiro uso, pra tela não nascer vazia.
 * Todos marcados ficticio: true, com prefixo no nome e removíveis com 1 toque.
 */
export function criarExemplos(agora: Date, uuid: () => string): EstadoArmazenado {
  const criadoEm = agora.toISOString();
  const t1 = uuid();
  const t2 = uuid();
  return {
    schemaVersion: 1,
    talhoes: [
      {
        id: t1,
        nome: `${PREFIXO_EXEMPLO} Talhão da Baixada`,
        areaHa: 2.5,
        variedade: 'Catuaí Vermelho',
        ficticio: true,
        criadoEm,
      },
      {
        id: t2,
        nome: `${PREFIXO_EXEMPLO} Talhão do Alto`,
        areaHa: 1.8,
        variedade: 'Mundo Novo',
        ficticio: true,
        criadoEm,
      },
    ],
    atividades: [
      {
        id: uuid(),
        talhaoId: t1,
        data: diasAtras(agora, 3),
        tipo: 'Adubação',
        nota: 'Exemplo de anotação: adubação de cobertura.',
        ficticio: true,
        criadoEm,
      },
      {
        id: uuid(),
        talhaoId: t1,
        data: diasAtras(agora, 10),
        tipo: 'Monitoramento (praga/doença)',
        nota: '',
        ficticio: true,
        criadoEm,
      },
    ],
  };
}
