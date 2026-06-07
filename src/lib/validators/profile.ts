/**
 * Validadores Zod para o módulo Perfil — Task 11.2 (Req 12.3).
 *
 * Schemas isomórficos compartilhados entre o formulário client-side
 * (`ProfileForm`) e o PATCH /api/users/me server-side.
 *
 * Campos editáveis:
 *   - name    → 3–150 chars (trim)
 *   - email   → RFC 5322, normalizado para lowercase
 *   - phone   → telefone brasileiro com DDD: 10 ou 11 dígitos numéricos
 *   - cpf     → 11 dígitos + algoritmo módulo 11 (dígitos verificadores)
 *
 * Campos readonly (area, position, role) não aparecem neste schema —
 * a API ignora qualquer tentativa de alterá-los.
 */

import { z } from 'zod';

// ─── Constantes ──────────────────────────────────────────────────────────────

export const PROFILE_VALIDATION_MESSAGES = {
  name: {
    required: 'O nome é obrigatório.',
    tooShort: 'O nome deve ter pelo menos 3 caracteres.',
    tooLong: 'O nome deve ter no máximo 150 caracteres.',
  },
  email: {
    required: 'O email é obrigatório.',
    invalid: 'Informe um email válido.',
  },
  phone: {
    invalid:
      'Informe um telefone brasileiro válido com DDD (ex: 11 99999-9999).',
  },
  cpf: {
    invalid: 'Informe um CPF válido (11 dígitos com dígitos verificadores).',
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Remove qualquer caractere não-numérico de uma string. */
function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Valida CPF pelo algoritmo oficial (módulo 11).
 * Rejeita CPFs com todos os dígitos iguais (ex: 111.111.111-11).
 *
 * @param raw string com 11 dígitos (sem máscara)
 */
export function validateCpf(raw: string): boolean {
  const digits = onlyDigits(raw);
  if (digits.length !== 11) return false;

  // CPFs com todos os dígitos iguais são inválidos
  if (/^(\d)\1{10}$/.test(digits)) return false;

  const calcDigit = (slice: string, weights: number[]): number => {
    const sum = slice
      .split('')
      .reduce((acc, d, i) => acc + parseInt(d, 10) * weights[i]!, 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };

  const firstWeights = [10, 9, 8, 7, 6, 5, 4, 3, 2];
  const secondWeights = [11, 10, 9, 8, 7, 6, 5, 4, 3, 2];

  const d1 = calcDigit(digits.slice(0, 9), firstWeights);
  if (d1 !== parseInt(digits[9]!, 10)) return false;

  const d2 = calcDigit(digits.slice(0, 10), secondWeights);
  if (d2 !== parseInt(digits[10]!, 10)) return false;

  return true;
}

/**
 * Valida telefone brasileiro com DDD.
 * Aceita os formatos:
 *   - Somente dígitos: 10 ou 11 caracteres (ex: 11999998888)
 *   - Formatados: (11) 99999-8888 | (11) 9999-8888 | 11 99999-8888 etc.
 */
export function validatePhone(raw: string): boolean {
  const digits = onlyDigits(raw);
  return digits.length === 10 || digits.length === 11;
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

/**
 * Schema de atualização de perfil.
 * Todos os campos são opcionais — o PATCH é parcial.
 * Campos vazios string são tratados como "não enviados" (undefined).
 */
export const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, { message: PROFILE_VALIDATION_MESSAGES.name.tooShort })
    .max(150, { message: PROFILE_VALIDATION_MESSAGES.name.tooLong })
    .optional(),

  email: z
    .string()
    .trim()
    .min(1, { message: PROFILE_VALIDATION_MESSAGES.email.required })
    .email({ message: PROFILE_VALIDATION_MESSAGES.email.invalid })
    .transform((v) => v.toLowerCase())
    .optional(),

  phone: z
    .string()
    .trim()
    .refine((v) => v === '' || validatePhone(v), {
      message: PROFILE_VALIDATION_MESSAGES.phone.invalid,
    })
    // String vazia → undefined (campo não enviado)
    .transform((v) => (v === '' ? undefined : onlyDigits(v)))
    .optional(),

  cpf: z
    .string()
    .trim()
    .refine((v) => v === '' || validateCpf(v), {
      message: PROFILE_VALIDATION_MESSAGES.cpf.invalid,
    })
    .transform((v) => (v === '' ? undefined : onlyDigits(v)))
    .optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
