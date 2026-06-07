/**
 * Validadores Zod — Módulo Admin (Tasks 19.1–19.9)
 *
 * Schemas para:
 *   - Query params da listagem de usuários (GET /api/users?status=)
 *   - Body de criação de conta pelo admin (POST /api/users)
 *   - Body de ações no usuário (PATCH /api/users/:id)
 *
 * Compatibilidade: Zod v4 — usa `error` em vez de `errorMap`/`required_error`.
 */

import { z } from 'zod';

// ─── Constantes ──────────────────────────────────────────────────────────────

export const VALID_STATUSES = ['PENDING', 'ACTIVE', 'INACTIVE', 'REJECTED'] as const;

export const VALID_ROLES = ['ADMIN', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'MEMBRO'] as const;

export const VALID_ACTIONS = ['approve', 'reject', 'changeRole'] as const;

// ─── Mensagens ───────────────────────────────────────────────────────────────

export const ADMIN_VALIDATION_MESSAGES = {
  status: {
    invalid: `Status inválido. Valores aceitos: ${VALID_STATUSES.join(', ')}.`,
  },
  name: {
    required: 'Nome é obrigatório.',
    tooShort: 'Nome deve ter no mínimo 3 caracteres.',
    tooLong: 'Nome deve ter no máximo 150 caracteres.',
  },
  email: {
    required: 'Email é obrigatório.',
    invalid: 'Email inválido.',
    tooLong: 'Email deve ter no máximo 255 caracteres.',
  },
  role: {
    invalid: `Nível de permissão inválido. Valores aceitos: ${VALID_ROLES.join(', ')}.`,
  },
  action: {
    invalid: `Ação inválida. Valores aceitos: ${VALID_ACTIONS.join(', ')}.`,
  },
} as const;

// ─── GET /api/users?status= ──────────────────────────────────────────────────

export const listUsersQuerySchema = z.object({
  status: z
    .enum(VALID_STATUSES, {
      error: ADMIN_VALIDATION_MESSAGES.status.invalid,
    })
    .optional(),
});

// ─── POST /api/users (Task 19.4) ────────────────────────────────────────────

export const createUserSchema = z.object({
  name: z
    .string({ error: ADMIN_VALIDATION_MESSAGES.name.required })
    .trim()
    .min(3, { message: ADMIN_VALIDATION_MESSAGES.name.tooShort })
    .max(150, { message: ADMIN_VALIDATION_MESSAGES.name.tooLong }),
  email: z
    .string({ error: ADMIN_VALIDATION_MESSAGES.email.required })
    .trim()
    .min(1, { message: ADMIN_VALIDATION_MESSAGES.email.required })
    .email({ message: ADMIN_VALIDATION_MESSAGES.email.invalid })
    .max(255, { message: ADMIN_VALIDATION_MESSAGES.email.tooLong })
    .transform((val) => val.toLowerCase()),
  role: z.enum(VALID_ROLES, {
    error: ADMIN_VALIDATION_MESSAGES.role.invalid,
  }),
});

// ─── PATCH /api/users/:id (Tasks 19.3, 19.5) ────────────────────────────────

export const updateUserActionSchema = z
  .object({
    action: z.enum(VALID_ACTIONS, {
      error: ADMIN_VALIDATION_MESSAGES.action.invalid,
    }),
    role: z
      .enum(VALID_ROLES, {
        error: ADMIN_VALIDATION_MESSAGES.role.invalid,
      })
      .optional(),
  })
  .refine(
    (data) => {
      if (data.action === 'changeRole' && !data.role) {
        return false;
      }
      return true;
    },
    {
      message: 'O campo "role" é obrigatório quando a ação é "changeRole".',
      path: ['role'],
    },
  );

export type ListUsersQueryInput = z.infer<typeof listUsersQuerySchema>;
export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserActionInput = z.infer<typeof updateUserActionSchema>;
