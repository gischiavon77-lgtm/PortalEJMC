/**
 * Validadores Zod para o módulo Enquetes — Tasks 15.1, 15.2.
 *
 * Cobrem os payloads de:
 *   - `POST /api/polls`          → `createPollSchema`
 *   - `POST /api/polls/:id/vote` → `voteSchema`
 *
 * Regras (design.md → CreatePollRequest):
 *   - `title`       → 1–150 caracteres (após trim).
 *   - `description` → 1–2000 caracteres (após trim).
 *   - `options`     → array de 2–10 strings, cada uma 1–200 chars (após trim).
 */

import { z } from 'zod';

// ─── Constantes de validação ─────────────────────────────────────────

export const POLL_TITLE_MIN_LENGTH = 1;
export const POLL_TITLE_MAX_LENGTH = 150;
export const POLL_DESCRIPTION_MIN_LENGTH = 1;
export const POLL_DESCRIPTION_MAX_LENGTH = 2000;
export const POLL_OPTIONS_MIN = 2;
export const POLL_OPTIONS_MAX = 10;
export const POLL_OPTION_TEXT_MIN_LENGTH = 1;
export const POLL_OPTION_TEXT_MAX_LENGTH = 200;

export const POLL_VALIDATION_MESSAGES = {
  title: {
    required: 'O título da enquete é obrigatório.',
    tooLong: `O título deve ter no máximo ${POLL_TITLE_MAX_LENGTH} caracteres.`,
  },
  description: {
    required: 'A descrição da enquete é obrigatória.',
    tooLong: `A descrição deve ter no máximo ${POLL_DESCRIPTION_MAX_LENGTH} caracteres.`,
  },
  options: {
    required: 'As opções da enquete são obrigatórias.',
    tooFew: `A enquete deve ter no mínimo ${POLL_OPTIONS_MIN} opções.`,
    tooMany: `A enquete deve ter no máximo ${POLL_OPTIONS_MAX} opções.`,
    itemRequired: 'Cada opção deve ter pelo menos 1 caractere.',
    itemTooLong: `Cada opção deve ter no máximo ${POLL_OPTION_TEXT_MAX_LENGTH} caracteres.`,
  },
  vote: {
    optionIdRequired: 'O ID da opção é obrigatório.',
  },
} as const;

// ─── Schemas ─────────────────────────────────────────────────────────

/**
 * Payload de criação de enquete (POST /api/polls).
 */
export const createPollSchema = z.object({
  title: z
    .string({ error: POLL_VALIDATION_MESSAGES.title.required })
    .trim()
    .min(POLL_TITLE_MIN_LENGTH, {
      message: POLL_VALIDATION_MESSAGES.title.required,
    })
    .max(POLL_TITLE_MAX_LENGTH, {
      message: POLL_VALIDATION_MESSAGES.title.tooLong,
    }),
  description: z
    .string({ error: POLL_VALIDATION_MESSAGES.description.required })
    .trim()
    .min(POLL_DESCRIPTION_MIN_LENGTH, {
      message: POLL_VALIDATION_MESSAGES.description.required,
    })
    .max(POLL_DESCRIPTION_MAX_LENGTH, {
      message: POLL_VALIDATION_MESSAGES.description.tooLong,
    }),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(POLL_OPTION_TEXT_MIN_LENGTH, {
          message: POLL_VALIDATION_MESSAGES.options.itemRequired,
        })
        .max(POLL_OPTION_TEXT_MAX_LENGTH, {
          message: POLL_VALIDATION_MESSAGES.options.itemTooLong,
        }),
      { error: POLL_VALIDATION_MESSAGES.options.required },
    )
    .min(POLL_OPTIONS_MIN, {
      message: POLL_VALIDATION_MESSAGES.options.tooFew,
    })
    .max(POLL_OPTIONS_MAX, {
      message: POLL_VALIDATION_MESSAGES.options.tooMany,
    }),
});

export type CreatePollInput = z.infer<typeof createPollSchema>;

/**
 * Payload de votação (POST /api/polls/:id/vote).
 */
export const voteSchema = z.object({
  optionId: z
    .string({ error: POLL_VALIDATION_MESSAGES.vote.optionIdRequired })
    .min(1, { message: POLL_VALIDATION_MESSAGES.vote.optionIdRequired }),
});

export type VoteInput = z.infer<typeof voteSchema>;
