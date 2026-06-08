/**
 * Middleware Next.js — proteção de rotas autenticadas (Task 4.3).
 *
 * Versão simplificada que verifica a existência do cookie de sessão
 * sem reprocessar/reemitir o JWT (evita erro 494 REQUEST_HEADER_TOO_LARGE
 * na Vercel causado por Set-Cookie excessivo).
 *
 * A validação real do JWT (expiração, inatividade) fica no layout
 * `(portal)/layout.tsx` via `auth()` server-side.
 */

import { NextResponse, type NextRequest } from 'next/server';

const PRIVATE_PREFIXES = [
  '/dashboard',
  '/cronograma',
  '/metas',
  '/kpis',
  '/membros',
  '/perfil',
  '/portfolio',
  '/projetos',
  '/comunicados',
  '/enquetes',
  '/pontuacao',
  '/reservas',
  '/configuracoes',
  '/admin',
] as const;

function isPrivateRoute(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

/**
 * Verifica se existe cookie de sessão do NextAuth.
 * NextAuth v5 usa `authjs.session-token` (produção HTTPS) ou
 * `next-auth.session-token` (dev HTTP).
 */
function hasSessionCookie(req: NextRequest): boolean {
  return (
    req.cookies.has('authjs.session-token') ||
    req.cookies.has('__Secure-authjs.session-token') ||
    req.cookies.has('next-auth.session-token') ||
    req.cookies.has('__Secure-next-auth.session-token')
  );
}

export function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;

  // Rota pública: deixa passar
  if (!isPrivateRoute(pathname)) {
    return NextResponse.next();
  }

  // Sem cookie de sessão → redireciona para /login
  if (!hasSessionCookie(req)) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${search ?? ''}`);
    return NextResponse.redirect(loginUrl);
  }

  // Sessão existe — deixa o layout server-side validar role/expiração
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)'],
};
