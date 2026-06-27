/**
 * `GET /api/notifications` — Feed de notificações do usuário autenticado.
 *
 * Reúne os comunicados e enquetes mais recentes em uma única lista
 * ordenada por data de criação (desc). O cliente (`NotificationBell`)
 * decide o que está "não lido" comparando `createdAt` com um marcador
 * `lastSeen` guardado em `localStorage` — assim não precisamos de uma
 * tabela de leitura por usuário (e nenhuma migração de banco).
 *
 * Resposta:
 *   200 { items: Array<{ id, type, title, createdAt, href }> }
 *
 * Disponível para qualquer usuário autenticado (sem permissão fina) —
 * comunicados e enquetes são visíveis a todos os membros do portal.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

const FEED_LIMIT = 15;

interface NotificationItem {
  id: string;
  type: 'announcement' | 'poll';
  title: string;
  createdAt: string; // ISO
  href: string;
}

async function listHandler(
  _req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const [announcements, polls] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: FEED_LIMIT,
      select: { id: true, title: true, createdAt: true },
    }),
    prisma.poll.findMany({
      orderBy: { createdAt: 'desc' },
      take: FEED_LIMIT,
      select: { id: true, title: true, createdAt: true },
    }),
  ]);

  const items: NotificationItem[] = [
    ...announcements.map((a) => ({
      id: a.id,
      type: 'announcement' as const,
      title: a.title,
      createdAt: a.createdAt.toISOString(),
      href: '/comunicados',
    })),
    ...polls.map((p) => ({
      id: p.id,
      type: 'poll' as const,
      title: p.title,
      createdAt: p.createdAt.toISOString(),
      href: '/enquetes',
    })),
  ]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, FEED_LIMIT);

  return NextResponse.json({ items }, { status: 200 });
}

export const GET = withAuth(null, listHandler);
