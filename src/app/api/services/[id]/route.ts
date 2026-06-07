/**
 * `PATCH /api/services/:id` — Task 12.1.
 *
 * Atualiza um serviço existente no portfólio. Apenas Admin/Diretor via
 * RBAC `service:write` (Req 13.3).
 *
 * Aceita atualização parcial: ao menos um dos campos (`name`,
 * `description`) deve estar presente no payload. As mesmas regras de
 * validação do POST se aplicam aos campos fornecidos.
 *
 * Resposta:
 *   200 { service }      — atualizado com sucesso.
 *   400                  — validação falhou ou JSON inválido.
 *   401                  — sem sessão autenticada.
 *   403                  — sem permissão.
 *   404                  — serviço não encontrado.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { updateServiceSchema } from '@/lib/validators/service';

export const runtime = 'nodejs';

interface ServiceRouteParams {
  id: string;
}

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

function notFoundResponse(): Response {
  return NextResponse.json(
    {
      error: true,
      code: 'NOT_FOUND',
      message: 'Serviço não encontrado.',
    },
    { status: 404 },
  );
}

// ─── PATCH ───────────────────────────────────────────────────────────

async function patchHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: ServiceRouteParams },
): Promise<Response> {
  const id = ctx.params?.id;
  if (!id) {
    return notFoundResponse();
  }

  const existing = await prisma.service.findUnique({ where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

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

  let payload: { name?: string; description?: string };
  try {
    payload = updateServiceSchema.parse(rawBody);
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

  const updated = await prisma.service.update({
    where: { id },
    data: {
      ...(payload.name !== undefined ? { name: payload.name } : {}),
      ...(payload.description !== undefined ? { description: payload.description } : {}),
    },
  });

  return NextResponse.json({ service: serializeService(updated) }, { status: 200 });
}

export const PATCH = withAuth<ServiceRouteParams>('service:write', patchHandler);
