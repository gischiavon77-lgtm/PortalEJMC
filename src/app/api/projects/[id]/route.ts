/**
 * `GET /api/projects/:id` — Task 13.1.
 *
 * Retorna detalhes de um projeto, incluindo membros (com nome, área e
 * cargo) e histórico de alterações de status.
 *
 * Qualquer usuário autenticado pode consumir este endpoint.
 *
 * Resposta:
 *   200 { project: { id, name, description, status, members, statusHistory, createdAt, updatedAt } }
 *   404 { error, code, message } — projeto não encontrado.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface ProjectRouteParams {
  id: string;
}

function notFoundResponse(): Response {
  return NextResponse.json(
    {
      error: true,
      code: 'NOT_FOUND',
      message: 'Projeto não encontrado.',
    },
    { status: 404 },
  );
}

// ─── GET ─────────────────────────────────────────────────────────────

async function getHandler(
  _req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: ProjectRouteParams },
): Promise<Response> {
  const id = ctx.params?.id;
  if (!id) {
    return notFoundResponse();
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              area: true,
              position: true,
            },
          },
        },
      },
      statusHistory: {
        orderBy: { changedAt: 'desc' },
        include: {
          changedBy: {
            select: { id: true, name: true },
          },
        },
      },
    },
  });

  if (!project) {
    return notFoundResponse();
  }

  return NextResponse.json(
    {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        members: project.members.map((m) => ({
          id: m.user.id,
          name: m.user.name,
          area: m.user.area,
          position: m.user.position,
        })),
        statusHistory: project.statusHistory.map((h) => ({
          id: h.id,
          oldStatus: h.oldStatus,
          newStatus: h.newStatus,
          changedBy: h.changedBy.name,
          changedAt: h.changedAt.toISOString(),
        })),
        createdAt: project.createdAt.toISOString(),
        updatedAt: project.updatedAt.toISOString(),
      },
    },
    { status: 200 },
  );
}

export const GET = withAuth<ProjectRouteParams>(null, getHandler);
