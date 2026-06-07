/**
 * Testes unitários dos validadores de perfil — Task 11.2 (Req 12.3).
 *
 * Cobre os casos de aceitação e rejeição para:
 *   - email (formato RFC 5322 via Zod)
 *   - telefone brasileiro com DDD (10 ou 11 dígitos)
 *   - CPF (11 dígitos + algoritmo módulo 11 + rejeição de dígitos iguais)
 *
 * Os testes de propriedade exaustivos para CPF (Property 12) ficam na Task 20.13.
 */

import { describe, expect, it } from 'vitest';

import {
  PROFILE_VALIDATION_MESSAGES,
  updateProfileSchema,
  validateCpf,
  validatePhone,
} from '@/lib/validators/profile';

// ─── Helpers ────────────────────────────────────────────────────────────────

function firstMessageFor(
  result: ReturnType<typeof updateProfileSchema.safeParse>,
  path: string,
): string | undefined {
  if (result.success) return undefined;
  return result.error.issues.find((issue) => issue.path.join('.') === path)?.message;
}

// ─── validateCpf ─────────────────────────────────────────────────────────────

describe('validateCpf — CPFs válidos', () => {
  it('aceita 529.982.247-25', () => {
    expect(validateCpf('52998224725')).toBe(true);
  });

  it('aceita 111.444.777-35', () => {
    expect(validateCpf('11144477735')).toBe(true);
  });

  it('aceita CPF com máscara (pontos e hífen)', () => {
    expect(validateCpf('529.982.247-25')).toBe(true);
  });
});

describe('validateCpf — CPFs inválidos', () => {
  it('rejeita CPF com todos os dígitos iguais: 111.111.111-11', () => {
    expect(validateCpf('11111111111')).toBe(false);
  });

  it('rejeita CPF com todos os dígitos iguais: 000.000.000-00', () => {
    expect(validateCpf('00000000000')).toBe(false);
  });

  it('rejeita CPF com todos os dígitos iguais: 999.999.999-99', () => {
    expect(validateCpf('99999999999')).toBe(false);
  });

  it('rejeita CPF com menos de 11 dígitos', () => {
    expect(validateCpf('5299822472')).toBe(false);
  });

  it('rejeita CPF com mais de 11 dígitos numéricos', () => {
    expect(validateCpf('529982247250')).toBe(false);
  });

  it('rejeita CPF com primeiro dígito verificador errado', () => {
    // 529.982.247-35 (d1 correto seria 2, não 3)
    expect(validateCpf('52998224735')).toBe(false);
  });

  it('rejeita CPF com segundo dígito verificador errado', () => {
    // 529.982.247-26 (d2 correto seria 5, não 6)
    expect(validateCpf('52998224726')).toBe(false);
  });

  it('rejeita string vazia', () => {
    expect(validateCpf('')).toBe(false);
  });

  it('rejeita string com apenas letras', () => {
    expect(validateCpf('abcdefghijk')).toBe(false);
  });
});

// ─── validatePhone ────────────────────────────────────────────────────────────

describe('validatePhone — telefones válidos', () => {
  it('aceita celular com 11 dígitos (com nono dígito)', () => {
    expect(validatePhone('11999998888')).toBe(true);
  });

  it('aceita fixo com 10 dígitos', () => {
    expect(validatePhone('1133334444')).toBe(true);
  });

  it('aceita telefone formatado: (11) 99999-8888', () => {
    expect(validatePhone('(11) 99999-8888')).toBe(true);
  });

  it('aceita telefone formatado: (11) 3333-4444', () => {
    expect(validatePhone('(11) 3333-4444')).toBe(true);
  });

  it('aceita telefone com espaços: 11 99999-8888', () => {
    expect(validatePhone('11 99999-8888')).toBe(true);
  });
});

describe('validatePhone — telefones inválidos', () => {
  it('rejeita telefone com 9 dígitos (sem DDD)', () => {
    expect(validatePhone('999998888')).toBe(false);
  });

  it('rejeita telefone com 12 dígitos (dígitos demais)', () => {
    expect(validatePhone('119999988880')).toBe(false);
  });

  it('rejeita string vazia', () => {
    expect(validatePhone('')).toBe(false);
  });

  it('rejeita string com apenas letras', () => {
    expect(validatePhone('aaa bbb cccc')).toBe(false);
  });
});

// ─── updateProfileSchema — email ──────────────────────────────────────────────

