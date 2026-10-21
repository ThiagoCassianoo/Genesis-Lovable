import type { ReactNode } from 'react';
import { RepositoryContext } from './RepositoryContext';
import type { Repository } from './types';

export function RepositoryProvider({ repository, children }: { repository: Repository; children: ReactNode }) {
  return <RepositoryContext.Provider value={repository}>{children}</RepositoryContext.Provider>;
}
