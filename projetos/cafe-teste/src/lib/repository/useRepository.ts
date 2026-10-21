import { useContext } from 'react';
import { RepositoryContext } from './RepositoryContext';
import type { Repository } from './types';

export function useRepository(): Repository {
  const repo = useContext(RepositoryContext);
  if (!repo) throw new Error('useRepository precisa estar dentro de <RepositoryProvider>.');
  return repo;
}
