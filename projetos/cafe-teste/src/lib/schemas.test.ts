import { describe, expect, it } from 'vitest';
import { criarAtividadeFormSchema, talhaoFormSchema } from './schemas';
import { parseNumeroPtBr } from './ptBrNumber';

const talhaoOk = { nome: 'Talhão 1', areaHa: '1,5', variedade: '' };

describe('talhaoFormSchema', () => {
  it('aceita área "1,5" e converte pra 1.5', () => {
    expect(talhaoFormSchema.safeParse(talhaoOk).success).toBe(true);
    expect(parseNumeroPtBr('1,5')).toBe(1.5);
    expect(parseNumeroPtBr('2.25')).toBe(2.25);
  });

  it.each(['0', '0,0', 'abc', '-1', '1,2,3', ''])('rejeita área "%s"', (areaHa) => {
    expect(talhaoFormSchema.safeParse({ ...talhaoOk, areaHa }).success).toBe(false);
  });

  it('rejeita nome vazio (ou só espaço) e nome > 60', () => {
    expect(talhaoFormSchema.safeParse({ ...talhaoOk, nome: '   ' }).success).toBe(false);
    expect(talhaoFormSchema.safeParse({ ...talhaoOk, nome: 'x'.repeat(61) }).success).toBe(false);
    expect(talhaoFormSchema.safeParse({ ...talhaoOk, nome: 'x'.repeat(60) }).success).toBe(true);
  });

  it('mensagem de erro em pt-BR', () => {
    const r = talhaoFormSchema.safeParse({ ...talhaoOk, areaHa: '0' });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toBe('A área precisa ser maior que zero.');
  });
});

describe('atividadeFormSchema', () => {
  const schema = criarAtividadeFormSchema(() => '2026-10-21');
  const ok = { talhaoId: 't1', data: '2026-10-21', tipo: 'Poda', nota: '' };

  it('aceita atividade válida de hoje', () => {
    expect(schema.safeParse(ok).success).toBe(true);
  });

  it('rejeita tipo fora da lista', () => {
    expect(schema.safeParse({ ...ok, tipo: 'Plantio de soja' }).success).toBe(false);
  });

  it('rejeita data futura e data inválida', () => {
    expect(schema.safeParse({ ...ok, data: '2026-10-22' }).success).toBe(false);
    expect(schema.safeParse({ ...ok, data: '2026-02-30' }).success).toBe(false);
    expect(schema.safeParse({ ...ok, data: '21/10/2026' }).success).toBe(false);
  });

  it('rejeita nota > 500 e aceita 500', () => {
    expect(schema.safeParse({ ...ok, nota: 'a'.repeat(501) }).success).toBe(false);
    expect(schema.safeParse({ ...ok, nota: 'a'.repeat(500) }).success).toBe(true);
  });

  it('exige talhão', () => {
    expect(schema.safeParse({ ...ok, talhaoId: '' }).success).toBe(false);
  });
});
