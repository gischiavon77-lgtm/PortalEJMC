/**
 * Testes unitários do `registerSchema` (Task 3.6).
 *
 * Cobre os casos de aceite das mensagens de validação por campo
 * (Req 3.1, 3.6). Os testes de propriedade (Property 4 — combinações
 * exaustivas de nome/email/senha válidos e inválidos) ficam na Task 20.5.
 */

import { describe, expect, it } from 'vitest';

import {
  NAME_MAX_LENGTH,
  PASSWORD_MAX_LENGTH,
  REGISTER_VALIDATION_MESSAGES,
  registerSchema,
} from '@/lib/validators/auth';

const validInput = {
  name: 'Ana Maria',
  email: 'ana@ejmc.com.br',
  password: 'Senha123',
};

function firstMessageFor(
  result: ReturnType<typeof registerSchema.safeParse>,
  path: string,
): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join('.') === path)?.message;
}

describe('registerSchema — entradas válidas', () => {
  it('aceita um payload completo válido', () => {
    const result = registerSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it('faz trim do nome e lowercase do email no resultado', () => {
    const result = registerSchema.safeParse({
      name: '  Ana Maria  ',
      email: '  Ana@EJMC.com.BR  ',
      password: 'Senha123',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.name).toBe('Ana Maria');
      expect(result.data.email).toBe('ana@ejmc.com.br');
    }
  });
});

describe('registerSchema — validação do nome', () => {
  it('rejeita nome com menos de 3 caracteres', () => {
    const result = registerSchema.safeParse({ ...validInput, name: 'Ab' });
    expect(firstMessageFor(result, 'name')).toBe(
      REGISTER_VALIDATION_MESSAGES.name.tooShort,
    );
  });

  it('rejeita nome com mais de 150 caracteres', () => {
    const result = registerSchema.safeParse({
      ...validInput,
      name: 'A'.repeat(NAME_MAX_LENGTH + 1),
    });
    expect(firstMessageFor(result, 'name')).toBe(
      REGISTER_VALIDATION_MESSAGES.name.tooLong,
    );
  });

  it('rejeita nome ausente', () => {
    const { name: _name, ...rest } = validInput;
    const result = registerSchema.safeParse(rest);
    expect(firstMessageFor(result, 'name')).toBe(
      REGISTER_VALIDATION_MESSAGES.name.required,
    );
  });
});

describe('registerSchema — validação do email', () => {
  it('rejeita email sem @', () => {
    const result = registerSchema.safeParse({ ...validInput, email: 'sem-arroba' });
    expect(firstMessageFor(result, 'email')).toBe(
      REGISTER_VALIDATION_MESSAGES.email.invalid,
    );
  });

  it('rejeita string vazia', () => {
    const result = registerSchema.safeParse({ ...validInput, email: '' });
    // O `.min(1)` dispara primeiro com a mensagem de "obrigatório".
    expect(firstMessageFor(result, 'email')).toBe(
      REGISTER_VALIDATION_MESSAGES.email.required,
    );
  });

  it('rejeita email ausente', () => {
    const { email: _email, ...rest } = validInput;
    const result = registerSchema.safeParse(rest);
    expect(firstMessageFor(result, 'email')).toBe(
      REGISTER_VALIDATION_MESSAGES.email.required,
    );
  });
});

describe('registerSchema — validação da senha', () => {
  it('rejeita senha curta', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'Aa1' });
    expect(firstMessageFor(result, 'password')).toBe(
      REGISTER_VALIDATION_MESSAGES.password.tooShort,
    );
  });

  it('rejeita senha excedendo o tamanho máximo', () => {
    const longPassword = 'A'.repeat(PASSWORD_MAX_LENGTH) + 'a1';
    const result = registerSchema.safeParse({ ...validInput, password: longPassword });
    expect(firstMessageFor(result, 'password')).toBe(
      REGISTER_VALIDATION_MESSAGES.password.tooLong,
    );
  });

  it('rejeita senha sem letra maiúscula', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'senha123' });
    expect(firstMessageFor(result, 'password')).toBe(
      REGISTER_VALIDATION_MESSAGES.password.missingUppercase,
    );
  });

  it('rejeita senha sem letra minúscula', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'SENHA123' });
    expect(firstMessageFor(result, 'password')).toBe(
      REGISTER_VALIDATION_MESSAGES.password.missingLowercase,
    );
  });

  it('rejeita senha sem dígito', () => {
    const result = registerSchema.safeParse({ ...validInput, password: 'SenhaForte' });
    expect(firstMessageFor(result, 'password')).toBe(
      REGISTER_VALIDATION_MESSAGES.password.missingDigit,
    );
  });

  it('rejeita senha ausente', () => {
    const { password: _password, ...rest } = validInput;
    const result = registerSchema.safeParse(rest);
    expect(firstMessageFor(result, 'password')).toBe(
      REGISTER_VALIDATION_MESSAGES.password.required,
    );
  });
});
