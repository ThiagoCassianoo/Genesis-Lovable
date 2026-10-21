export interface AvisoNavegacaoState {
  aviso?: string;
}

export function lerAviso(state: unknown): string | undefined {
  if (state && typeof state === 'object' && 'aviso' in state) {
    const { aviso } = state as AvisoNavegacaoState;
    return typeof aviso === 'string' ? aviso : undefined;
  }
  return undefined;
}
