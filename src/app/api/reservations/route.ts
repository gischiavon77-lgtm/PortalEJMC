/**
 * `GET /api/reservations` e `POST /api/reservations` — Tasks 17.1, 17.2, 17.8.
 *
 * GET — lista reservas em um intervalo de datas:
 *   - `?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD`
 *   - Retorna: { reservations: [{id, computerId, date, user: {id, name}, createdAt}] }
 *   - Qualquer usuário autenticado
 *
 * POST — cria nova reserva:
 *   - Body: { computerId: number (1-7), date: "YYYY-MM-DD" }
 *   - Validação completa (5 regras)
 *   - Qualquer usuário autenticado
 *   - Mensagens de erro específicas por regra (Task 17.8)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  createReservationSchema,
  getTodayUTC,
  isDateFuture,
  isDateWithin7Days,
  isNotThreeConsecutive,
  parseDate,
  RESERVATION_ERROR_MESSAGES,
} from '@/lib/validators/reservation';

export const runtime = 'nodejs';

// ─── GET ─────────────────────────────────────────────────────────────

async function getHandler(
  req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const startDateStr = searchParams.get('startDate');
  const endDateStr = searchParams.get('endDate');

  if (!startDateStr || !endDateStr) {
    return NextResponse.json(
      {
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Os parâmetros startDate e endDate são obrigatórios.',
      },
      { status: 400 },
    );
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    return NextResponse.json(
      {
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Datas inválidas.',
      },
      { status: 400 },
    );
  }

  const reservations = await prisma.reservation.findMany({
    where: {
      reservedDate: {
        gte: startDate,
        lte: endDate,
      },
    },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
    orderBy: [{ reservedDate: 'asc' }, { computerId: 'asc' }],
  });

  const serialized = reservations.map((r) => ({
    id: r.id,
    computerId: r.computerId,
    date: r.reservedDate.toISOString().split('T')[0],
    user: { id: r.user.id, name: r.user.name },
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ reservations: serialized }, { status: 200 });
}

export const GET = withAuth(null, getHandler);

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

  // Validate payload format
  let payload: { computerId: number; date: string };
  try {
    payload = createReservationSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      const firstMessage = err.issues[0]?.message ?? 'Dados inválidos.';
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: firstMessage,
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

  const userId = ctx.session.user.id;
  const today = getTodayUTC();
  const reservationDate = parseDate(payload.date);

  // ─── Regra (a): Data estritamente futura ─────────────────────────
  if (!isDateFuture(reservationDate, today)) {
    return NextResponse.json(
      {
        error: true,
        code: 'VALIDATION_ERROR',
        message: RESERVATION_ERROR_MESSAGES.dateFuture,
      },
      { status: 400 },
    );
  }

  // ─── Regra (b): Dentro dos próximos 7 dias ──────────────────────
  if (!isDateWithin7Days(reservationDate, today)) {
    return NextResponse.json(
      {
        error: true,
        code: 'VALIDATION_ERROR',
        message: RESERVATION_ERROR_MESSAGES.dateWithin7Days,
      },
      { status: 400 },
    );
  }

  // ─── Regra (e): Computador disponível na data ───────────────────
  const existingReservation = await prisma.reservation.findUnique({
    where: {
      computerId_reservedDate: {
        computerId: payload.computerId,
        reservedDate: reservationDate,
      },
    },
  });

  if (existingReservation) {
    return NextResponse.json(
      {
        error: true,
        code: 'VALIDATION_ERROR',
        message: RESERVATION_ERROR_MESSAGES.computerUnavailable,
      },
      { status: 409 },
    );
  }

  // ─── Regra (c): Max 1 computador por dia por usuário ────────────
  const userReservationSameDay = await prisma.reservation.findFirst({
    where: {
      userId,
      reservedDate: reservationDate,
    },
  });

  if (userReservationSameDay) {
    return NextResponse.json(
      {
        error: true,
        code: 'VALIDATION_ERROR',
        message: RESERVATION_ERROR_MESSAGES.maxOnePerDay,
      },
      { status: 409 },
    );
  }

  // ─── Regra (d): Sem 3 dias consecutivos ─────────────────────────
  // Buscar todas as reservas do usuário para verificar consecutividade
  const userReservations = await prisma.reservation.findMany({
    where: {
      userId,
      reservedDate: {
        gte: new Date(today.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    },
    select: { reservedDate: true },
  });

  const existingDates = userReservations.map((r) => r.reservedDate);

  if (!isNotThreeConsecutive(existingDates, reservationDate)) {
    return NextResponse.json(
      {
        error: true,
        code: 'VALIDATION_ERROR',
        message: RESERVATION_ERROR_MESSAGES.noConsecutive3,
      },
      { status: 409 },
    );
  }

  // ─── Criar a reserva ────────────────────────────────────────────
  const created = await prisma.reservation.create({
    data: {
      computerId: payload.computerId,
      reservedDate: reservationDate,
      userId,
    },
    include: {
      user: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json(
    {
      reservation: {
        id: created.id,
        computerId: created.computerId,
        date: created.reservedDate.toISOString().split('T')[0],
        user: { id: created.user.id, name: created.user.name },
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}

export const POST = withAuth(null, createHandler);
