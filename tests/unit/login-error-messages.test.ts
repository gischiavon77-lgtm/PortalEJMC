/**
 * Testes unitários do mapeador de mensagens de erro do `LoginForm`
 * (Task 3.11).
 *
 * O foco é proteger a **Property 1** (Req 1.2 — "erro genérico para
 * credenciais inválidas"): a mensagem exibida ao usuário deve ser
 * idêntica para email inexistente, senha errada e qualquer outro código
 * de erro desconhecido. Esses três caminhos chegam ao cliente como
 * `CredentialsSignin`, um código arbitrário (regressão futura) ou string
 * vazia (URL `/login?error=`), respectivamente.
 *
 * A pureza de `resolveErrorMessage` permite testar o contrato sem montar
 * o formulário. Os testes de propriedade exaustivos vivem na Task 20.2.
 */

import { describe, expect, it } from 'vitest';

import {
  ERROR_MESSAGES,
  GENERIC_CREDENTIALS_MESSAGE,
  resolveErrorMessage,
} from '@/components/auth/login-error-messages';
import { AUTH_ERROR_CODES } from '@/lib/auth-errors';

describe('resolveErrorMessage — mensagem genérica (Property 1 / Req 1.2)', () => {
  // **Validates: Requirement 1.2** — credenciais inválidas devem produzir
  // a mesma mensagem, independentemente do motivo real da falha.
  it('retorna a mensagem genérica para "CredentialsSignin"', () => {
    expect(resolveErrorMessage('CredentialsSignin')).toBe(
      GENERIC_CREDENTIALS_MESSAGE,
    );
  });

  it('retorna a mensagem genérica para um código desconhecido', () => {
    expect(resolveErrorMessage('foo-bar-baz')).toBe(GENERIC_CREDENTIALS_MESSAGE);
  });

  it('retorna a mensagem genérica para string vazia', () => {
    // URL `/login?error=` pode chegar com `error` presente mas sem valor.
    // O contrato exige que isso NÃO revele nada além da mensagem genérica.
    expect(resolveErrorMessage('')).toBe(GENERIC_CREDENTIALS_MESSAGE);
  });

  it('produz o mesmo texto para os três caminhos (CredentialsSignin, desconhecido, vazio)', () => {
    // Indistinguibilidade explícita: o invariante central da Property 1
    // é que esses três caminhos sejam observacionalmente idênticos.
    const a = resolveErrorMessage('CredentialsSignin');
    const b = resolveErrorMessage('foo-bar-baz');
    const c = resolveErrorMessage('');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});

describe('resolveErrorMessage — ausência de erro', () => {
  it('retorna null para null', () => {
    expect(resolveErrorMessage(null)).toBeNull();
  });

  it('retorna null para undefined', () => {
    expect(resolveErrorMessage(undefined)).toBeNull();
  });
});

describe('resolveErrorMessage — códigos específicos não recaem no genérico', () => {
  // Esses códigos só são emitidos APÓS validação de senha bem-sucedida
  // (auth.ts) ou em fluxos OAuth, e portanto podem revelar o motivo real
  // sem violar a Property 1.
  it.each([
    [AUTH_ERROR_CODES.ACCOUNT_PENDING],
    [AUTH_ERROR_CODES.ACCOUNT_INACTIVE],
    [AUTH_ERROR_CODES.ACCOUNT_REJECTED],
    [AUTH_ERROR_CODES.ACCOUNT_LOCKED],
    ['AccessDenied'],
    ['OAuthCallback'],
    ['OAuthSignin'],
    ['OAuthAccountNotLinked'],
  ])('retorna a mensagem específica para %s', (code) => {
    expect(resolveErrorMessage(code)).toBe(ERROR_MESSAGES[code]);
    expect(resolveErrorMessage(code)).not.toBe(GENERIC_CREDENTIALS_MESSAGE);
  });
});
