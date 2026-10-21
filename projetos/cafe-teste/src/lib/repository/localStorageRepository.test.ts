import { describe, expect, it, beforeEach } from 'vitest';
import { STORAGE_KEY } from '@/data/config';
import { PREFIXO_EXEMPLO } from '@/data/seedExemplos';
import { createLocalStorageRepository } from './localStorageRepository';
import { RepositoryError } from './types';

function relogio(inicio = '2026-10-21T12:00:00.000Z') {
  let t = new Date(inicio).getTime();
  return () => new Date((t += 1000));
}

function novoRepo(semearExemplos = false, agora = relogio()) {
  return createLocalStorageRepository({ storage: localStorage, semearExemplos, agora });
}

describe('localStorageRepository', () => {
  beforeEach(() => localStorage.clear());

  it('cria e lista talhões', async () => {
    const repo = novoRepo();
    const t = await repo.createTalhao({ nome: '  Talhão 1 ', areaHa: 1.5, variedade: 'Catuaí' });
    expect(t.nome).toBe('Talhão 1');
    expect(t.ficticio).toBe(false);
    expect(t.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(await repo.listTalhoes()).toEqual([t]);
    expect(await repo.getTalhao(t.id)).toEqual(t);
    expect(await repo.getTalhao('inexistente')).toBeNull();
  });

  it('ordena atividades por data desc e, no empate, criadoEm desc', async () => {
    const repo = novoRepo();
    const t = await repo.createTalhao({ nome: 'A', areaHa: 1, variedade: '' });
    const antiga = await repo.createAtividade({ talhaoId: t.id, data: '2026-10-01', tipo: 'Poda', nota: '' });
    const empate1 = await repo.createAtividade({ talhaoId: t.id, data: '2026-10-10', tipo: 'Capina/Roçada', nota: '' });
    const empate2 = await repo.createAtividade({ talhaoId: t.id, data: '2026-10-10', tipo: 'Irrigação', nota: '' });
    const lista = await repo.listAtividades(t.id);
    expect(lista.map((a) => a.id)).toEqual([empate2.id, empate1.id, antiga.id]);
  });

  it('em empate total (mesma data e criadoEm) o último inserido vem primeiro', async () => {
    const fixo = () => new Date('2026-10-21T12:00:00.000Z');
    const repo = novoRepo(false, fixo);
    const t = await repo.createTalhao({ nome: 'A', areaHa: 1, variedade: '' });
    const a1 = await repo.createAtividade({ talhaoId: t.id, data: '2026-10-10', tipo: 'Poda', nota: '' });
    const a2 = await repo.createAtividade({ talhaoId: t.id, data: '2026-10-10', tipo: 'Poda', nota: '' });
    expect((await repo.listAtividades(t.id)).map((a) => a.id)).toEqual([a2.id, a1.id]);
  });

  it('lista só atividades do talhão pedido', async () => {
    const repo = novoRepo();
    const a = await repo.createTalhao({ nome: 'A', areaHa: 1, variedade: '' });
    const b = await repo.createTalhao({ nome: 'B', areaHa: 1, variedade: '' });
    await repo.createAtividade({ talhaoId: a.id, data: '2026-10-10', tipo: 'Poda', nota: '' });
    expect(await repo.listAtividades(b.id)).toEqual([]);
  });

  it('recusa atividade de talhão inexistente', async () => {
    const repo = novoRepo();
    await expect(
      repo.createAtividade({ talhaoId: 'x', data: '2026-10-10', tipo: 'Poda', nota: '' }),
    ).rejects.toMatchObject({ code: 'NAO_ENCONTRADO' });
  });

  it('persiste ao recriar a instância', async () => {
    const t = await novoRepo().createTalhao({ nome: 'Persistente', areaHa: 3, variedade: '' });
    await novoRepo().createAtividade({ talhaoId: t.id, data: '2026-10-11', tipo: 'Colheita', nota: 'ok' });
    const outra = novoRepo();
    expect((await outra.listTalhoes()).map((x) => x.nome)).toEqual(['Persistente']);
    expect((await outra.listAtividades(t.id))[0].nota).toBe('ok');
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}').schemaVersion).toBe(1);
  });

  it('JSON ilegível vira RepositoryError CORROMPIDO', async () => {
    localStorage.setItem(STORAGE_KEY, '{quebrado');
    const repo = novoRepo();
    await expect(repo.listTalhoes()).rejects.toBeInstanceOf(RepositoryError);
    await expect(repo.listTalhoes()).rejects.toMatchObject({ code: 'CORROMPIDO' });
  });

  it('JSON válido com formato errado vira CORROMPIDO, e recomecar() limpa', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ schemaVersion: 1, talhoes: [{ id: 1 }], atividades: [] }));
    const repo = novoRepo(true);
    await expect(repo.listTalhoes()).rejects.toMatchObject({ code: 'CORROMPIDO' });
    await repo.recomecar();
    expect(await repo.listTalhoes()).toEqual([]);
  });

  it('semeia exemplos fictícios só no primeiro uso', async () => {
    const repo = novoRepo(true);
    const talhoes = await repo.listTalhoes();
    expect(talhoes.length).toBeGreaterThan(0);
    expect(talhoes.every((t) => t.ficticio && t.nome.startsWith(PREFIXO_EXEMPLO))).toBe(true);
    const atividades = await repo.listAtividades(talhoes[0].id);
    expect(atividades.every((a) => a.ficticio)).toBe(true);
  });

  it('remove exemplos sem tocar nos dados reais, e eles não voltam', async () => {
    const repo = novoRepo(true);
    const real = await repo.createTalhao({ nome: 'Meu talhão', areaHa: 2, variedade: '' });
    const atv = await repo.createAtividade({ talhaoId: real.id, data: '2026-10-10', tipo: 'Poda', nota: '' });
    await repo.removerExemplos();
    expect(await repo.listTalhoes()).toEqual([real]);
    expect(await repo.listAtividades(real.id)).toEqual([atv]);
    expect(await novoRepo(true).listTalhoes()).toEqual([real]);
  });

  it('falha de escrita vira RepositoryError ESCRITA', async () => {
    const cheio: Storage = {
      ...localStorage,
      length: 0,
      clear: () => undefined,
      key: () => null,
      removeItem: () => undefined,
      getItem: () => JSON.stringify({ schemaVersion: 1, talhoes: [], atividades: [] }),
      setItem: () => {
        throw new DOMException('cheio', 'QuotaExceededError');
      },
    };
    const repo = createLocalStorageRepository({ storage: cheio, semearExemplos: false });
    await expect(repo.createTalhao({ nome: 'X', areaHa: 1, variedade: '' })).rejects.toMatchObject({
      code: 'ESCRITA',
    });
  });
});
