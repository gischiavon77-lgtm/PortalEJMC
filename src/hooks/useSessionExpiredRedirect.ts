'use client';

/**
 * useSessionExpiredRedirect — redireciona para `/login` quando a sessão
 * expira mid-navegação (Task 4.6 / Req 1.3).
 *
 * Contexto:
 *   O middleware (Task 4.3) já cobre o caminho **server-side**: quando
 *   o usuário tenta navegar para uma rota privada sem sessão válida, é
 *   redirecionado para `/login?callbackUrl=...`. O callback `jwt`
 *   (Task 3.4) retorna `null` quando a janela de inatividade de 8h é
 *   excedida, fazendo o NextAuth descartar o cookie e o middleware
 *   disparar o redirect.
 *
 *   Esse caminho, porém, exige uma **navegação nova**. Em uma SPA do
 *   Next.js (App Router), o usuário pode permanecer numa rota privada
 *   por horas sem disparar nenhum request de página. Quando o JWT
 *   callback finalmente invalida o token (após 8h de inatividade), o
 *   `useSession()` do NextAuth detecta a transição e atualiza `status`
 *   de `'authenticated'` para `'unauthenticated'` — momento exato em
 *   que devemos enviar o usuário ao login com a mensagem clara de
 *   sessão expirada (em vez de deixá-lo numa página "viva" cujas APIs
 *   passariam a retornar 401).
 *
 * Estratégia:
 *   - Observa transições de `status` via `useSession()`. Só dispara o
 *     redirect quando há uma transição `authenticated → unauthenticated`,
 *     evitando reagir ao caso "usuário sempre esteve deslogado nesta
 *     sessão de navegação" (que é o caso normal das páginas públicas
 *     `/login` e `/cadastro`).
 *   - Não redireciona se já estivermos em uma rota pública
 *     (`/login`, `/cadastro` ou `/`) — isso evitaria loops e ruído de
 *     UX em páginas que naturalmente aceitam usuários não autenticados.
 *   - Anexa `?error=SessionExpired&callbackUrl=<rota atual>` à URL de
 *     login. O `callbackUrl` permite voltar à página onde o usuário
 *     estava após relogar; o `error` é mapeado por
 *     `resolveErrorMessage` para a mensagem em pt-BR.
 *   - Usa `router.replace` (em vez de `push`) para que o histórico
 *     do navegador não acumule a rota privada original — voltar com o
 *     botão "voltar" deve continuar levando o usuário ao destino que
 *     antecedeu o login, não devolvê-lo a uma rota inacessível.
 *
 * Notas de implementação:
 *   - O hook não retorna nada; é um "side-effect-only" component logic.
 *     Componentes que precisam saber se a sessão expirou devem usar
 *     `useSession()` diretamente (estado já modelado pelo NextAuth).
 *   - Mantemos a lista de rotas públicas como prefixos exatos para
 *     evitar acoplamento ao matcher do middleware. O número é pequeno
 *     e a duplicação é intencional (a fonte da verdade pode divergir
 *     levemente entre client e middleware sem prejudicar a UX).
 */

import { useEffect, useRef } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

import { AUTH_ERROR_CODES } from '@/lib/auth-errors';

/**
 * Rotas públicas onde o redirecionamento NÃO deve ser disparado.
 *
 * - `/login` e `/cadastro` recebem usuários sem sessão por design.
 * - `/` é a landing pública (até que a Task 5 a substitua) e não
 *   exige sessão; o usuário fica nela até clicar para logar.
 *
 * Comparação por prefixo cobre `/login?...` e segmentos futuros que
 * possam existir sob esses grupos.
 */
const PUBLIC_PREFIXES = ['/login', '/cadastro'] as const;

function isPublicRoute(pathname: string | null): boolean {
  if (pathname === null) return true;
  if (pathname === '/') return true;
  return PUBLIC_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export function useSessionExpiredRedirect(): void {
  const router = useRouter();
  const pathname = usePathname();
  const { status } = useSession();

  // Guarda o status anterior para detectar a transição
  // `authenticated → unauthenticated`. `useRef` evita re-renderizações
  // desnecessárias e mantém o valor estável entre execuções do efeito.
  const previousStatusRef = useRef<typeof status | null>(null);

  useEffect(() => {
    const previousStatus = previousStatusRef.current;
    previousStatusRef.current = status;

    // Só agimos na transição autenticado → não autenticado. Outras
    // transições (loading → authenticated, loading → unauthenticated
    // ao abrir o app já deslogado, etc.) são intencionalmente ignoradas.
    if (previousStatus !== 'authenticated' || status !== 'unauthenticated') {
      return;
    }

    // Evita loop em rotas públicas. Se o usuário acabou de fazer
    // logout intencional e foi enviado para `/login`, o status dele
    // será `unauthenticated` enquanto ele estiver lá — não queremos
    // sobrescrever esse fluxo.
    if (isPublicRoute(pathname)) {
      return;
    }

    const callbackUrl = pathname ?? '/dashboard';
    const params = new URLSearchParams({
      error: AUTH_ERROR_CODES.SESSION_EXPIRED,
      callbackUrl,
    });

    // `replace` (não `push`): a página privada onde o usuário estava
    // não deve voltar ao histórico — após relogar, ele será reenviado
    // via `callbackUrl`, então preservar o estado anterior do histórico
    // produz UX mais limpa.
    router.replace(`/login?${params.toString()}`);
  }, [status, pathname, router]);
}
