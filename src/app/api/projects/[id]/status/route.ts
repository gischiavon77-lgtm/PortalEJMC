/**
 * `PATCH /api/projects/:id/status` — Task 13.1.
 *
 * Altera o status de um projeto. Somente ADMIN via RBAC
 * `project:updateStatus` (Req 14.4, Property 7).
 *
 * Registra a mudança em `ProjectStatusHistory` com o status anterior,
 * novo status, nome do usuário que fez a alteração e timestamp.
 *
 * Body:
 *   { status: "EM_ANDAMENTO" | "CONCLUIDO" | "CONGELADO" | "CANCELADO" }
 *
 * Resposta:
 *   200 { project }      — atualizado com sucesso.
 *   400                  — validação falhou ou JSON inválido.
 *   401                  — sem sessão autenticada.
 *   403                  — sem permissão.
 *   404                  — projeto não encontrado.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { updateProjectStatusSchema } from '@/lib/validators/project';
import type { ProjectStatus } from '@prisma/client';

export const runtime = 'nodejs';

interface StatusRouteParams {
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

// ─── PATCH ───────────────────────────────────────────────────────────

async function patchStatusHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: StatusRouteParams },
): Promise<Response> {
  const id = ctx.params?.id;
  if (!id) {
    return notFoundResponse();
  }

  // Buscar projeto existente
  const existing = await prisma.project.findUnique({
    where: { id },
    select: { id: true, status: true },
  });

  if (!existing) {
    return notFoundResponse();
  }

  // Parsear body
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

  let payload: { status: (typeof import('@/lib/validators/project').PROJECT_STATUSES)[number] };
  try {
    payload = updateProjectStatusSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos.',
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

  const newStatus = payload.status as ProjectStatus;
  const oldStatus = existing.status;
  const changedById = ctx.session.user.id;

  // Atualizar projeto e registrar histórico em uma transação
  const updated = await prisma.$transaction(async (tx) => {
    const project = await tx.project.update({
      where: { id },
      data: { status: newStatus },
    });

    await tx.projectStatusHistory.create({
      data: {
        projectId: id,
        oldStatus,
        newStatus,
        changedById,
      },
    });

    return project;
  });

  return NextResponse.json(
    {
      project: {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        status: updated.status,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    },
    { status: 200 },
  );
}

export const PATCH = withAuth<StatusRouteParams>('project:updateStatus', patchStatusHandler);
