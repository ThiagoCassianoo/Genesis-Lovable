import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRepository } from './repository/useRepository';
import type { NovaAtividadeInput, NovoTalhaoInput } from './repository/types';

export const chaves = {
  talhoes: ['talhoes'] as const,
  talhao: (id: string) => ['talhao', id] as const,
  atividades: (talhaoId: string) => ['atividades', talhaoId] as const,
};

export function useTalhoes() {
  const repo = useRepository();
  return useQuery({ queryKey: chaves.talhoes, queryFn: () => repo.listTalhoes() });
}

export function useTalhao(id: string) {
  const repo = useRepository();
  return useQuery({ queryKey: chaves.talhao(id), queryFn: () => repo.getTalhao(id) });
}

export function useAtividades(talhaoId: string) {
  const repo = useRepository();
  return useQuery({ queryKey: chaves.atividades(talhaoId), queryFn: () => repo.listAtividades(talhaoId) });
}

export function useCriarTalhao() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NovoTalhaoInput) => repo.createTalhao(input),
    onSuccess: () => qc.invalidateQueries({ queryKey: chaves.talhoes }),
  });
}

export function useCriarAtividade() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NovaAtividadeInput) => repo.createAtividade(input),
    onSuccess: (atividade) => qc.invalidateQueries({ queryKey: chaves.atividades(atividade.talhaoId) }),
  });
}

export function useRemoverExemplos() {
  const repo = useRepository();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => repo.removerExemplos(),
    onSuccess: () => qc.invalidateQueries(),
  });
}
