/**
 * Validadores Zod para o módulo Pontuação / Infrações — Tasks 16.1, 16.3.
 *
 * Cobrem os payloads de:
 *   - `POST /api/scores` → `createInfractionSchema`
 *
 * Regras (design.md → CreateInfractionRequest):
 *   - `type`     → enum InfractionType obrigatório (ATRASO | FALTA | DRESS_CODE).
 *   - `date`     → string ISO date, obrigatória, <= hoje.
 *   - `targetId` → string cuid, obrigatório (membro infrator).
 */

import { z } from 'zod';

// ─── Constantes de validação ─────────────────────────────────────────

export const INFRACTION_TYPES = ['ATRASO', 'FALTA', 'DRESS_CODE'] as const;

export const SCORE_VALIDATION_MESSAGES = {
  type: {
    required: 'O tipo de infração é obrigatório.',
    invalid: 'Tipo de infração inválido. Use: ATRASO, FALTA ou DRESS_CODE.',
  },
  date: {
    required: 'A data da infração é obrigatória.',
    invalid: 'Data inválida.',
    future: 'A data da infração não pode ser futura.',
  },
  targetId: {
    required: 'O membro infrator é obrigatório.',
  },
} as const;

// ─── Schemas ─────────────────────────────────────────────────────────

/**
 * Payload de criação de infração (POST /api/scores).
 */
export const createInfractionSchema = z.object({
  type: z.enum(INFRACTION_TYPES, {
    error: SCORE_VALIDATION_MESSAGES.type.invalid,
  }),
  date: z
    .string({ error: SCORE_VALIDATION_MESSAGES.date.required })
    .min(1, { message: SCORE_VALIDATION_MESSAGES.date.required })
    .refine(
      (val) => {
        const d = new Date(val);
        return !isNaN(d.getTime());
      },
      { message: SCORE_VALIDATION_MESSAGES.date.invalid },
    )
    .refine(
      (val) => {
        const d = new Date(val);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        return d <= today;
      },
      { message: SCORE_VALIDATION_MESSAGES.date.future },
    ),
  targetId: z
    .string({ error: SCORE_VALIDATION_MESSAGES.targetId.required })
    .min(1, { message: SCORE_VALIDATION_MESSAGES.targetId.required }),
});

export type CreateInfractionInput = z.infer<typeof createInfractionSchema>;

// ─── Helpers de semestre ─────────────────────────────────────────────

/**
 * Formato de semestre: YYYY-S onde S é 1 (Jan-Jun) ou 2 (Jul-Dec).
 */
export const SEMESTER_REGEX = /^\d{4}-[12]$/;

/**
 * Retorna o semestre vigente no formato YYYY-S.
 */
export function getCurrentSemester(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed
  const semester = month < 6 ? 1 : 2;
  return `${year}-${semester}`;
}

/**
 * Calcula o semestre correspondente a uma data no formato YYYY-S.
 */
export function getSemesterForDate(date: Date): string {
  const year = date.getFullYear();
  const month = date.getMonth();
  const semester = month < 6 ? 1 : 2;
  return `${year}-${semester}`;
}

/**
 * Retorna as datas de início e fim de um semestre.
 * Semestre 1: 1º Jan - 30 Jun
 * Semestre 2: 1º Jul - 31 Dec
 */
export function getSemesterDateRange(semester: string): { start: Date; end: Date } {
  const [yearStr, semStr] = semester.split('-');
  const year = parseInt(yearStr, 10);
  const sem = parseInt(semStr, 10);

  if (sem === 1) {
    return {
      start: new Date(year, 0, 1), // 1 Jan
      end: new Date(year, 5, 30, 23, 59, 59, 999), // 30 Jun
    };
  }
  return {
    start: new Date(year, 6, 1), // 1 Jul
    end: new Date(year, 11, 31, 23, 59, 59, 999), // 31 Dec
  };
}

/**
 * Valida se uma string de semestre é válida.
 */
export function isValidSemester(semester: string): boolean {
  return SEMESTER_REGEX.test(semester);
}
