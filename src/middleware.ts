/**
 * Middleware Next.js — proteção de rotas autenticadas (Task 4.3).
 *
 * Estratégia (Req 1.3, 4.1, 5.2 + design.md "Middleware (Auth + RBAC)"):
 *
 *   1. **Rotas privadas**: definidas em `PRIVATE_PREFIXES` abaixo. Se o
 *      usuário não tiver sessão válida, redirecionamos para
 *      `/login?callbackUrl=<rota original>` — preservando o destino para
 *      pós-login. A própria leitura/atualização do JWT é feita pelo
 *      callback `jwt` de `auth.config.ts`, que aplica o guard de
 *      inatividade de 8h: se o token está expirado, `req.auth` chega
 *      como `null` aqui e o redirecionamento dispara naturalmente.
 *
 *   2. **Rotas públicas**: `/login`, `/cadastro`, `/api/auth/*` e
 *      qualquer asset estático (gerenciados via `config.matcher`). Não
 *      passam por nenhuma checagem de RBAC. A página raiz (`/`) também
 *      é tratada como pública pelo matcher, deixando a redireção
 *      pós-login para a UI (e evitando loop entre `/` e `/login`).
 *
 *   3. **Restrição de Admin**: `/admin/**` exige
 *      `session.user.role === 'ADMIN'`. Usuários autenticados sem o
 *      papel ADMIN são redirecionados para `/403` (página criada pela
 *      Task 4.7 — até lá, o redirect ainda dispara e o usuário recebe
 *      o 404 padrão do Next, comportamento aceitável durante a fase
 *      intermediária da Task 4).
 *
 * ─── Edge runtime / split de configuração ────────────────────────────
 *
 * Middleware do Next.js roda no Edge Runtime, onde Prisma Client e
 * `bcryptjs` não rodam. Por isso importamos a config de
 * `@/lib/auth.config` (sem providers/credentials que tocam o banco), em
 * vez de `@/lib/auth`. Essa separação é o padrão recomendado pelos
 * docs do NextAuth v5 (https://authjs.dev/guides/edge-compatibility) —
 * detalhes do design vivem no cabeçalho de `auth.config.ts`.
 *
 * O `auth()` retornado por `NextAuth(authConfig)` é um wrapper que: lê
 * o cookie de sessão do request, decodifica o JWT (incluindo a janela
 * rolante implementada pelo callback `jwt`) e expõe o resultado em
 * `req.auth`. O middleware decide o redirecionamento com base nesse
 * objeto e, opcionalmente, no `role` enriquecido pelo `session`.
 *
 * ─── Por que não consumir `hasPermission('admin:access')` aqui? ──────
 *
 * `hasPermission` cobre TODAS as ações do RBAC (Task 4.1) e é a fonte
 * da verdade para checagens de UI/API. Para o middleware, porém, basta
 * o gate "ADMIN sim / não" — usar a função aqui acoplaria o middleware
 * a qualquer mudança futura na ação `admin:access` (que poderia, por
 * exemplo, ser estendida para Diretores no admin geral, mas com o
 * middleware mantendo restrição mais estrita). A checagem direta por
 * role aqui é intencional e mais clara para auditoria de segurança.
 * As demais rotas privadas (que dependem de papéis específicos para
 * AÇÕES dentro delas) continuam sendo defendidas pelas próprias API
 * Routes via `withAuth(action)` (Task 4.4) e por componentes via
 * `usePermission()` (Task 4.5).
 */

import { NextResponse } from 'next/server';
import NextAuth from 'next-auth';

import { authConfig } from '@/lib/auth.config';

const { auth } = NextAuth(authConfig);

/**
 * Prefixos de URL que exigem sessão autenticada. Mantidos como lista
 * explícita para deixar visível em uma única linha quais módulos do
 * Portal são privados — alinhado com o requisito de cobertura completa
 * da Task 4.3 (todos os módulos pós-login do design.md).
 *
 * O `matcher` em `config` abaixo já filtra rotas públicas e estáticas;
 * esta lista existe como segunda camada explícita para que adicionar
 * uma rota privada nova seja uma alteração local e óbvia.
 */
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

/**
 * Retorna `true` se o pathname pertence a uma rota privada (qualquer
 * subrota dos prefixos acima também conta — exatamente o comportamento
 * desejado para grupos como `/projetos/:id`).
 */
function isPrivateRoute(pathname: string): boolean {
  return PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  // Rota pública: deixa passar sem checar sessão. As únicas rotas que
  // chegam até aqui já passaram pelo `matcher`, mas validar `pathname`
  // novamente protege contra ajustes futuros no matcher que ampliem o
  // escopo do middleware sem reabrir esta lógica.
  if (!isPrivateRoute(pathname)) {
    return NextResponse.next();
  }

  // Sem sessão → redireciona para /login preservando o destino em
  // `callbackUrl`. A página de login (Task 3.8) lê esse parâmetro e o
  // repassa ao `signIn(...)` para retomar o fluxo após o login.
  if (!req.auth) {
    const loginUrl = new URL('/login', req.nextUrl.origin);
    loginUrl.searchParams.set('callbackUrl', `${pathname}${search ?? ''}`);
    return NextResponse.redirect(loginUrl);
  }

  // /admin/** exige papel ADMIN. Usuários autenticados sem o papel são
  // enviados a /403 (mensagem genérica — não revelamos qual recurso
  // estava restrito, conforme discutido no design para a página de
  // erro da Task 4.7).
  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (req.auth.user?.role !== 'ADMIN') {
      const forbiddenUrl = new URL('/403', req.nextUrl.origin);
      return NextResponse.redirect(forbiddenUrl);
    }
  }

  return NextResponse.next();
});

/**
 * Matcher do middleware.
 *
 * Excluímos:
 *   - `/api/auth/*`            → endpoints públicos do NextAuth (login,
 *                                callback, signout, providers).
 *   - `_next/static`/_next/image` → assets gerados pelo Next.
 *   - `favicon.ico` e arquivos com extensão (CSS, JS, fontes, imagens)
 *     → servidos como estáticos pelo Next.
 *
 * Tudo o que não bater no matcher entra no middleware e é avaliado por
 * `isPrivateRoute`. Páginas públicas como `/login` e `/cadastro` ainda
 * passam pelo middleware, mas o early-return de `isPrivateRoute === false`
 * libera-as imediatamente — isso evita ter que reproduzir a lista de
 * rotas privadas no matcher (que aceita apenas regex, não paths).
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     *   - api/auth         (NextAuth public endpoints)
     *   - _next/static     (static files)
     *   - _next/image      (image optimization files)
     *   - favicon.ico
     *   - any file with an extension (assets, fonts, images, etc.)
     */
    '/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
};
