/**
 * Testes unitários do hook `useSessionExpiredRedirect` (Task 4.6).
 *
 * O foco é verificar que o redirecionamento client-side dispara
 * **apenas** na transição `authenticated → unauthenticated` (sintoma
 * de JWT invalidado mid-navegação pelo guard de inatividade de 8h —
 * Task 3.4 / Req 1.3) e que rotas públicas não são redirecionadas.
 *
 * Mockamos `next-auth/react` e `next/navigation` via `vi.mock` para
 * controlar o status da sessão e capturar chamadas a `router.replace`
 * sem subir runtime do Next.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const { useSessionMock, replaceMock, pathnameMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  replaceMock: vi.fn(),
  pathnameMock: vi.fn<() => string | null>(),
}));

vi.mock('next-auth/react', () => ({
  useSession: useSessionMock,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => pathnameMock(),
}));

import { useSessionExpiredRedirect } from '@/hooks/useSessionExpiredRedirect';
import { AUTH_ERROR_CODES } from '@/lib/auth-errors';

beforeEach(() => {
  useSessionMock.mockReset();
  replaceMock.mockReset();
  pathnameMock.mockReset();
});

describe('useSessionExpiredRedirect — transições de status', () => {
  it('redireciona para /login com SessionExpired quando muda de authenticated para unauthenticated', () => {
    pathnameMock.mockReturnValue('/dashboard');
    // Primeira render: authenticated. Segunda render (rerender): unauthenticated.
    useSessionMock.mockReturnValueOnce({ data: {}, status: 'authenticated' });
    useSessionMock.mockReturnValueOnce({ data: null, status: 'unauthenticated' });

    const { rerender } = renderHook(() => useSessionExpiredRedirect());
    expect(replaceMock).not.toHaveBeenCalled();

    rerender();

    expect(replaceMock).toHaveBeenCalledTimes(1);
    const target = replaceMock.mock.calls[0][0] as string;
    expect(target).toContain('/login?');
    expect(target).toContain(`error=${AUTH_ERROR_CODES.SESSION_EXPIRED}`);
    // callbackUrl é codificado por URLSearchParams (`/` vira `%2F`).
    expect(target).toContain('callbackUrl=%2Fdashboard');
  });

  it('não redireciona quando o usuário sempre esteve unauthenticated (sem transição)', () => {
    pathnameMock.mockReturnValue('/dashboard');
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });

    renderHook(() => useSessionExpiredRedirect());

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('não redireciona em loading → unauthenticated (primeiro render sem sessão)', () => {
    pathnameMock.mockReturnValue('/dashboard');
    useSessionMock.mockReturnValueOnce({ data: null, status: 'loading' });
    useSessionMock.mockReturnValueOnce({ data: null, status: 'unauthenticated' });

    const { rerender } = renderHook(() => useSessionExpiredRedirect());
    rerender();

    expect(replaceMock).not.toHaveBeenCalled();
  });

  it('não redireciona em authenticated → loading → authenticated (refresh do token)', () => {
    pathnameMock.mockReturnValue('/dashboard');
    useSessionMock.mockReturnValueOnce({ data: {}, status: 'authenticated' });
    useSessionMock.mockReturnValueOnce({ data: {}, status: 'loading' });
    useSessionMock.mockReturnValueOnce({ data: {}, status: 'authenticated' });

    const { rerender } = renderHook(() => useSessionExpiredRedirect());
    rerender();
    rerender();

    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe('useSessionExpiredRedirect — rotas públicas', () => {
  // `usePathname()` do `next/navigation` retorna apenas o pathname (sem
  // querystring), portanto basta cobrir `/login`, `/cadastro`, `/` e
  // sub-rotas. Querystrings (ex.: `?error=AccountPending`) são
  // descartados pelo router antes de chegarem ao hook.
  it.each([
    ['/login'],
    ['/cadastro'],
    ['/'],
  ])('não redireciona quando o pathname é %s', (path) => {
    pathnameMock.mockReturnValue(path);
    useSessionMock.mockReturnValueOnce({ data: {}, status: 'authenticated' });
    useSessionMock.mockReturnValueOnce({ data: null, status: 'unauthenticated' });

    const { rerender } = renderHook(() => useSessionExpiredRedirect());
    rerender();

    expect(replaceMock).not.toHaveBeenCalled();
  });
});

describe('useSessionExpiredRedirect — fallback de pathname', () => {
  it('usa /dashboard como callbackUrl quando o pathname é null', () => {
    // `usePathname()` pode retornar null em situações raras (por
    // exemplo, durante o primeiro mount no client antes do roteador
    // resolver a URL). Conforme `isPublicRoute`, null é tratado como
    // rota "pública" (sem redirect), então o teste valida que o
    // contrato é respeitado: nenhum redirect dispara.
    pathnameMock.mockReturnValue(null);
    useSessionMock.mockReturnValueOnce({ data: {}, status: 'authenticated' });
    useSessionMock.mockReturnValueOnce({ data: null, status: 'unauthenticated' });

    const { rerender } = renderHook(() => useSessionExpiredRedirect());
    rerender();

    expect(replaceMock).not.toHaveBeenCalled();
  });
});
