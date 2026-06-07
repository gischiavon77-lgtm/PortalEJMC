/**
 * `GET /api/services` e `POST /api/services` — Task 12.1.
 *
 * GET — lista todos os serviços do portfólio, ordenados alfabeticamente
 * por nome, com paginação (default 50 por página). Qualquer usuário
 * autenticado pode consumir este endpoint.
 *
 * POST — cria um novo serviço. Apenas Admin/Diretor via RBAC
 * `service:write` (Req 13.3).
 *
 * Resposta do GET:
 *   200 { services, pagination: { page, pageSize, total, totalPages } }
 *
 * Resposta do POST:
 *   201 { service }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { createServiceSchema, listServicesQuerySchema } from '@/lib/validators/service';

export const runtime = 'nodejs';

/**
 * Serializa um serviço para JSON (datas como ISO string).
 */
function serializeService(service: {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    createdAt: service.createdAt.toISOString(),
    updatedAt: service.updatedAt.toISOString(),
  };
}

// ─── GET ─────────────────────────────────────────────────────────────

async function listHandler(
  req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  let parsed: { page: number; pageSize: number };
  try {
    parsed = listServicesQuerySchema.parse(queryParams);
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

  const { page, pageSize } = parsed;
  const skip = (page - 1) * pageSize;

  const [services, total] = await Promise.all([
    prisma.service.findMany({
      orderBy: { name: 'asc' },
      skip,
      take: pageSize,
    }),
    prisma.service.count(),
  ]);

  return NextResponse.json(
    {
      services: services.map(serializeService),
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

async function createHandler(
  req: NextRequest,
  _ctx: { session: import('next-auth').Session },
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

  let payload: { name: string; description: string };
  try {
    payload = createServiceSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Dados do serviço inválidos.',
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

  const created = await prisma.service.create({
    data: {
      name: payload.name,
      description: payload.description,
    },
  });

  return NextResponse.json({ service: serializeService(created) }, { status: 201 });
}

export const POST = withAuth('service:write', createHandler);
