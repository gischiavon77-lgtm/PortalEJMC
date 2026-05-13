/**
 * Validadores Zod para autenticação — Portal Interno EJMC
 *
 * Task 3.6: schemas isomórficos compartilhados entre formulários (client)
 * e API Routes (server). Implementa Property 4 / Req 3.1, 3.6:
 *
 *   - `name`     → 3 a 150 caracteres (após `trim`).
 *   - `email`    → string com formato de email válido (RFC 5322-ish, via
 *                  `.email()` do Zod), normalizada para lowercase + trim.
 *   - `password` → 8 a 128 caracteres, contendo ao menos uma letra
 *                  maiúscula, uma minúscula e um número.
 *
 * Mensagens de erro em pt-BR e específicas por campo, para que tanto o
 * formulário (Task 3.9) quanto o `POST /api/auth/register` (Task 3.6/3.7)
 * possam exibi-las diretamente sem tradução adicional.
 *
 * Por que `.toLowerCase()` no schema?
 *   O modelo `User.email` no Prisma possui `@unique` sobre o valor exato
 *   armazenado. Se o cadastro guardar "Foo@Bar.com" e o login normalizar
 *   para "foo@bar.com" (como faz `auth.ts` em `authorize`), a verificação
 *   de unicidade falharia silenciosamente — duas linhas com o "mesmo" email
 *   poderiam coexistir. Centralizar a normalização aqui garante que o
 *   email sempre chega ao banco em lowercase, independentemente da camada
 *   chamadora. O mesmo vale para `trim` em `name`.
 *
 * Por que validar a senha por presença de classes (regex) em vez de
 * usar um `regex` único?
 *   Com regex único, qualquer falha (ex: faltou número) resultaria em
 *   uma mensagem genérica do regex. Quebrando em três `refine` separados
 *   conseguimos retornar a mensagem específica para cada classe ausente
 *   ("falta letra maiúscula", "falta número" etc.), respeitando o
 *   requisito de feedback por campo (Req 3.6).
 *
 * Compatibilidade com Zod v4: o pacote em uso (`zod@^4.4.3`) substituiu
 * `required_error`/`invalid_type_error` por um único campo `error`. Onde
 * a mensagem específica do `required` precisa ser exibida em vez da
 * mensagem padrão de "expected string, received undefined", passamos
 * `error` no construtor do `z.string`. Para erros de tamanho/formato,
 * cada validador (min/max/email) recebe o seu próprio `message`.
 */

import { z } from 'zod';

/** Limites de tamanho compartilhados com o schema Prisma (`User.name`/senha). */
export const NAME_MIN_LENGTH = 3;
export const NAME_MAX_LENGTH = 150;
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 128;

/** Mensagens de erro em pt-BR, exportadas para reuso em testes e na UI. */
export const REGISTER_VALIDATION_MESSAGES = {
  name: {
    required: 'O nome é obrigatório.',
    tooShort: `O nome deve ter pelo menos ${NAME_MIN_LENGTH} caracteres.`,
    tooLong: `O nome deve ter no máximo ${NAME_MAX_LENGTH} caracteres.`,
  },
  email: {
    required: 'O email é obrigatório.',
    invalid: 'Informe um email válido.',
  },
  password: {
    required: 'A senha é obrigatória.',
    tooShort: `A senha deve ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`,
    tooLong: `A senha deve ter no máximo ${PASSWORD_MAX_LENGTH} caracteres.`,
    missingUppercase: 'A senha deve conter pelo menos uma letra maiúscula.',
    missingLowercase: 'A senha deve conter pelo menos uma letra minúscula.',
    missingDigit: 'A senha deve conter pelo menos um número.',
  },
} as const;

/**
 * Schema de registro de usuário (`POST /api/auth/register`).
 *
 * Aplicações:
 *   - Server-side: usado pelo route handler em
 *     `src/app/api/auth/register/route.ts` antes de qualquer escrita no
 *     banco.
 *   - Client-side: pode ser consumido pelo formulário de `/cadastro`
 *     (Task 3.9) com `react-hook-form` + `zodResolver` para feedback
 *     imediato sem round-trip.
 */
export const registerSchema = z.object({
  name: z
    .string({ error: REGISTER_VALIDATION_MESSAGES.name.required })
    .trim()
    .min(NAME_MIN_LENGTH, { message: REGISTER_VALIDATION_MESSAGES.name.tooShort })
    .max(NAME_MAX_LENGTH, { message: REGISTER_VALIDATION_MESSAGES.name.tooLong }),

  email: z
    .string({ error: REGISTER_VALIDATION_MESSAGES.email.required })
    .trim()
    .min(1, { message: REGISTER_VALIDATION_MESSAGES.email.required })
    .email({ message: REGISTER_VALIDATION_MESSAGES.email.invalid })
    // Normaliza após validar: garante consistência com o login
    // (`auth.ts.authorize` faz `email.trim().toLowerCase()`).
    .transform((value) => value.toLowerCase()),

  password: z
    .string({ error: REGISTER_VALIDATION_MESSAGES.password.required })
    .min(PASSWORD_MIN_LENGTH, {
      message: REGISTER_VALIDATION_MESSAGES.password.tooShort,
    })
    .max(PASSWORD_MAX_LENGTH, {
      message: REGISTER_VALIDATION_MESSAGES.password.tooLong,
    })
    // Refines separados → mensagens específicas por classe ausente.
    .refine((value) => /[A-Z]/.test(value), {
      message: REGISTER_VALIDATION_MESSAGES.password.missingUppercase,
    })
    .refine((value) => /[a-z]/.test(value), {
      message: REGISTER_VALIDATION_MESSAGES.password.missingLowercase,
    })
    .refine((value) => /\d/.test(value), {
      message: REGISTER_VALIDATION_MESSAGES.password.missingDigit,
    }),
});

/**
 * Tipo do payload validado pelo `registerSchema`. Note que `email` já é
 * lowercase aqui (o `transform` é refletido no `z.infer`).
 */
export type RegisterInput = z.infer<typeof registerSchema>;
