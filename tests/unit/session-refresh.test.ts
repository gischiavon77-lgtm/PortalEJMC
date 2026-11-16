/**
 * Testes de `refreshTokenFromDatabase` (`src/lib/session-refresh.ts`).
 *
 * Cobrem a regra que faz desativação e rebaixamento valerem na
 * requisição seguinte, sem novo login (Req 4.6, 4.8, 5.4):
 *   - conta que deixou de estar ACTIVE (ou foi removida) → sessão encerrada;
 *   - conta ativa → cargo/área/status do token passam a ser os do banco;
 *   - falha do banco → token mantido (não derruba a sessão de todos).
 *
 * O carregador de usuário é injetado, então não há Prisma nem NextAuth
 * envolvidos — só a regra.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import type { JWT } from 'next-auth/jwt';

import { refreshTokenFromDatabase, type SessionUserState } from '@/lib/session-refresh';

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

function loaderReturning(state: SessionUserState | null) {
  return vi.fn(async (_userId: string) => state);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('refreshTokenFromDatabase', () => {
  it('consulta o banco pelo id do token', async () => {
    const loadUser = loaderReturning({ role: 'DIRETOR', area: 'VENDAS', status: 'ACTIVE' });

    await refreshTokenFromDatabase(makeToken({ id: 'abc-123' }), loadUser);

    expect(loadUser).toHaveBeenCalledTimes(1);
    expect(loadUser).toHaveBeenCalledWith('abc-123');
  });

  it('mantém a sessão e os dados quando nada mudou no banco', async () => {
    const token = makeToken();
    const loadUser = loaderReturning({ role: 'DIRETOR', area: 'VENDAS', status: 'ACTIVE' });

    const result = await refreshTokenFromDatabase(token, loadUser);

    expect(result).toMatchObject({
      id: 'user-1',
      role: 'DIRETOR',
      area: 'VENDAS',
      status: 'ACTIVE',
    });
  });

  it.each(['INACTIVE', 'PENDING', 'REJECTED'] as const)(
    'encerra a sessão (null) quando a conta está %s no banco',
    async (status) => {
      const loadUser = loaderReturning({ role: 'DIRETOR', area: 'VENDAS', status });

      const result = await refreshTokenFromDatabase(makeToken(), loadUser);

      expect(result).toBeNull();
    },
  );

  it('encerra a sessão (null) quando o usuário não existe mais', async () => {
    const result = await refreshTokenFromDatabase(makeToken(), loaderReturning(null));

    expect(result).toBeNull();
  });

  it('aplica o rebaixamento de cargo já nesta leitura', async () => {
    const loadUser = loaderReturning({ role: 'MEMBRO', area: 'VENDAS', status: 'ACTIVE' });

    const result = await refreshTokenFromDatabase(makeToken({ role: 'ADMIN' }), loadUser);

    expect(result?.role).toBe('MEMBRO');
  });

  it('aplica a troca de área (inclusive para "sem área")', async () => {
    const moved = await refreshTokenFromDatabase(
      makeToken({ area: 'VENDAS' }),
      loaderReturning({ role: 'DIRETOR', area: 'GESTAO_PESSOAS', status: 'ACTIVE' }),
    );
    const cleared = await refreshTokenFromDatabase(
      makeToken({ area: 'VENDAS' }),
      loaderReturning({ role: 'DIRETOR', area: null, status: 'ACTIVE' }),
    );

    expect(moved?.area).toBe('GESTAO_PESSOAS');
    expect(cleared?.area).toBeNull();
  });

  it('encerra a sessão quando o token não tem id, sem consultar o banco', async () => {
    const loadUser = loaderReturning({ role: 'ADMIN', area: null, status: 'ACTIVE' });

    const result = await refreshTokenFromDatabase(makeToken({ id: '' }), loadUser);

    expect(result).toBeNull();
    expect(loadUser).not.toHaveBeenCalled();
  });

  it('mantém o token como está se a consulta ao banco falhar', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const token = makeToken({ role: 'GERENTE' });
    const loadUser = vi.fn(async () => {
      throw new Error('banco fora do ar');
    });

    const result = await refreshTokenFromDatabase(token, loadUser);

    expect(result).toBe(token);
    expect(result?.role).toBe('GERENTE');
    expect(errorSpy).toHaveBeenCalled();
  });
});
