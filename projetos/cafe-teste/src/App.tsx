import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/layouts/AppLayout';
import { RepositoryProvider } from '@/lib/repository/RepositoryProvider';
import { isRepositoryError, type Repository } from '@/lib/repository/types';
import { HomePage } from '@/pages/HomePage';
import { NaoEncontradaPage } from '@/pages/NaoEncontradaPage';
import { NovoTalhaoPage } from '@/pages/NovoTalhaoPage';
import { RegistrarAtividadePage } from '@/pages/RegistrarAtividadePage';
import { TalhaoPage } from '@/pages/TalhaoPage';

export function criarQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Erro tipado do repositório (ex.: dado corrompido) não melhora tentando de novo.
        retry: (falhas, erro) => !isRepositoryError(erro) && falhas < 2,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
}

export function AppProviders({
  repository,
  queryClient,
  children,
}: {
  repository: Repository;
  queryClient: QueryClient;
  children: ReactNode;
}) {
  return (
    <QueryClientProvider client={queryClient}>
      <RepositoryProvider repository={repository}>{children}</RepositoryProvider>
    </QueryClientProvider>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<HomePage />} />
        <Route path="registrar" element={<RegistrarAtividadePage />} />
        <Route path="talhoes/novo" element={<NovoTalhaoPage />} />
        <Route path="talhoes/:id" element={<TalhaoPage />} />
        <Route path="*" element={<NaoEncontradaPage />} />
      </Route>
    </Routes>
  );
}
