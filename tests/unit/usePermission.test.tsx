/**
 * Testes unitários do hook `usePermission` (Task 4.5).
 *
 * Estratégia de teste:
 *   - Mockamos `next-auth/react` para devolver sessões controladas
 *     via `vi.mock`. Isso isola o hook do runtime de NextAuth e nos
 *     deixa exercitar todos os estados (`loading`, `authenticated`,
 *     `unauthenticated`) deterministicamente.
 *   - `renderHook` do `@testing-library/react` monta o hook em
 *     ambiente jsdom (ver `vitest.config.ts`).
 *   - Para cada estado, validamos `{ allowed, isLoading }` —
 *     contrato exposto pelo hook na Task 4.5.
 *
 * O foco aqui é o comportamento do **hook** (estados de carregamento,
 * negação por ausência de sessão, repasse correto ao núcleo RBAC).
 * A correção da matriz de permissões em si é coberta por
 * `tests/unit/permissions.test.ts`. Evitamos duplicar essa cobertura.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { Session } from 'next-auth';

// Mock module-level. `vi.hoisted` garante que `useSessionMock` exista
// no momento em que o factory roda — necessário porque `vi.mock` é
// içado para o topo do arquivo.
const { useSessionMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: useSessionMock,
}));

import { usePermission, useHasRole } from '@/hooks/usePermission';

/** Helper para construir uma sessão minimamente válida com defaults. */
function makeSession(overrides: Partial<Session['user']> = {}): Session {
  return {
    user: {
      id: 'user-1',
      name: 'Fulano',
      email: 'fulano@ejmc.com',
      role: 'MEMBRO',
      area: null,
      status: 'ACTIVE',
      ...overrides,
    },
    expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };
}

beforeEach(() => {
  useSessionMock.mockReset();
});

describe('usePermission — estados de sessão', () => {
  it('retorna { allowed: false, isLoading: true } enquanto a sessão carrega', () => {
    // Estado inicial do NextAuth no primeiro mount do client. O hook
    // deve sinalizar loading e negar — evita "piscar" UI restrita.
    useSessionMock.mockReturnValue({ data: null, status: 'loading' });

    const { result } = renderHook(() => usePermission('admin:access'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.allowed).toBe(false);
  });

  it('retorna { allowed: false, isLoading: false } quando não há sessão', () => {
    // Usuário deslogado: deny-by-default.
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });

    const { result } = renderHook(() => usePermission('admin:access'));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.allowed).toBe(false);
  });
});

describe('usePermission — repasse à matriz RBAC', () => {
  it('concede ações administrativas a um Admin autenticado', () => {
    useSessionMock.mockReturnValue({
      data: makeSession({ role: 'ADMIN' }),
      status: 'authenticated',
    });

    const { result } = renderHook(() => usePermission('admin:access'));

    expect(result.current.allowed).toBe(true);
    expect(result.current.isLoading).toBe(false);
  });

  it('nega ações administrativas a um Membro comum', () => {
    useSessionMock.mockReturnValue({
      data: makeSession({ role: 'MEMBRO', area: 'VENDAS' }),
      status: 'authenticated',
    });

    const { result } = renderHook(() => usePermission('user:manage'));

    expect(result.current.allowed).toBe(false);
  });

  it('nega criação de enquete a um Coordenador (regra não-monotônica)', () => {
    // Req 16.1: enquetes são exclusivas de Diretor e Gerente.
    // Coordenador, embora opere comunicados, não cria enquetes.
    useSessionMock.mockReturnValue({
      data: makeSession({ role: 'COORDENADOR' }),
      status: 'authenticated',
    });

    const { result } = renderHook(() => usePermission('poll:create'));

    expect(result.current.allowed).toBe(false);
  });

  it('concede criação de infração a um Membro da equipe GP via predicado', () => {
    // Req 18.1: registro de infrações é uma decisão por área, não
    // hierárquica. Um Membro de GP precisa receber `allowed: true`.
    useSessionMock.mockReturnValue({
      data: makeSession({ role: 'MEMBRO', area: 'GESTAO_PESSOAS' }),
      status: 'authenticated',
    });

    const { result } = renderHook(() => usePermission('infraction:create'));

    expect(result.current.allowed).toBe(true);
  });

  it('nega criação de infração a um Diretor fora de GP', () => {
    // Diretor sem GP não passa pela matriz nem pelo predicado de área —
    // a permissão é OU(ADMIN via matriz, GP via predicado).
    useSessionMock.mockReturnValue({
      data: makeSession({ role: 'DIRETOR', area: 'VENDAS' }),
      status: 'authenticated',
    });

    const { result } = renderHook(() => usePermission('infraction:create'));

    expect(result.current.allowed).toBe(false);
  });
});

describe('useHasRole — comparação por nível mínimo', () => {
  it('retorna true quando o papel atende ao mínimo', () => {
    useSessionMock.mockReturnValue({
      data: makeSession({ role: 'DIRETOR' }),
      status: 'authenticated',
    });

    const { result } = renderHook(() => useHasRole('COORDENADOR'));

    expect(result.current.allowed).toBe(true);
  });

  it('retorna false quando o papel está abaixo do mínimo', () => {
    useSessionMock.mockReturnValue({
      data: makeSession({ role: 'MEMBRO' }),
      status: 'authenticated',
    });

    const { result } = renderHook(() => useHasRole('DIRETOR'));

    expect(result.current.allowed).toBe(false);
  });

  it('retorna { allowed: false, isLoading: true } enquanto carrega', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'loading' });

    const { result } = renderHook(() => useHasRole('MEMBRO'));

    expect(result.current.isLoading).toBe(true);
    expect(result.current.allowed).toBe(false);
  });
});
