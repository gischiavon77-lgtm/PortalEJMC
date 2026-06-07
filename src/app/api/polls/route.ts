/**
 * `GET /api/polls` e `POST /api/polls` — Task 15.1.
 *
 * GET — lista todas as enquetes (ativas primeiro, depois encerradas,
 * mais recente primeiro dentro de cada grupo). Inclui opções com
 * contagem de votos e nomes dos votantes, além do ID da opção em que
 * o usuário logado votou (se houver).
 *
 * POST — cria uma nova enquete. Apenas Diretor/Gerente via RBAC
 * `poll:create`.
 *
 * Resposta do GET:
 *   200 { polls: [...] }
 *
 * Resposta do POST:
 *   201 { poll }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { createPollSchema } from '@/lib/validators/poll';

export const runtime = 'nodejs';

// ─── GET ─────────────────────────────────────────────────────────────

async function listHandler(
  _req: NextRequest,
  ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const userId = ctx.session.user.id;

  const polls = await prisma.poll.findMany({
    orderBy: [
      { status: 'asc' }, // ACTIVE first (alphabetically before CLOSED)
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

  const serialized = polls.map((poll) => ({
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

  return NextResponse.json({ polls: serialized }, { status: 200 });
}

export const GET = withAuth(null, listHandler);

// ─── POST ────────────────────────────────────────────────────────────

async function createHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session },
): Promise<Response> {
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

  let payload: { title: string; description: string; options: string[] };
  try {
    payload = createPollSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Dados da enquete inválidos.',
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

  const created = await prisma.poll.create({
    data: {
      title: payload.title,
      description: payload.description,
      createdById: ctx.session.user.id,
      options: {
        create: payload.options.map((text, index) => ({
          text,
          order: index,
        })),
      },
    },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      options: {
        orderBy: { order: 'asc' },
      },
    },
  });

  return NextResponse.json(
    {
      poll: {
        id: created.id,
        title: created.title,
        description: created.description,
        status: created.status,
        createdBy: {
          id: created.createdBy.id,
          name: created.createdBy.name,
        },
        options: created.options.map((opt) => ({
          id: opt.id,
          text: opt.text,
          voteCount: 0,
          votes: [],
        })),
        userVotedOptionId: null,
        createdAt: created.createdAt.toISOString(),
        closedAt: null,
      },
    },
    { status: 201 },
  );
}

export const POST = withAuth('poll:create', createHandler);
