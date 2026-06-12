/**
 * Validadores Zod para o módulo Projetos (redesenhado).
 *
 * Arquivo mantido para compatibilidade de imports — as validações
 * agora estão inline nos route handlers (multipart/form-data).
 */

import { z } from 'zod';

// ─── Constantes ──────────────────────────────────────────────────────

export const PROJECT_DEFAULT_PAGE_SIZE = 50;

export const PROJECT_VALIDATION_MESSAGES = {
  page: {
    invalid: 'O número da página deve ser um inteiro positivo.',
  },
  pageSize: {
    invalid: 'O tamanho da página deve ser um inteiro entre 1 e 100.',
  },
} as const;

// ─── Schemas ─────────────────────────────────────────────────────────

/**
 * Query params de GET /api/projects (mantido para uso futuro).
 */
export const listProjectsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .refine((val) => Number.isInteger(val) && val >= 1, {
      message: PROJECT_VALIDATION_MESSAGES.page.invalid,
    }),
  pageSize: z
    .string()
    .optional()
    .default(String(PROJECT_DEFAULT_PAGE_SIZE))
    .transform((val) => parseInt(val, 10))
    .refine((val) => Number.isInteger(val) && val >= 1 && val <= 100, {
      message: PROJECT_VALIDATION_MESSAGES.pageSize.invalid,
    }),
});

export type ListProjectsQueryInput = z.infer<typeof listProjectsQuerySchema>;
