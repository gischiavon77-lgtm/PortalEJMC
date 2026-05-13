/**
 * `GET /api/calendar/events` e `POST /api/calendar/events` — Task 7.2.
 *
 * GET — lê os eventos do banco local em uma janela `[startDate, endDate)`
 * (mês corrente como default). Qualquer usuário autenticado pode ler
 * (Req 8.5 — Membro acessa o cronograma em modo leitura).
 *
 * POST — cria um evento. Apenas Coordenador+ (Req 8.2 + RBAC
 * `calendar:create`). Persiste em `syncStatus='pending'` e dispara
 * sincronização inline com o Google Calendar (Tasks 7.3/7.4).
 *
 * ─── Resposta do POST ───────────────────────────────────────────────
 *
 *   201 { event, sync: { status, googleEventId, error? } }
 *
 *   `sync.status` já reflete o estado final pós-tentativa inline:
 *     - 'synced'  → sucesso (modo live ou no-op).
 *     - 'failed'  → falhou; será reagendado por `retrySyncEvents`.
 *
 * Mantemos status 201 mesmo em falha de sincronização porque o evento
 * foi persistido com sucesso no banco — a Req 8.7 manda preservar os
 * dados localmente e tentar novamente. A UI usa `sync.status` para
 * exibir o indicador visual da Task 7.9.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { syncCreatedEvent } from '@/lib/calendar-sync';
import {
  createEventSchema,
  listEventsQuerySchema,
} from '@/lib/validators/calendar';

export const runtime = 'nodejs';

/**
 * Calcula a janela `[firstOfMonth, firstOfNextMonth)` em UTC para
 * usar como default do GET quando o cliente não informa
 * `startDate`/`endDate`. Mantém alinhamento com a convenção do
 * `dashboard.ts` (mesmo padrão de "mês corrente").
 */
function getCurrentMonthRange(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/**
 * Shape serializável de um evento (datas como ISO string). Conversão
 * explícita para que o cliente não receba `Date` instances "raw" — o
 * Next.js ajusta automaticamente, mas tipar aqui torna o contrato
 * claro para os consumidores.
 */
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

// ─── GET ─────────────────────────────────────────────────────────────

async function listHandler(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  let parsed: { startDate?: Date; endDate?: Date };
  try {
    parsed = listEventsQuerySchema.parse(queryParams);
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

  const { start, end } =
    parsed.startDate && parsed.endDate
      ? { start: parsed.startDate, end: parsed.endDate }
      : getCurrentMonthRange();

  const events = await prisma.event.findMany({
    where: {
      // Eventos cujo INTERVALO intersecta a janela.
      // (startsAt < end) AND (endsAt > start).
      AND: [
        { startsAt: { lt: end } },
        { endsAt: { gt: start } },
      ],
    },
    orderBy: { startsAt: 'asc' },
  });

  return NextResponse.json(
    { events: events.map(serializeEvent) },
    { status: 200 },
  );
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

  let payload: { title: string; startsAt: Date; endsAt: Date; description?: string };
  try {
    payload = createEventSchema.parse(rawBody);
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

  // 1. Persiste em pending. Se a sincronização inline falhar adiante,
  //    o estado final será 'failed'; sucesso → 'synced'.
  const created = await prisma.event.create({
    data: {
      title: payload.title,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
      syncStatus: 'pending',
      syncRetries: 0,
      createdById: ctx.session.user.id,
    },
  });

  // 2. Sync inline (Tasks 7.3/7.4). Nunca lança; devolve o estado.
  const syncResult = await syncCreatedEvent(created.id);

  const refreshed = await prisma.event.findUniqueOrThrow({
    where: { id: created.id },
  });

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
    { status: 201 },
  );
}

export const POST = withAuth('calendar:create', createHandler);
