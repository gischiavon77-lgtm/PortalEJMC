/**
 * `PATCH /api/calendar/events/:id` e `DELETE /api/calendar/events/:id`
 * — Task 7.2.
 *
 * PATCH — atualiza título/datas. Apenas Coordenador+ via RBAC
 * `calendar:update`. Dispara `syncUpdatedEvent` para reespelhar a
 * mudança no Google.
 *
 * DELETE — remove o evento do banco. Apenas Coordenador+ via RBAC
 * `calendar:delete`. Tenta remover o espelho remoto ANTES de excluir
 * a linha local (idempotente: 404 do Google é tratado como sucesso
 * dentro de `deleteGoogleEvent`). Se a chamada remota falhar, ainda
 * removemos a linha local — ver decisão "soft-delete" no cabeçalho
 * de `calendar-sync.ts` para o trade-off envolvido.
 *
 * Resposta de PATCH:
 *   200 { event, sync: { status, googleEventId, error? } }
 *
 * Resposta de DELETE:
 *   200 { sync: { status, error? } }
 *   404 quando o evento não existe.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { syncDeletedEvent, syncUpdatedEvent } from '@/lib/calendar-sync';
import { updateEventSchema } from '@/lib/validators/calendar';

export const runtime = 'nodejs';

interface EventRouteParams {
  id: string;
}

function serializeEvent(event: {
  id: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  googleEventId: string | null;
  syncStatus: string;
  syncRetries: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: event.id,
    title: event.title,
    startsAt: event.startsAt.toISOString(),
    endsAt: event.endsAt.toISOString(),
    googleEventId: event.googleEventId,
    syncStatus: event.syncStatus,
    syncRetries: event.syncRetries,
    createdById: event.createdById,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

function notFoundResponse(): Response {
  return NextResponse.json(
    {
      error: true,
      code: 'NOT_FOUND',
      message: 'Evento não encontrado.',
    },
    { status: 404 },
  );
}

// ─── PATCH ───────────────────────────────────────────────────────────

async function patchHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: EventRouteParams },
): Promise<Response> {
  const id = ctx.params?.id;
  if (!id) {
    return notFoundResponse();
  }

  const existing = await prisma.event.findUnique({ where: { id } });
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

  let payload: Partial<{ title: string; startsAt: Date; endsAt: Date; description?: string }>;
  try {
    payload = updateEventSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Dados do evento inválidos.',
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

  // Validação cruzada: se apenas um dos campos vier no payload, conferir
  // contra o registro persistido. O schema só consegue validar quando
  // ambos os campos vêm juntos.
  const newStart = payload.startsAt ?? existing.startsAt;
  const newEnd = payload.endsAt ?? existing.endsAt;
  if (newEnd.getTime() <= newStart.getTime()) {
    return NextResponse.json(
      {
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Dados do evento inválidos.',
        fields: [
          {
            path: 'endsAt',
            message: 'A data/hora de fim deve ser posterior à de início.',
          },
        ],
      },
      { status: 400 },
    );
  }

  await prisma.event.update({
    where: { id },
    data: {
      ...(payload.title !== undefined ? { title: payload.title } : {}),
      ...(payload.startsAt !== undefined ? { startsAt: payload.startsAt } : {}),
      ...(payload.endsAt !== undefined ? { endsAt: payload.endsAt } : {}),
      // Reseta para 'pending' enquanto a sincronização não confirma.
      // O syncRetries volta a 0 — a edição é uma nova "rodada".
      syncStatus: 'pending',
      syncRetries: 0,
    },
  });

  const syncResult = await syncUpdatedEvent(id);
  const refreshed = await prisma.event.findUniqueOrThrow({ where: { id } });

  return NextResponse.json(
    {
      event: serializeEvent(refreshed),
      sync: {
        status: syncResult.syncStatus,
        googleEventId: syncResult.googleEventId,
        ...(syncResult.error
          ? { error: { code: syncResult.error.code, message: syncResult.error.message } }
          : {}),
      },
    },
    { status: 200 },
  );
}

export const PATCH = withAuth<EventRouteParams>('calendar:update', patchHandler);

// ─── DELETE ──────────────────────────────────────────────────────────

async function deleteHandler(
  _req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: EventRouteParams },
): Promise<Response> {
  const id = ctx.params?.id;
  if (!id) {
    return notFoundResponse();
  }

  const existing = await prisma.event.findUnique({ where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

  // 1. Tenta remover do Google primeiro. `syncDeletedEvent` nunca lança.
  const syncResult = await syncDeletedEvent(existing.googleEventId);

  // 2. Remove a linha local independentemente do resultado remoto.
  //    Trade-off: se o Google estiver fora do ar, o espelho remoto fica
  //    órfão até intervenção manual. A alternativa seria manter a
  //    linha em `failed` aguardando retry — mas isso exigiria um
  //    estado "pending-delete" no schema, fora do escopo da Task 7.
  await prisma.event.delete({ where: { id } });

  return NextResponse.json(
    {
      sync: {
        status: syncResult.syncStatus,
        ...(syncResult.error
          ? { error: { code: syncResult.error.code, message: syncResult.error.message } }
          : {}),
      },
    },
    { status: 200 },
  );
}

export const DELETE = withAuth<EventRouteParams>('calendar:delete', deleteHandler);
