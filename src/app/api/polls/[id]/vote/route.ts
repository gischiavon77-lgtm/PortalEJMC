/**
 * `POST /api/polls/:id/vote` — Tasks 15.1, 15.4.
 *
 * Registra o voto de um usuário autenticado em uma enquete.
 *
 * Regras:
 *   - A enquete deve existir e estar ACTIVE (rejeita votos em CLOSED).
 *   - O optionId deve pertencer à enquete.
 *   - O usuário só pode votar uma vez por enquete (@@unique([pollId, userId])).
 *   - Qualquer usuário autenticado pode votar (sem permissão extra).
 *
 * Respostas:
 *   201 { vote: { id, pollId, optionId, votedAt } }
 *   400 Dados inválidos / opção não pertence à enquete
 *   404 Enquete não encontrada
 *   409 Usuário já votou nesta enquete
 *   422 Enquete encerrada — não aceita mais votos
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { voteSchema } from '@/lib/validators/poll';

export const runtime = 'nodejs';

type RouteParams = Promise<{ id: string }>;

async function voteHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: RouteParams },
): Promise<Response> {
  const params = await ctx.params!;
  const pollId = params.id;
  const userId = ctx.session.user.id;

  // Parse body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: true,
        code: 'INVALID_JSON',
        message: 'Corpo da requisição inválido. Esperado JSON válido.',
      },
      { status: 400 },
    );
  }

  let payload: { optionId: string };
  try {
    payload = voteSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Dados de votação inválidos.',
          fields: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    throw err;
  }

  // Fetch poll with options
  const poll = await prisma.poll.findUnique({
    where: { id: pollId },
    include: {
      options: { select: { id: true } },
    },
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

  // Check poll is active
  if (poll.status === 'CLOSED') {
    return NextResponse.json(
      {
        error: true,
        code: 'POLL_CLOSED',
        message: 'Esta enquete já foi encerrada e não aceita mais votos.',
      },
      { status: 422 },
    );
  }

  // Check optionId belongs to poll
  const validOptionIds = poll.options.map((o) => o.id);
  if (!validOptionIds.includes(payload.optionId)) {
    return NextResponse.json(
      {
        error: true,
        code: 'INVALID_OPTION',
        message: 'A opção selecionada não pertence a esta enquete.',
      },
      { status: 400 },
    );
  }

  // Create or update vote (upsert allows changing vote)
  try {
    const vote = await prisma.pollVote.upsert({
      where: {
        pollId_userId: {
          pollId,
          userId,
        },
      },
      update: {
        optionId: payload.optionId,
      },
      create: {
        pollId,
        optionId: payload.optionId,
        userId,
      },
    });

    return NextResponse.json(
      {
        vote: {
          id: vote.id,
          pollId: vote.pollId,
          optionId: vote.optionId,
          votedAt: vote.votedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    throw err;
  }
}

export const POST = withAuth(null, voteHandler as Parameters<typeof withAuth>[1]);
