/**
 * `DELETE /api/polls/:id` — exclusão de enquete.
 *
 * Permissão: Diretor/Gerente via RBAC `poll:delete`.
 *
 * As opções (`PollOption`) e votos (`PollVote`) são removidos em cascata
 * (configurado no schema com `onDelete: Cascade`).
 *
 * Respostas:
 *   200 { success: true }
 *   404 quando a enquete não existe.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type RouteParams = Promise<{ id: string }>;

async function deleteHandler(
  _req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: RouteParams },
): Promise<Response> {
  const params = await ctx.params!;
  const id = params.id;

  const existing = await prisma.poll.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: true, code: 'NOT_FOUND', message: 'Enquete não encontrada.' },
      { status: 404 },
    );
  }

  await prisma.poll.delete({ where: { id } });

  return NextResponse.json({ success: true }, { status: 200 });
}

export const DELETE = withAuth('poll:delete', deleteHandler as Parameters<typeof withAuth>[1]);
