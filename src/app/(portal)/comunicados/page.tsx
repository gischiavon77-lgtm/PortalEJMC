import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ComunicadosShell } from '@/components/comunicados/ComunicadosShell';
import type { AnnouncementItem } from '@/components/comunicados/AnnouncementCard';

/**
 * `/comunicados` — Mural de comunicados (Task 14.3).
 *
 * Server Component que carrega os comunicados diretamente do Prisma
 * com paginação (20 por página) e ordenação por createdAt DESC
 * (mais recente primeiro), entregando ao `ComunicadosShell` client-side
 * para interatividade (formulário de criação, paginação).
 */

const PAGE_SIZE = 20;

export const metadata: Metadata = {
  title: 'Comunicados',
  description: 'Mural de comunicados do Portal Interno EJMC.',
};

export const dynamic = 'force-dynamic';

interface ComunicadosPageProps {
  searchParams?: Promise<{ page?: string | string[] }> | { page?: string | string[] };
}

function parsePageParam(raw: string | string[] | undefined): number {
  if (!raw) return 1;
  const str = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseInt(str, 10);
  if (isNaN(parsed) || parsed < 1) return 1;
  return parsed;
}

export default async function ComunicadosPage(props: ComunicadosPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const search = (await Promise.resolve(props.searchParams)) ?? {};
  const page = parsePageParam(search.page);
  const skip = (page - 1) * PAGE_SIZE;

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: PAGE_SIZE,
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.announcement.count(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // Serializa datas para ISO strings (necessário para Client Components).
  const serialized: AnnouncementItem[] = announcements.map((a) => ({
    id: a.id,
    title: a.title,
    content: a.content,
    author: {
      id: a.author.id,
      name: a.author.name,
    },
    createdAt: a.createdAt.toISOString(),
  }));

  return (
    <ComunicadosShell
      announcements={serialized}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
      }}
    />
  );
}
