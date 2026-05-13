import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';

import { auth } from '@/lib/auth';
import { PortalShell } from '@/components/layout/PortalShell';

/**
 * Layout do grupo de rotas autenticadas `(portal)` (Task 5.2).
 *
 * Server Component — checa a sessão diretamente no servidor e
 * delega o markup interativo a `PortalShell` (`'use client'`). Essa
 * separação preserva os benefícios de SSR/streaming do App Router
 * (Server Components por padrão), enquanto o controle do drawer
 * mobile (Tasks 5.3 e 5.4) vive em uma boundary client mínima.
 *
 * ─── Por que checar `auth()` aqui se já temos o middleware? ─────────
 *
 * O middleware (`src/middleware.ts`, Task 4.3) já redireciona
 * requisições não autenticadas para `/login`. Esta segunda checagem
 * é **defesa em profundidade** (Property/Req 1.1, 1.3 / design.md):
 *
 *   1. **Bypass do matcher**: se o `config.matcher` do middleware for
 *      regredido em alguma manutenção e deixar de cobrir uma rota
 *      privada nova adicionada ao grupo `(portal)`, este layout ainda
 *      bloqueia o render.
 *
 *   2. **Server Components/Server Actions chamados internamente**:
 *      requisições internas (RSC payloads, prefetch) podem alcançar
 *      este layout em alguns cenários sem passar pelo flow normal de
 *      middleware. A redireção via `redirect('/login')` aqui é o
 *      último gate para que `children` nunca renderize sem sessão.
 *
 *   3. **Disponibilidade de `session.user` para RSC**: filhos deste
 *      layout que sejam Server Components recebem implicitamente a
 *      garantia de que `auth()` retornou um usuário válido — o que
 *      simplifica a escrita de páginas como `/dashboard` (Task 6.3),
 *      que podem chamar `auth()` novamente sem precisar lidar com o
 *      caso `null` (eliminando ramos defensivos repetitivos).
 *
 * ─── Fluxo ──────────────────────────────────────────────────────────
 *
 *   1. Lê a sessão via `auth()` (NextAuth v5 expõe esse helper para
 *      ser chamado em RSC, route handlers e middleware).
 *   2. Se não há `session?.user`, redireciona para `/login`. Não
 *      preservamos `callbackUrl` aqui porque o redirect server-side
 *      do middleware já o faz; chegar a este ramo sem sessão é
 *      excepcional, e enviar o usuário para `/login` puro é seguro.
 *   3. Caso contrário, renderiza `PortalShell` envolvendo `children`.
 *
 * Token tipográfico:
 *   - `PortalShell` aplica `bg-surface-bg` e `text-text-primary` no
 *     wrapper raiz (cor de fundo clara do portal, texto escuro), em
 *     conformidade com o design system (`globals.css` — superfícies
 *     do "modo claro" do portal interno).
 */

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  return <PortalShell>{children}</PortalShell>;
}
