/**
 * Validadores Zod para o módulo Comunicados — Tasks 14.1, 14.2.
 *
 * Cobrem os payloads de:
 *   - `POST /api/announcements`               → `createAnnouncementSchema`
 *   - `GET  /api/announcements?page=&pageSize=` → `listAnnouncementsQuerySchema`
 *
 * Regras (design.md → CreateAnnouncementRequest):
 *   - `title`   → 1–150 caracteres (após `trim`).
 *   - `content` → 1–5000 caracteres (após `trim`).
 */

import { z } from 'zod';

// ─── Constantes de validação ─────────────────────────────────────────

export const ANNOUNCEMENT_TITLE_MIN_LENGTH = 1;
export const ANNOUNCEMENT_TITLE_MAX_LENGTH = 150;
export const ANNOUNCEMENT_CONTENT_MIN_LENGTH = 1;
export const ANNOUNCEMENT_CONTENT_MAX_LENGTH = 5000;

export const ANNOUNCEMENT_DEFAULT_PAGE_SIZE = 20;

export const ANNOUNCEMENT_VALIDATION_MESSAGES = {
  title: {
    required: 'O título do comunicado é obrigatório.',
    tooLong: `O título deve ter no máximo ${ANNOUNCEMENT_TITLE_MAX_LENGTH} caracteres.`,
  },
  content: {
    required: 'O conteúdo do comunicado é obrigatório.',
    tooLong: `O conteúdo deve ter no máximo ${ANNOUNCEMENT_CONTENT_MAX_LENGTH} caracteres.`,
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
 * Payload de criação de comunicado (POST /api/announcements).
 * Ambos os campos são obrigatórios.
 */
export const createAnnouncementSchema = z.object({
  title: z
    .string({ error: ANNOUNCEMENT_VALIDATION_MESSAGES.title.required })
    .trim()
    .min(ANNOUNCEMENT_TITLE_MIN_LENGTH, {
      message: ANNOUNCEMENT_VALIDATION_MESSAGES.title.required,
    })
    .max(ANNOUNCEMENT_TITLE_MAX_LENGTH, {
      message: ANNOUNCEMENT_VALIDATION_MESSAGES.title.tooLong,
    }),
  content: z
    .string({ error: ANNOUNCEMENT_VALIDATION_MESSAGES.content.required })
    .trim()
    .min(ANNOUNCEMENT_CONTENT_MIN_LENGTH, {
      message: ANNOUNCEMENT_VALIDATION_MESSAGES.content.required,
    })
    .max(ANNOUNCEMENT_CONTENT_MAX_LENGTH, {
      message: ANNOUNCEMENT_VALIDATION_MESSAGES.content.tooLong,
    }),
});

export type CreateAnnouncementInput = z.infer<typeof createAnnouncementSchema>;

/**
 * Query params de GET /api/announcements. Aceita:
 *   - `page`     → inteiro ≥ 1 (default 1).
 *   - `pageSize` → inteiro 1–100 (default 20).
 */
export const listAnnouncementsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .refine((val) => Number.isInteger(val) && val >= 1, {
      message: ANNOUNCEMENT_VALIDATION_MESSAGES.page.invalid,
    }),
  pageSize: z
    .string()
    .optional()
    .default(String(ANNOUNCEMENT_DEFAULT_PAGE_SIZE))
    .transform((val) => parseInt(val, 10))
    .refine((val) => Number.isInteger(val) && val >= 1 && val <= 100, {
      message: ANNOUNCEMENT_VALIDATION_MESSAGES.pageSize.invalid,
    }),
});

export type ListAnnouncementsQueryInput = z.infer<typeof listAnnouncementsQuerySchema>;
