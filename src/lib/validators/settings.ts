/**
 * Validadores Zod para o módulo Configurações — Portal Interno EJMC
 *
 * Tasks 18.1, 18.2, 18.3:
 *   - `changePasswordSchema`: valida alteração de senha (senha atual +
 *     nova senha 8-128 chars com maiúscula/minúscula/número).
 *   - Constantes de validação de avatar (tipo MIME, tamanho máximo).
 */

import { z } from 'zod';
import { PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from './auth';

/** Mensagens de erro em pt-BR para alteração de senha. */
export const PASSWORD_CHANGE_MESSAGES = {
  currentPassword: {
    required: 'A senha atual é obrigatória.',
  },
  newPassword: {
    required: 'A nova senha é obrigatória.',
    tooShort: `A nova senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    tooLong: `A nova senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
    missingUppercase: 'A nova senha deve conter pelo menos uma letra maiúscula.',
    missingLowercase: 'A nova senha deve conter pelo menos uma letra minúscula.',
    missingDigit: 'A nova senha deve conter pelo menos um número.',
    generic:
      'A nova senha deve ter entre 8 e 128 caracteres, com pelo menos uma maiúscula, uma minúscula e um número.',
  },
} as const;

/**
 * Schema para alteração de senha (PATCH /api/users/me/password).
 */
export const changePasswordSchema = z.object({
  currentPassword: z
    .string({ error: PASSWORD_CHANGE_MESSAGES.currentPassword.required })
    .min(1, { message: PASSWORD_CHANGE_MESSAGES.currentPassword.required }),

  newPassword: z
    .string({ error: PASSWORD_CHANGE_MESSAGES.newPassword.required })
    .min(PASSWORD_MIN_LENGTH, {
      message: PASSWORD_CHANGE_MESSAGES.newPassword.tooShort,
    })
    .max(PASSWORD_MAX_LENGTH, {
      message: PASSWORD_CHANGE_MESSAGES.newPassword.tooLong,
    })
    .refine((value) => /[A-Z]/.test(value), {
      message: PASSWORD_CHANGE_MESSAGES.newPassword.missingUppercase,
    })
    .refine((value) => /[a-z]/.test(value), {
      message: PASSWORD_CHANGE_MESSAGES.newPassword.missingLowercase,
    })
    .refine((value) => /\d/.test(value), {
      message: PASSWORD_CHANGE_MESSAGES.newPassword.missingDigit,
    }),
});

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** Tipos MIME aceitos para avatar (Task 18.3). */
export const AVATAR_ALLOWED_MIMES = ['image/png', 'image/jpeg'] as const;

/** Tamanho máximo do avatar em bytes (5 MB). */
export const AVATAR_MAX_SIZE_BYTES = 5 * 1024 * 1024;