describe('updateProfileSchema — email', () => {
  it('aceita email válido RFC 5322', () => {
    const result = updateProfileSchema.safeParse({ email: 'usuario@ejmc.com.br' });
    expect(result.success).toBe(true);
  });

  it('normaliza email para lowercase', () => {
    const result = updateProfileSchema.safeParse({ email: 'USUARIO@EJMC.COM.BR' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.email).toBe('usuario@ejmc.com.br');
    }
  });

  it('rejeita email sem @', () => {
    const result = updateProfileSchema.safeParse({ email: 'semArroba.com' });
    expect(firstMessageFor(result, 'email')).toBe(PROFILE_VALIDATION_MESSAGES.email.invalid);
  });

  it('rejeita email sem domínio', () => {
    const result = updateProfileSchema.safeParse({ email: 'usuario@' });
    expect(firstMessageFor(result, 'email')).toBe(PROFILE_VALIDATION_MESSAGES.email.invalid);
  });

  it('rejeita string vazia para email', () => {
    const result = updateProfileSchema.safeParse({ email: '' });
    expect(firstMessageFor(result, 'email')).toBe(PROFILE_VALIDATION_MESSAGES.email.required);
  });
});

// ─── updateProfileSchema — phone ─────────────────────────────────────────────

describe('updateProfileSchema — phone', () => {
  it('aceita celular com 11 dígitos', () => {
    const result = updateProfileSchema.safeParse({ phone: '11999998888' });
    expect(result.success).toBe(true);
  });

  it('aceita fixo com 10 dígitos', () => {
    const result = updateProfileSchema.safeParse({ phone: '1133334444' });
    expect(result.success).toBe(true);
  });

  it('normaliza o telefone para somente dígitos', () => {
    const result = updateProfileSchema.safeParse({ phone: '(11) 99999-8888' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBe('11999998888');
    }
  });

  it('trata string vazia como campo não enviado (undefined)', () => {
    const result = updateProfileSchema.safeParse({ phone: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.phone).toBeUndefined();
    }
  });

  it('rejeita telefone com 9 dígitos (sem DDD)', () => {
    const result = updateProfileSchema.safeParse({ phone: '999998888' });
    expect(firstMessageFor(result, 'phone')).toBe(PROFILE_VALIDATION_MESSAGES.phone.invalid);
  });

  it('rejeita telefone com 12 dígitos', () => {
    const result = updateProfileSchema.safeParse({ phone: '119999988880' });
    expect(firstMessageFor(result, 'phone')).toBe(PROFILE_VALIDATION_MESSAGES.phone.invalid);
  });
});

// ─── updateProfileSchema — cpf ────────────────────────────────────────────────

describe('updateProfileSchema — cpf', () => {
  it('aceita CPF válido', () => {
    const result = updateProfileSchema.safeParse({ cpf: '52998224725' });
    expect(result.success).toBe(true);
  });

  it('aceita CPF com máscara e normaliza para somente dígitos', () => {
    const result = updateProfileSchema.safeParse({ cpf: '529.982.247-25' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cpf).toBe('52998224725');
    }
  });

  it('trata string vazia como campo não enviado (undefined)', () => {
    const result = updateProfileSchema.safeParse({ cpf: '' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.cpf).toBeUndefined();
    }
  });

  it('rejeita CPF com todos os dígitos iguais', () => {
    const result = updateProfileSchema.safeParse({ cpf: '11111111111' });
    expect(firstMessageFor(result, 'cpf')).toBe(PROFILE_VALIDATION_MESSAGES.cpf.invalid);
  });

  it('rejeita CPF com dígitos verificadores errados', () => {
    const result = updateProfileSchema.safeParse({ cpf: '52998224799' });
    expect(firstMessageFor(result, 'cpf')).toBe(PROFILE_VALIDATION_MESSAGES.cpf.invalid);
  });

  it('rejeita CPF com menos de 11 dígitos', () => {
    const result = updateProfileSchema.safeParse({ cpf: '5299822472' });
    expect(firstMessageFor(result, 'cpf')).toBe(PROFILE_VALIDATION_MESSAGES.cpf.invalid);
  });
});

// ─── updateProfileSchema — patch parcial ─────────────────────────────────────

describe('updateProfileSchema — patch parcial (todos os campos opcionais)', () => {
  it('aceita payload vazio (todos os campos opcionais)', () => {
    const result = updateProfileSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it('aceita apenas o nome', () => {
    const result = updateProfileSchema.safeParse({ name: 'João da Silva' });
    expect(result.success).toBe(true);
  });

  it('aceita name + email sem phone/cpf', () => {
    const result = updateProfileSchema.safeParse({
      name: 'Maria Souza',
      email: 'maria@ejmc.com.br',
    });
    expect(result.success).toBe(true);
  });
});
