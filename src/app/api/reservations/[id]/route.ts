/**
 * `DELETE /api/reservations/:id` — Tasks 17.1, 17.6.
 *
 * Cancela uma reserva futura.
 * - Verifica que a reserva pertence ao usuário logado.
 * - Verifica que a data da reserva é futura (> hoje).
 * - Qualquer usuário autenticado (para suas próprias reservas).
 *
 * Resposta:
 *   200 { success: true, message: '...' }
 *   403 se não for o dono
 *   404 se não encontrada
 *   400 se reserva já passou
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { getTodayUTC, RESERVATION_ERROR_MESSAGES } from '@/lib/validators/reservation';

export const runtime = 'nodejs';

type RouteParams = Promise<{ id: string }>;

async function deleteHandler(
  _req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: RouteParams },
): Promise<Response> {
  const params = await ctx.params!;
  const reservationId = params.id;

  if (!reservationId) {
    return NextResponse.json(
      { error: true, code: 'BAD_REQUEST', message: 'ID da reserva é obrigatório.' },
      { status: 400 },
    );
  }

  // Find reservation
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
    select: { id: true, userId: true, reservedDate: true },
  });

  if (!reservation) {
    return NextResponse.json(
      { error: true, code: 'NOT_FOUND', message: RESERVATION_ERROR_MESSAGES.notFound },
      { status: 404 },
    );
  }

  // Check ownership
  if (reservation.userId !== ctx.session.user.id) {
    return NextResponse.json(
      { error: true, code: 'FORBIDDEN', message: RESERVATION_ERROR_MESSAGES.notOwner },
      { status: 403 },
    );
  }

  // Check date is not in the past (allow cancellation of today's reservations)
  const today = getTodayUTC();
  if (reservation.reservedDate.getTime() < today.getTime()) {
    return NextResponse.json(
      { error: true, code: 'BAD_REQUEST', message: RESERVATION_ERROR_MESSAGES.notFuture },
      { status: 400 },
    );
  }

  // Delete the reservation
  await prisma.reservation.delete({
    where: { id: reservationId },
  });

  return NextResponse.json(
    { success: true, message: 'Reserva cancelada com sucesso.' },
    { status: 200 },
  );
}

export const DELETE = withAuth(null, deleteHandler as Parameters<typeof withAuth>[1]);
