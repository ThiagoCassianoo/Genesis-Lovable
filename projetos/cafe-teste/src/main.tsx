import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { AppProviders, AppRoutes, criarQueryClient } from './App';
import { createLocalStorageRepository } from './lib/repository/localStorageRepository';
import './styles/index.css';

const root = document.getElementById('root');
if (!root) throw new Error('Elemento #root não encontrado');

createRoot(root).render(
  <StrictMode>
    <AppProviders repository={createLocalStorageRepository()} queryClient={criarQueryClient()}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AppProviders>
  </StrictMode>,
);
