import { SCHEMA_VERSION, STORAGE_KEY } from '@/data/config';
import { criarExemplos } from '@/data/seedExemplos';
import { estadoArmazenadoSchema, type Atividade, type EstadoArmazenado } from '@/lib/schemas';
import {
  RepositoryError,
  type NovaAtividadeInput,
  type NovoTalhaoInput,
  type Repository,
} from './types';

export interface LocalStorageRepositoryOptions {
  storage?: Storage;
  key?: string;
  agora?: () => Date;
  uuid?: () => string;
  /** Semeia exemplos fictícios quando a chave ainda não existe (1º uso). */
  semearExemplos?: boolean;
}

function estadoVazio(): EstadoArmazenado {
  return { schemaVersion: SCHEMA_VERSION, talhoes: [], atividades: [] };
}

/** data desc, depois criadoEm desc; empate total → o inserido por último primeiro. */
export function ordenarAtividades(atividades: Atividade[]): Atividade[] {
  return atividades
    .map((a, i) => ({ a, i }))
    .sort((x, y) => {
      if (x.a.data !== y.a.data) return x.a.data < y.a.data ? 1 : -1;
      if (x.a.criadoEm !== y.a.criadoEm) return x.a.criadoEm < y.a.criadoEm ? 1 : -1;
      return y.i - x.i;
    })
    .map(({ a }) => a);
}

export function createLocalStorageRepository(
  options: LocalStorageRepositoryOptions = {},
): Repository {
  const storage = options.storage ?? globalThis.localStorage;
  const key = options.key ?? STORAGE_KEY;
  const agora = options.agora ?? (() => new Date());
  const uuid = options.uuid ?? (() => crypto.randomUUID());
  const semear = options.semearExemplos ?? true;

  function escrever(estado: EstadoArmazenado): void {
    try {
      storage.setItem(key, JSON.stringify(estado));
    } catch (cause) {
      throw new RepositoryError(
        'ESCRITA',
        'Não foi possível salvar neste aparelho (armazenamento cheio ou bloqueado).',
        { cause },
      );
    }
  }

  function ler(): EstadoArmazenado {
    const bruto = storage.getItem(key);
    if (bruto === null) {
      const inicial = semear ? criarExemplos(agora(), uuid) : estadoVazio();
      escrever(inicial);
      return inicial;
    }
    let json: unknown;
    try {
      json = JSON.parse(bruto);
    } catch (cause) {
      throw new RepositoryError('CORROMPIDO', 'Os dados salvos estão ilegíveis.', { cause });
    }
    const resultado = estadoArmazenadoSchema.safeParse(json);
    if (!resultado.success) {
      throw new RepositoryError('CORROMPIDO', 'Os dados salvos estão em formato inesperado.', {
        cause: resultado.error,
      });
    }
    return resultado.data;
  }

  return {
    async listTalhoes() {
      return [...ler().talhoes].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
    },

    async getTalhao(id) {
      return ler().talhoes.find((t) => t.id === id) ?? null;
    },

    async createTalhao(input: NovoTalhaoInput) {
      const estado = ler();
      const talhao = {
        id: uuid(),
        nome: input.nome.trim(),
        areaHa: input.areaHa,
        variedade: input.variedade.trim(),
        ficticio: false,
        criadoEm: agora().toISOString(),
      };
      escrever({ ...estado, talhoes: [...estado.talhoes, talhao] });
      return talhao;
    },

    async listAtividades(talhaoId) {
      return ordenarAtividades(ler().atividades.filter((a) => a.talhaoId === talhaoId));
    },

    async createAtividade(input: NovaAtividadeInput) {
      const estado = ler();
      if (!estado.talhoes.some((t) => t.id === input.talhaoId)) {
        throw new RepositoryError('NAO_ENCONTRADO', 'Talhão não encontrado.');
      }
      const atividade: Atividade = {
        id: uuid(),
        talhaoId: input.talhaoId,
        data: input.data,
        tipo: input.tipo,
        nota: input.nota.trim(),
        ficticio: false,
        criadoEm: agora().toISOString(),
      };
      escrever({ ...estado, atividades: [...estado.atividades, atividade] });
      return atividade;
    },

    async removerExemplos() {
      const estado = ler();
      const idsFicticios = new Set(estado.talhoes.filter((t) => t.ficticio).map((t) => t.id));
      escrever({
        ...estado,
        talhoes: estado.talhoes.filter((t) => !t.ficticio),
        atividades: estado.atividades.filter((a) => !a.ficticio && !idsFicticios.has(a.talhaoId)),
      });
    },

    async recomecar() {
      escrever(estadoVazio());
    },
  };
}
