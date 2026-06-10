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
import { z, ZodError } from 'zod';

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

// ─── POST ────────────────────────────────────────────────────────────

/**
 * `POST /api/projects` — Cria um novo projeto.
 *
 * Apenas Admin pode criar projetos (permission: project:updateStatus).
 *
 * Body:
 *   - `name`        → string, obrigatório, max 200 chars.
 *   - `description` → string, opcional, max 2000 chars.
 *
 * Resposta:
 *   201 { project: { id, name, description, status, createdAt } }
 *   400 se validação falhar
 */

const createProjectSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Nome é obrigatório.')
    .max(200, 'Nome deve ter no máximo 200 caracteres.'),
  description: z
    .string()
    .trim()
    .max(2000, 'Descrição deve ter no máximo 2000 caracteres.')
    .optional()
    .nullable(),
});

async function createHandler(
  req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: true, code: 'BAD_REQUEST', message: 'Corpo da requisição inválido.' },
      { status: 400 },
    );
  }

  let parsed: { name: string; description?: string | null };
  try {
    parsed = createProjectSchema.parse(body);
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

  const project = await prisma.project.create({
    data: {
      name: parsed.name,
      description: parsed.description ?? null,
      status: 'EM_ANDAMENTO',
    },
    select: {
      id: true,
      name: true,
      description: true,
      status: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    {
      project: {
        id: project.id,
        name: project.name,
        description: project.description,
        status: project.status,
        createdAt: project.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}

export const POST = withAuth('project:updateStatus', createHandler);
