'use client';

/**
 * SessionProvider — wrapper client-side do contexto de sessão NextAuth.
 *
 * Task 4.5: o hook `usePermission()` (e qualquer outro consumidor de
 * `useSession()` do `next-auth/react`) precisa de um `<SessionProvider>`
 * no topo da árvore React. Como o NextAuth v5 expõe o provider apenas
 * em `next-auth/react` (módulo client-only), envolvemos a importação
 * em um Client Component próprio para que o `app/layout.tsx`
 * (Server Component por padrão) possa importá-lo sem precisar de
 * `'use client'` no layout inteiro.
 *
 * ─── Por que um wrapper, e não importar direto no layout? ───────────
 *
 * Em Next.js App Router:
 *   - Server Components são o padrão; eles **podem** renderizar
 *     Client Components, mas **não** podem importar módulos marcados
 *     como `'use client'` que dependem de hooks (caso do
 *     `SessionProvider` original — usa `React.Context`).
 *   - A boundary "client" precisa partir de um arquivo com diretiva
 *     `'use client'`. Esse arquivo é justamente este wrapper.
 *
 * Resultado: o subtree autenticado roda como client (necessário para
 * `useSession`), enquanto o restante do layout permanece como Server
 * Component, mantendo SSR/streaming inalterados.
 *
 * ─── Por que reexportar `SessionProvider` (nomeado) e não usar `Provider`? ─
 *
 * Mantemos o nome `SessionProvider` para preservar a familiaridade com
 * a API do NextAuth e para que IDEs sugiram o componente correto ao
 * pesquisar por "SessionProvider" no codebase.
 */

import { SessionProvider as NextAuthSessionProvider } from 'next-auth/react';
import type { ReactNode } from 'react';

import { SessionExpiredWatcher } from './SessionExpiredWatcher';

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  // Não passamos `session` (que viria de `auth()` no server). Quando
  // ausente, o NextAuth busca via `/api/auth/session` no primeiro
  // mount — comportamento adequado a páginas que misturam segmentos
  // públicos e autenticados sem hidratação prévia. Páginas que já
  // dispõem da session no server podem repassar via prop sem alteração
  // aqui, pois delegamos toda a API ao provider original.
  //
  // O `SessionExpiredWatcher` é um componente "headless" (Task 4.6)
  // que observa transições `authenticated → unauthenticated` via
  // `useSession()` e redireciona para `/login?error=SessionExpired`
  // quando o token JWT é invalidado mid-navegação pelo guard de
  // inatividade de 8h em `auth.config.ts`. Centralizá-lo aqui garante
  // que toda rota autenticada herde o comportamento sem modificações
  // pontuais — caminho client-side complementar ao redirect server-side
  // que o middleware (Task 4.3) já realiza para navegações novas.
  return (
    <NextAuthSessionProvider>
      <SessionExpiredWatcher />
      {children}
    </NextAuthSessionProvider>
  );
}
