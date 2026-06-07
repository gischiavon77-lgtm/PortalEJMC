/**
 * `GET /api/projects` — Task 13.1.
 *
 * Lista todos os projetos, ordenados alfabeticamente por nome, com
 * paginação (default 50 por página) e filtro opcional por status.
 *
 * Qualquer usuário autenticado pode consumir este endpoint.
 *
 * Query params:
 *   - `status`   → EM_ANDAMENTO | CONCLUIDO | CONGELADO | CANCELADO (opcional)
 *   - `page`     → inteiro ≥ 1 (default 1)
 *   - `pageSize` → inteiro 1–100 (default 50)
 *
 * Resposta:
 *   200 { projects, pagination: { page, pageSize, total, totalPages } }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { listProjectsQuerySchema } from '@/lib/validators/project';
import type { ProjectStatus } from '@prisma/client';

export const runtime = 'nodejs';

/**
 * Serializa um projeto para a listagem (campos resumidos).
 */
function serializeProjectListItem(project: {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: Date;
}) {
  return {
    id: project.id,
    name: project.name,
    status: project.status,
    createdAt: project.createdAt.toISOString(),
  };
}

// ─── GET ─────────────────────────────────────────────────────────────

async function listHandler(
  req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  let parsed: { status?: string; page: number; pageSize: number };
  try {
    parsed = listProjectsQuerySchema.parse(queryParams);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de consulta inválidos.',
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

  const { status, page, pageSize } = parsed;
  const skip = (page - 1) * pageSize;

  const where = status ? { status: status as ProjectStatus } : {};

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: pageSize,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.project.count({ where }),
  ]);

  return NextResponse.json(
    {
      projects: projects.map(serializeProjectListItem),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    },
    { status: 200 },
  );
}

export const GET = withAuth(null, listHandler);
