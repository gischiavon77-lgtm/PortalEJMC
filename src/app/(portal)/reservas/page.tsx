import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ReservasShell } from '@/components/reservas/ReservasShell';

/**
 * `/reservas` — Página de Reserva de Computadores (Tasks 17.3–17.7).
 *
 * Server Component que carrega as reservas dos próximos 7 dias
 * e renderiza o grid de disponibilidade (7 computadores × 7 dias).
 */

export const metadata: Metadata = {
  title: 'Reservas',
  description: 'Reserva de computadores do Portal Interno EJMC.',
};

export const dynamic = 'force-dynamic';

export interface ReservationItem {
  id: string;
  computerId: number;
  date: string; // YYYY-MM-DD
  user: { id: string; name: string };
  createdAt: string;
}

export default async function ReservasPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // Calculate date range: tomorrow through 7 days from today
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const startDate = new Date(today);
  startDate.setUTCDate(startDate.getUTCDate() + 1); // tomorrow
  const endDate = new Date(today);
  endDate.setUTCDate(endDate.getUTCDate() + 7); // 7 days from today

  // Fetch reservations for the range
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

  const serialized: ReservationItem[] = reservations.map((r) => ({
    id: r.id,
    computerId: r.computerId,
    date: r.reservedDate.toISOString().split('T')[0],
    user: { id: r.user.id, name: r.user.name },
    createdAt: r.createdAt.toISOString(),
  }));

  // Build array of 7 dates starting from tomorrow
  const dates: string[] = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(today);
    d.setUTCDate(d.getUTCDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  return <ReservasShell reservations={serialized} dates={dates} currentUserId={session.user.id} />;
}
