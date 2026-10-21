import { createContext } from 'react';
import type { Repository } from './types';

export const RepositoryContext = createContext<Repository | null>(null);
