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

  // Calculate current week (Mon-Fri) dates
  const now = new Date();
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const todayStr = today.toISOString().split('T')[0];

  // Find Monday of the current week
  const dayOfWeek = today.getUTCDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));

  // Build Mon-Fri dates array
  const dates: string[] = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const startDate = new Date(monday);
  const endDate = new Date(monday);
  endDate.setUTCDate(monday.getUTCDate() + 4); // Friday

  let serialized: ReservationItem[] = [];
  try {
    // Fetch reservations for Mon-Fri of current week
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

    serialized = reservations.map((r) => ({
      id: r.id,
      computerId: r.computerId,
      date: r.reservedDate.toISOString().split('T')[0],
      user: { id: r.user.id, name: r.user.name },
      createdAt: r.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error('[reservas] DB error:', err);
    serialized = [];
  }

  return (
    <ReservasShell
      reservations={serialized}
      dates={dates}
      currentUserId={session.user.id}
      todayStr={todayStr}
    />
  );
}
