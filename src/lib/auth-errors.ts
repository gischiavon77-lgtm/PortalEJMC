/**
 * Códigos de erro de autenticação compartilhados entre servidor e cliente.
 *
 * Por que viver em arquivo próprio?
 *   `src/lib/auth.ts` instancia o NextAuth, importa Prisma, bcrypt e
 *   helpers que dependem de Node — toda essa árvore é estritamente
 *   server-only. A página `/login` (Task 3.8) precisa, no client, mapear
 *   códigos como `AccountPending` para mensagens amigáveis em pt-BR.
 *   Centralizar apenas as constantes (sem imports server-only) garante
 *   que o `LoginForm` possa importá-las sem arrastar Prisma/bcrypt
 *   para o bundle do navegador.
 *
 * O módulo `auth.ts` reexporta `AUTH_ERROR_CODES` daqui para que o
 * código existente (e as classes `AccountPendingError` etc.) continue
 * funcionando sem alterações no servidor.
 */

export const AUTH_ERROR_CODES = {
  ACCOUNT_PENDING: 'AccountPending',
  ACCOUNT_INACTIVE: 'AccountInactive',
  ACCOUNT_REJECTED: 'AccountRejected',
  ACCOUNT_LOCKED: 'AccountLocked',
} as const;

export type AuthErrorCode =
  (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];
