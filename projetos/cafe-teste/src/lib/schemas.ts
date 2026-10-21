import { z } from 'zod';
import { TIPOS_ATIVIDADE } from '@/data/tiposAtividade';
import { SCHEMA_VERSION } from '@/data/config';
import { hojeLocal, isDataIsoValida } from './dates';
import { parseNumeroPtBr } from './ptBrNumber';

export const NOME_MAX = 60;
export const NOTA_MAX = 500;

/* ---------- Formulários (entrada do usuário, tudo string) ---------- */

export const talhaoFormSchema = z.object({
  nome: z
    .string()
    .trim()
    .min(1, { error: 'Informe o nome do talhão.' })
    .max(NOME_MAX, { error: `O nome pode ter no máximo ${NOME_MAX} caracteres.` }),
  areaHa: z
    .string()
    .trim()
    .min(1, { error: 'Informe a área em hectares.' })
    .refine((v) => parseNumeroPtBr(v) !== null, {
      error: 'Use só números, por exemplo 1,5.',
    })
    .refine((v) => (parseNumeroPtBr(v) ?? 0) > 0, {
      error: 'A área precisa ser maior que zero.',
    }),
  variedade: z
    .string()
    .trim()
    .max(NOME_MAX, { error: `A variedade pode ter no máximo ${NOME_MAX} caracteres.` }),
});

export type TalhaoFormData = z.infer<typeof talhaoFormSchema>;

export function criarAtividadeFormSchema(hoje: () => string = () => hojeLocal()) {
  return z.object({
    talhaoId: z.string().min(1, { error: 'Escolha o talhão.' }),
    data: z
      .string()
      .refine(isDataIsoValida, { error: 'Informe uma data válida.' })
      .refine((v) => v <= hoje(), { error: 'A data não pode ser no futuro.' }),
    tipo: z.enum(TIPOS_ATIVIDADE, { error: 'Escolha o tipo de atividade.' }),
    nota: z
      .string()
      .max(NOTA_MAX, { error: `A anotação pode ter no máximo ${NOTA_MAX} caracteres.` }),
  });
}

export const atividadeFormSchema = criarAtividadeFormSchema();
export type AtividadeFormData = z.infer<typeof atividadeFormSchema>;

/* ---------- Persistência (o que fica no localStorage) ---------- */

export const talhaoSchema = z.object({
  id: z.string().min(1),
  nome: z.string().min(1).max(NOME_MAX),
  areaHa: z.number().positive(),
  variedade: z.string().max(NOME_MAX),
  ficticio: z.boolean(),
  criadoEm: z.string().min(1),
});

export const atividadeSchema = z.object({
  id: z.string().min(1),
  talhaoId: z.string().min(1),
  data: z.string().refine(isDataIsoValida),
  tipo: z.enum(TIPOS_ATIVIDADE),
  nota: z.string().max(NOTA_MAX),
  ficticio: z.boolean(),
  criadoEm: z.string().min(1),
});

export const estadoArmazenadoSchema = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  talhoes: z.array(talhaoSchema),
  atividades: z.array(atividadeSchema),
});

export type Talhao = z.infer<typeof talhaoSchema>;
export type Atividade = z.infer<typeof atividadeSchema>;
export type EstadoArmazenado = z.infer<typeof estadoArmazenadoSchema>;
