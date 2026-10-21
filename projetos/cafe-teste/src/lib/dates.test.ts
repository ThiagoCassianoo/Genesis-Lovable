import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { formatarDataBr, hojeLocal, isDataIsoValida } from './dates';

describe('hojeLocal', () => {
  beforeAll(() => {
    // stubEnv grava em process.env.TZ; o Node relê o fuso quando ele muda.
    vi.stubEnv('TZ', 'America/Sao_Paulo');
  });
  afterAll(() => vi.unstubAllEnvs());
  afterEach(() => vi.useRealTimers());

  it('às 23:30 em UTC-3 devolve o dia local, não o dia UTC', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T23:30:00-03:00'));
    expect(new Date().getTimezoneOffset()).toBe(180); // prova que o fuso falso entrou
    expect(new Date().toISOString().slice(0, 10)).toBe('2026-10-22'); // a armadilha
    expect(hojeLocal()).toBe('2026-10-21');
  });

  it('logo após meia-noite local já vira o dia seguinte', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-22T00:05:00-03:00'));
    expect(hojeLocal()).toBe('2026-10-22');
  });
});

describe('utilitários de data', () => {
  it('valida datas de calendário reais', () => {
    expect(isDataIsoValida('2024-02-29')).toBe(true);
    expect(isDataIsoValida('2025-02-29')).toBe(false);
    expect(isDataIsoValida('2026-13-01')).toBe(false);
  });

  it('formata em pt-BR', () => {
    expect(formatarDataBr('2026-10-05')).toBe('05/10/2026');
  });
});
