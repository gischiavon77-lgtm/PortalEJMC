/**
 * Mapeamento de códigos de erro do NextAuth para mensagens amigáveis em pt-BR
 * exibidas pela página `/login` (Task 3.8 / 3.11).
 *
 * Por que o helper vive em arquivo próprio?
 *   `LoginForm.tsx` é um componente cliente (`'use client'`). Extrair a lógica
 *   pura de mapeamento para este módulo nos permite testá-la em isolamento
 *   (`tests/unit/login-error-messages.test.ts`) sem montar o formulário, e
 *   mantém uma fronteira clara onde o **contrato da mensagem genérica**
 *   (Task 3.11 / Property 1 / Req 1.2) é enforced no cliente.
 *
 * Contrato preservado aqui (Property 1 — Req 1.2):
 *   1. Para QUALQUER código que não esteja explicitamente mapeado a uma
 *      mensagem específica, devolvemos `GENERIC_CREDENTIALS_MESSAGE`. Isso
 *      garante indistinguibilidade entre "email não cadastrado" e "senha
 *      incorreta": ambos chegam aqui como `CredentialsSignin` (ou um código
 *      desconhecido, em caso de regressão futura) e ambos viram o mesmo texto.
 *   2. `null`/`undefined` representam "sem erro" e devolvem `null` para que o
 *      banner de erro não seja exibido. Empty string (`''`) é tratada como um
 *      código de erro presente mas vazio — também recai na mensagem genérica,
 *      por segurança (URL `/login?error=` não deve revelar nada).
 *
 * Os códigos específicos mapeados aqui (AccountPending/Inactive/Rejected/Locked)
 * são emitidos por `src/lib/auth.ts` APENAS após a senha já ter sido validada
 * com sucesso, então não violam a Property 1 — somente o dono da conta consegue
 * chegar a vê-los.
 */

import { AUTH_ERROR_CODES } from '@/lib/auth-errors';

/**
 * Mensagem genérica de credenciais inválidas. É a mesma para email
 * inexistente, senha errada e qualquer outro erro não mapeado, para
 * preservar a Property 1 (Req 1.2).
 */
export const GENERIC_CREDENTIALS_MESSAGE =
  'Credenciais inválidas. Verifique seu email e senha.';

/**
 * Mapa de códigos para mensagens. Códigos não presentes aqui caem no
 * fallback genérico via `resolveErrorMessage`.
 */
export const ERROR_MESSAGES: Readonly<Record<string, string>> = {
  [AUTH_ERROR_CODES.ACCOUNT_PENDING]:
    'Sua conta está aguardando aprovação de um administrador.',
  [AUTH_ERROR_CODES.ACCOUNT_INACTIVE]:
    'Esta conta está desativada. Entre em contato com um administrador.',
  [AUTH_ERROR_CODES.ACCOUNT_REJECTED]:
    'Sua solicitação de cadastro foi recusada.',
  [AUTH_ERROR_CODES.ACCOUNT_LOCKED]:
    'Conta bloqueada por excesso de tentativas. Tente novamente em alguns minutos.',
  // Erros emitidos pelo NextAuth quando o callback `signIn` retorna `false`
  // ou quando o OAuth falha/é cancelado pelo usuário (Req 2.5).
  AccessDenied: 'Não foi possível concluir a autenticação com o Google.',
  OAuthCallback: 'A autenticação com o Google não foi concluída.',
  OAuthSignin: 'Não foi possível iniciar a autenticação com o Google.',
  OAuthAccountNotLinked:
    'Esta conta Google não está vinculada a um usuário ativo do Portal.',
  // Fallback explícito do NextAuth para credenciais — mensagem genérica.
  CredentialsSignin: GENERIC_CREDENTIALS_MESSAGE,
};

/**
 * Resolve um código de erro recebido do NextAuth (via `?error=` ou
 * `result.error`) na mensagem a ser exibida ao usuário.
 *
 * Regras:
 *   - `null`/`undefined` → `null` (sem banner de erro).
 *   - Código presente em `ERROR_MESSAGES` → mensagem específica.
 *   - Qualquer outro valor (incluindo string vazia, códigos desconhecidos
 *     e o genérico `CredentialsSignin`) → `GENERIC_CREDENTIALS_MESSAGE`.
 *
 * Esta função é o ponto único onde a Property 1 é enforced no cliente.
 * Validada por `tests/unit/login-error-messages.test.ts`.
 */
export function resolveErrorMessage(
  code: string | null | undefined,
): string | null {
  if (code === null || code === undefined) return null;
  return ERROR_MESSAGES[code] ?? GENERIC_CREDENTIALS_MESSAGE;
}
