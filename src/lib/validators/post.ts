/**
 * Validadores Zod do feed da página inicial (Fase 2 da reforma).
 *
 *   - `createPostSchema`     → texto da publicação (`POST /api/posts`).
 *   - `listPostsQuerySchema` → paginação por cursor (`GET /api/posts`).
 *
 * A imagem opcional não passa por aqui: é validada pelo conteúdo em
 * `@/lib/validators/upload` (tipo e tamanho) dentro da rota.
 */

import { z } from 'zod';

export const POST_CONTENT_MAX_LENGTH = 2000;
export const POSTS_PAGE_SIZE = 10;
export const POSTS_PAGE_SIZE_MAX = 30;

export const POST_VALIDATION_MESSAGES = {
  content: {
    required: 'Escreva o texto da publicação.',
    tooLong: `A publicação deve ter no máximo ${POST_CONTENT_MAX_LENGTH} caracteres.`,
  },
  limit: {
    invalid: `O tamanho da página deve ser um inteiro entre 1 e ${POSTS_PAGE_SIZE_MAX}.`,
  },
} as const;

export const createPostSchema = z.object({
  content: z
    .string({ error: POST_VALIDATION_MESSAGES.content.required })
    .trim()
    .min(1, { message: POST_VALIDATION_MESSAGES.content.required })
    .max(POST_CONTENT_MAX_LENGTH, { message: POST_VALIDATION_MESSAGES.content.tooLong }),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

export const listPostsQuerySchema = z.object({
  /** Id da última publicação já exibida; vazio = primeira página. */
  cursor: z.string().trim().min(1).max(64).optional(),
  limit: z
    .string()
    .optional()
    .default(String(POSTS_PAGE_SIZE))
    .transform((val) => parseInt(val, 10))
    .refine((val) => Number.isInteger(val) && val >= 1 && val <= POSTS_PAGE_SIZE_MAX, {
      message: POST_VALIDATION_MESSAGES.limit.invalid,
    }),
});

export type ListPostsQueryInput = z.infer<typeof listPostsQuerySchema>;
