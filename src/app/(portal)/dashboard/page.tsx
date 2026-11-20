/**
 * `/dashboard` — página inicial em feed (Fase 2 da reforma).
 *
 * Três colunas a partir de 1280px: sidebar (layout) | feed | coluna
 * direita (Mural de Avisos, Destaque do Mês, Próximos Eventos). Abaixo
 * disso a coluna direita vem antes do feed, para não ficar escondida
 * atrás da paginação.
 *
 * Substitui o carrossel de destaques, que foi para `/destaques`.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { HomeFeed } from '@/components/home/HomeFeed';
import { HomeSidebar } from '@/components/home/HomeSidebar';
import { PageHeader } from '@/components/ui';
import { auth } from '@/lib/auth';
import { getHomeSidebar, type HomeSidebarData } from '@/lib/home';
import { listPosts, type PostPage } from '@/lib/posts';
import { prisma } from '@/lib/prisma';

export const metadata: Metadata = {
  title: 'Início',
  description: 'Feed, avisos, destaques e próximos eventos da EJMC.',
};

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const viewer = { id: session.user.id, role: session.user.role, area: session.user.area };

  const [user, firstPage, sidebar] = await Promise.all([
    prisma.user.findUnique({ where: { id: viewer.id }, select: { name: true } }).catch(() => null),
    listPosts(viewer).catch((err): PostPage => {
      console.error('[dashboard] feed:', err);
      return { posts: [], nextCursor: null };
    }),
    getHomeSidebar().catch((err): HomeSidebarData => {
      console.error('[dashboard] coluna lateral:', err);
      return { notices: [], highlights: [], events: [] };
    }),
  ]);

  const firstName = user?.name.trim().split(/\s+/)[0];

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader
        title={firstName ? `Olá, ${firstName}.` : 'Olá.'}
        subtitle="O que está acontecendo na EJMC."
      />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="xl:order-2">
          <div className="xl:sticky xl:top-6">
            <HomeSidebar data={sidebar} />
          </div>
        </div>
        <div className="mx-auto w-full max-w-2xl xl:order-1">
          <HomeFeed initialPage={firstPage} />
        </div>
      </div>
    </div>
  );
}
