/**
 * `PATCH /api/polls/:id/close` — Tasks 15.1, 15.6.
 *
 * Encerra uma enquete. Apenas Diretor/Gerente via RBAC `poll:close`.
 *
 * Regras:
 *   - A enquete deve existir.
 *   - A enquete deve estar ACTIVE (não pode encerrar uma já encerrada).
 *   - Define status = CLOSED e closedAt = now().
 *
 * Respostas:
 *   200 { poll: { id, status, closedAt } }
 *   404 Enquete não encontrada
 *   422 Enquete já está encerrada
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type RouteParams = Promise<{ id: string }>;

async function closeHandler(
  _req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: RouteParams },
): Promise<Response> {
  const params = await ctx.params!;
  const pollId = params.id;

  // Fetch poll
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    select: { id: true, status: true },
  });

  if (!poll) {
    return NextResponse.json(
      {
        error: true,
        code: 'NOT_FOUND',
        message: 'Enquete não encontrada.',
      },
      { status: 404 },
    );
  }

  if (poll.status === 'CLOSED') {
    return NextResponse.json(
      {
        error: true,
        code: 'ALREADY_CLOSED',
        message: 'Esta enquete já está encerrada.',
      },
      { status: 422 },
    );
  }

  const updated = await prisma.poll.update({
    where: { id: pollId },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
    },
  });

  return NextResponse.json(
    {
      poll: {
        id: updated.id,
        status: updated.status,
        closedAt: updated.closedAt?.toISOString() ?? null,
      },
    },
    { status: 200 },
  );
}

export const PATCH = withAuth('poll:close', closeHandler as Parameters<typeof withAuth>[1]);
