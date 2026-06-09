import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { EnquetesShell } from '@/components/enquetes/EnquetesShell';
import type { PollItem } from '@/components/enquetes/PollCard';

/**
 * `/enquetes` — Página de enquetes (Task 15.3).
 *
 * Server Component que carrega todas as enquetes diretamente do Prisma.
 * Ordenação: ativas primeiro, depois encerradas; mais recente primeiro
 * dentro de cada grupo. Inclui opções com votos e nomes dos votantes.
 */

export const metadata: Metadata = {
  title: 'Enquetes',
  description: 'Enquetes e votações do Portal Interno EJMC.',
};

export const dynamic = 'force-dynamic';

export default async function EnquetesPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const userId = session.user.id;

  let serialized: PollItem[] = [];
  try {
    const polls = await prisma.poll.findMany({
      orderBy: [
        { status: 'asc' }, // ACTIVE before CLOSED (alphabetically)
        { createdAt: 'desc' },
      ],
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
        options: {
          orderBy: { order: 'asc' },
          include: {
            votes: {
              include: {
                user: {
                  select: { id: true, name: true },
                },
              },
            },
          },
        },
        votes: {
          where: { userId },
          select: { optionId: true },
          take: 1,
        },
      },
    });

    // Serialize for Client Component
    serialized = polls.map((poll) => ({
      id: poll.id,
      title: poll.title,
      description: poll.description,
      status: poll.status,
      createdBy: {
        id: poll.createdBy.id,
        name: poll.createdBy.name,
      },
      options: poll.options.map((opt) => ({
        id: opt.id,
        text: opt.text,
        voteCount: opt.votes.length,
        votes: opt.votes.map((v) => ({
          id: v.user.id,
          name: v.user.name,
        })),
      })),
      userVotedOptionId: poll.votes[0]?.optionId ?? null,
      createdAt: poll.createdAt.toISOString(),
      closedAt: poll.closedAt?.toISOString() ?? null,
    }));
  } catch (err) {
    console.error('[enquetes] DB error:', err);
    serialized = [];
  }

  return <EnquetesShell polls={serialized} />;
}
