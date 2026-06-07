/**
 * Validadores Zod para o módulo Projetos — Task 13.1.
 *
 * Cobrem os payloads de:
 *   - `GET   /api/projects?status=&page=&pageSize=` → `listProjectsQuerySchema`
 *   - `PATCH /api/projects/:id/status`              → `updateProjectStatusSchema`
 *
 * Regras (design.md → UpdateProjectStatusRequest):
 *   - `status` → um dos valores de `ProjectStatus` enum do Prisma.
 */

import { z } from 'zod';

// ─── Constantes ──────────────────────────────────────────────────────

export const PROJECT_DEFAULT_PAGE_SIZE = 50;

export const PROJECT_STATUSES = ['EM_ANDAMENTO', 'CONCLUIDO', 'CONGELADO', 'CANCELADO'] as const;

export const PROJECT_VALIDATION_MESSAGES = {
  status: {
    invalid: 'Status inválido. Use: EM_ANDAMENTO, CONCLUIDO, CONGELADO ou CANCELADO.',
  },
  page: {
    invalid: 'O número da página deve ser um inteiro positivo.',
  },
  pageSize: {
    invalid: 'O tamanho da página deve ser um inteiro entre 1 e 100.',
  },
} as const;

// ─── Schemas ─────────────────────────────────────────────────────────

/**
 * Query params de GET /api/projects. Aceita:
 *   - `status`   → filtro opcional por status do projeto.
 *   - `page`     → inteiro ≥ 1 (default 1).
 *   - `pageSize` → inteiro 1–100 (default 50).
 */
export const listProjectsQuerySchema = z.object({
  status: z
    .enum(PROJECT_STATUSES, {
      message: PROJECT_VALIDATION_MESSAGES.status.invalid,
    })
    .optional(),
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

/**
 * Payload de PATCH /api/projects/:id/status.
 * Campo `status` obrigatório — deve ser um dos valores do enum.
 */
export const updateProjectStatusSchema = z.object({
  status: z.enum(PROJECT_STATUSES, {
    message: PROJECT_VALIDATION_MESSAGES.status.invalid,
  }),
});

export type UpdateProjectStatusInput = z.infer<typeof updateProjectStatusSchema>;
