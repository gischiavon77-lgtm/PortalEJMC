/**
 * Teste de integração leve do callback `jwt` de `src/lib/auth.ts`.
 *
 * Garante a LIGAÇÃO entre o NextAuth e a regra de
 * `src/lib/session-refresh.ts`: o callback usado de verdade pela
 * aplicação consulta o banco nas leituras de sessão e não consulta no
 * login. A regra em si é coberta por `session-refresh.test.ts`.
 *
 * O Prisma é mockado; nenhum banco é acessado.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { JWT } from 'next-auth/jwt';

const { findUniqueMock } = vi.hoisted(() => ({ findUniqueMock: vi.fn() }));

vi.mock('@/lib/prisma', () => ({
  prisma: { user: { findUnique: (...args: unknown[]) => findUniqueMock(...args) } },
}));

// `next-auth` importa `next/server`, que não resolve fora do runtime do
// Next. Como aqui só interessa o objeto `authConfig` (os callbacks), o
// pacote é substituído por um stub mínimo: `NextAuth()` devolve funções
// inertes e `CredentialsSignin` é só a classe-base dos erros de login.
vi.mock('next-auth', () => ({
  default: () => ({ auth: vi.fn(), handlers: {}, signIn: vi.fn(), signOut: vi.fn() }),
  CredentialsSignin: class CredentialsSignin extends Error {},
}));
vi.mock('next-auth/providers/credentials', () => ({
  default: (options: unknown) => ({ id: 'credentials', options }),
}));
vi.mock('next-auth/providers/google', () => ({
  default: (options: unknown) => ({ id: 'google', options }),
}));

import { authConfig } from '@/lib/auth';

type JwtCallback = NonNullable<NonNullable<typeof authConfig.callbacks>['jwt']>;
type JwtParams = Parameters<JwtCallback>[0];

const jwtCallback = authConfig.callbacks?.jwt as JwtCallback;

function makeToken(overrides: Partial<JWT> = {}): JWT {
  return {
    id: 'user-1',
    role: 'DIRETOR',
    area: 'VENDAS',
    status: 'ACTIVE',
    lastActivity: Date.now(),
    ...overrides,
  };
}

beforeEach(() => {
  findUniqueMock.mockReset();
});

describe('callback jwt (auth.ts) — reconsulta no banco', () => {
  it('em leitura de sessão, busca cargo/área/status do usuário pelo id', async () => {
    findUniqueMock.mockResolvedValueOnce({ role: 'MEMBRO', area: 'MARKETING', status: 'ACTIVE' });

    const result = await jwtCallback({ token: makeToken() } as JwtParams);

    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { role: true, area: true, status: true },
    });
    expect(result).toMatchObject({ id: 'user-1', role: 'MEMBRO', area: 'MARKETING' });
  });

  it('devolve null (sessão encerrada) quando a conta foi desativada', async () => {
    findUniqueMock.mockResolvedValueOnce({ role: 'DIRETOR', area: 'VENDAS', status: 'INACTIVE' });

    const result = await jwtCallback({ token: makeToken() } as JwtParams);

    expect(result).toBeNull();
  });

  it('no login, usa os dados recém-validados e não reconsulta o banco', async () => {
    const result = await jwtCallback({
      token: {} as JWT,
      user: { id: 'user-9', role: 'GERENTE', area: 'PROJETOS', status: 'ACTIVE' },
    } as JwtParams);

    expect(findUniqueMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      id: 'user-9',
      role: 'GERENTE',
      area: 'PROJETOS',
      status: 'ACTIVE',
    });
  });
});
