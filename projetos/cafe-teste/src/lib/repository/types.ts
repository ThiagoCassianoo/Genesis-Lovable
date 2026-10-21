import type { TipoAtividade } from '@/data/tiposAtividade';
import type { Atividade, Talhao } from '@/lib/schemas';

export interface NovoTalhaoInput {
  nome: string;
  areaHa: number;
  variedade: string;
}

export interface NovaAtividadeInput {
  talhaoId: string;
  data: string;
  tipo: TipoAtividade;
  nota: string;
}

/**
 * Contrato trocável: hoje localStorage, amanhã Supabase.
 * Tudo async de propósito, pra UI já tratar carregando/erro.
 */
export interface Repository {
  listTalhoes(): Promise<Talhao[]>;
  getTalhao(id: string): Promise<Talhao | null>;
  createTalhao(input: NovoTalhaoInput): Promise<Talhao>;
  listAtividades(talhaoId: string): Promise<Atividade[]>;
  createAtividade(input: NovaAtividadeInput): Promise<Atividade>;
  /** Remove talhões e atividades marcados como fictícios. */
  removerExemplos(): Promise<void>;
  /** Apaga tudo deste aparelho e começa vazio (saída do estado corrompido). */
  recomecar(): Promise<void>;
}

export type RepositoryErrorCode = 'CORROMPIDO' | 'ESCRITA' | 'NAO_ENCONTRADO';

export class RepositoryError extends Error {
  readonly code: RepositoryErrorCode;

  constructor(code: RepositoryErrorCode, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'RepositoryError';
    this.code = code;
  }
}

export function isRepositoryError(e: unknown): e is RepositoryError {
  return e instanceof RepositoryError;
}
