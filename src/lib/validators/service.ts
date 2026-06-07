/**
 * Validadores Zod para o módulo Portfólio de Serviços — Task 12.2.
 *
 * Cobrem os payloads de:
 *   - `POST  /api/services`     → `createServiceSchema`
 *   - `PATCH /api/services/:id` → `updateServiceSchema`
 *   - `GET   /api/services?page=&pageSize=` → `listServicesQuerySchema`
 *
 * Regras (design.md → ServiceRequest):
 *   - `name`        → 3–100 caracteres (após `trim`).
 *   - `description` → 10–1000 caracteres (após `trim`).
 */

import { z } from 'zod';

// ─── Constantes de validação ─────────────────────────────────────────

export const SERVICE_NAME_MIN_LENGTH = 3;
export const SERVICE_NAME_MAX_LENGTH = 100;
export const SERVICE_DESCRIPTION_MIN_LENGTH = 10;
export const SERVICE_DESCRIPTION_MAX_LENGTH = 1000;

export const SERVICE_DEFAULT_PAGE_SIZE = 50;

export const SERVICE_VALIDATION_MESSAGES = {
  name: {
    required: 'O nome do serviço é obrigatório.',
    tooShort: `O nome deve ter no mínimo ${SERVICE_NAME_MIN_LENGTH} caracteres.`,
    tooLong: `O nome deve ter no máximo ${SERVICE_NAME_MAX_LENGTH} caracteres.`,
  },
  description: {
    required: 'A descrição do serviço é obrigatória.',
    tooShort: `A descrição deve ter no mínimo ${SERVICE_DESCRIPTION_MIN_LENGTH} caracteres.`,
    tooLong: `A descrição deve ter no máximo ${SERVICE_DESCRIPTION_MAX_LENGTH} caracteres.`,
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
 * Payload de criação de serviço (POST /api/services).
 * Ambos os campos são obrigatórios.
 */
export const createServiceSchema = z.object({
  name: z
    .string({ error: SERVICE_VALIDATION_MESSAGES.name.required })
    .trim()
    .min(SERVICE_NAME_MIN_LENGTH, {
      message: SERVICE_VALIDATION_MESSAGES.name.tooShort,
    })
    .max(SERVICE_NAME_MAX_LENGTH, {
      message: SERVICE_VALIDATION_MESSAGES.name.tooLong,
    }),
  description: z
    .string({ error: SERVICE_VALIDATION_MESSAGES.description.required })
    .trim()
    .min(SERVICE_DESCRIPTION_MIN_LENGTH, {
      message: SERVICE_VALIDATION_MESSAGES.description.tooShort,
    })
    .max(SERVICE_DESCRIPTION_MAX_LENGTH, {
      message: SERVICE_VALIDATION_MESSAGES.description.tooLong,
    }),
});

export type CreateServiceInput = z.infer<typeof createServiceSchema>;

/**
 * Payload de atualização de serviço (PATCH /api/services/:id).
 * Todos os campos são opcionais (partial update), mas ao menos um
 * deve estar presente. As mesmas regras de comprimento se aplicam
 * quando o campo é fornecido.
 */
export const updateServiceSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(SERVICE_NAME_MIN_LENGTH, {
        message: SERVICE_VALIDATION_MESSAGES.name.tooShort,
      })
      .max(SERVICE_NAME_MAX_LENGTH, {
        message: SERVICE_VALIDATION_MESSAGES.name.tooLong,
      })
      .optional(),
    description: z
      .string()
      .trim()
      .min(SERVICE_DESCRIPTION_MIN_LENGTH, {
        message: SERVICE_VALIDATION_MESSAGES.description.tooShort,
      })
      .max(SERVICE_DESCRIPTION_MAX_LENGTH, {
        message: SERVICE_VALIDATION_MESSAGES.description.tooLong,
      })
      .optional(),
  })
  .refine((data) => data.name !== undefined || data.description !== undefined, {
    message: 'Informe ao menos um campo para atualizar (name ou description).',
  });

export type UpdateServiceInput = z.infer<typeof updateServiceSchema>;

/**
 * Query params de GET /api/services. Aceita:
 *   - `page`     → inteiro ≥ 1 (default 1).
 *   - `pageSize` → inteiro 1–100 (default 50).
 */
export const listServicesQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .default('1')
    .transform((val) => parseInt(val, 10))
    .refine((val) => Number.isInteger(val) && val >= 1, {
      message: SERVICE_VALIDATION_MESSAGES.page.invalid,
    }),
  pageSize: z
    .string()
    .optional()
    .default(String(SERVICE_DEFAULT_PAGE_SIZE))
    .transform((val) => parseInt(val, 10))
    .refine((val) => Number.isInteger(val) && val >= 1 && val <= 100, {
      message: SERVICE_VALIDATION_MESSAGES.pageSize.invalid,
    }),
});

export type ListServicesQueryInput = z.infer<typeof listServicesQuerySchema>;
