'use client';

/**
 * `ReservationGrid` — Grid 7×7 de computadores × dias (Tasks 17.3, 17.4, 17.7).
 *
 * Exibe disponibilidade com feedback visual:
 *   - Verde: disponível (clicável para reservar)
 *   - Azul: reserva do usuário logado (clicável para cancelar)
 *   - Cinza: reservado por outro (tooltip com nome)
 *   - Vermelho (coluna): dia totalmente lotado (Task 17.7)
 *
 * Responsivo: scrollable em mobile.
 */

import { useMemo } from 'react';
import type { ReservationItem } from '@/app/(portal)/reservas/page';

export interface ReservationGridProps {
  reservations: ReservationItem[];
  dates: string[];
  currentUserId: string;
  onCellClick: (computerId: number, date: string, reservation?: ReservationItem) => void;
}

const COMPUTERS = [1, 2, 3, 4, 5, 6, 7];
const WEEKDAY_NAMES = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

export function ReservationGrid({
  reservations,
  dates,
  currentUserId,
  onCellClick,
}: ReservationGridProps) {
  // Build a lookup map: `${computerId}-${date}` → reservation
  const reservationMap = useMemo(() => {
    const map = new Map<string, ReservationItem>();
    for (const r of reservations) {
      map.set(`${r.computerId}-${r.date}`, r);
    }
    return map;
  }, [reservations]);

  // Determine which days are fully booked (Task 17.7)
  const fullyBookedDays = useMemo(() => {
    const set = new Set<string>();
    for (const date of dates) {
      let booked = 0;
      for (const pc of COMPUTERS) {
        if (reservationMap.has(`${pc}-${date}`)) {
          booked++;
        }
      }
      if (booked >= 7) {
        set.add(date);
      }
    }
    return set;
  }, [dates, reservationMap]);

  return (
    <div className="overflow-x-auto rounded-lg border border-border-light bg-surface-card">
      <table className="w-full min-w-[560px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b border-border-light bg-surface-bg px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
              PC
            </th>
            {dates.map((date) => {
              const d = new Date(date + 'T00:00:00');
              const dayOfWeek = WEEKDAY_NAMES[d.getUTCDay()];
              const dayNum = date.split('-')[2];
              const monthNum = date.split('-')[1];
              const isFullyBooked = fullyBookedDays.has(date);

              return (
                <th
                  key={date}
                  className={`border-b border-border-light px-2 py-2.5 text-center text-xs font-medium ${
                    isFullyBooked ? 'bg-red-50 text-red-700' : 'bg-surface-bg text-text-secondary'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase tracking-wide">{dayOfWeek}</span>
                    <span className="text-sm font-semibold">
                      {dayNum}/{monthNum}
                    </span>
                  </div>
                  {isFullyBooked && (
                    <span className="mt-0.5 block text-[9px] font-medium text-red-600">LOTADO</span>
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {COMPUTERS.map((pc) => (
            <tr key={pc}>
              <td className="border-b border-border-light bg-surface-bg px-3 py-2 text-xs font-semibold text-text-primary">
                PC {pc}
              </td>
              {dates.map((date) => {
                const key = `${pc}-${date}`;
                const reservation = reservationMap.get(key);
                const isFullyBooked = fullyBookedDays.has(date);
                const isOwn = reservation?.user.id === currentUserId;

                return (
                  <td key={key} className="border-b border-border-light p-1">
                    <CellButton
                      reservation={reservation}
                      isOwn={isOwn}
                      isFullyBooked={isFullyBooked}
                      computerId={pc}
                      date={date}
                      onCellClick={onCellClick}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Cell Button Component ───────────────────────────────────────────

interface CellButtonProps {
  reservation?: ReservationItem;
  isOwn: boolean;
  isFullyBooked: boolean;
  computerId: number;
  date: string;
  onCellClick: (computerId: number, date: string, reservation?: ReservationItem) => void;
}

function CellButton({
  reservation,
  isOwn,
  isFullyBooked,
  computerId,
  date,
  onCellClick,
}: CellButtonProps) {
  if (reservation) {
    if (isOwn) {
      // Own reservation - blue, clickable to cancel
      return (
        <button
          type="button"
          onClick={() => onCellClick(computerId, date, reservation)}
          className="flex h-10 w-full items-center justify-center rounded border border-blue-300 bg-blue-100 text-[10px] font-medium text-blue-800 transition-colors hover:bg-blue-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          title="Sua reserva — clique para cancelar"
          aria-label={`Sua reserva no PC ${computerId} em ${date}. Clique para cancelar.`}
        >
          Você
        </button>
      );
    }

    // Someone else's reservation - gray, shows name on hover
    return (
      <div
        className="flex h-10 w-full items-center justify-center rounded border border-gray-300 bg-gray-200 text-[10px] font-medium text-gray-600 cursor-not-allowed"
        title={reservation.user.name}
        aria-label={`Reservado por ${reservation.user.name} no PC ${computerId} em ${date}.`}
      >
        <span className="max-w-[60px] truncate">{reservation.user.name.split(' ')[0]}</span>
      </div>
    );
  }

  // Available slot
  if (isFullyBooked) {
    // Shouldn't happen (if fully booked, all cells are taken), but guard
    return (
      <div
        className="flex h-10 w-full items-center justify-center rounded border border-red-200 bg-red-50 text-[10px] text-red-400"
        aria-label={`Dia lotado — PC ${computerId} em ${date}`}
      >
        —
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onCellClick(computerId, date)}
      className="flex h-10 w-full items-center justify-center rounded border border-green-200 bg-green-50 text-[10px] font-medium text-green-700 transition-colors hover:border-green-400 hover:bg-green-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-400"
      title="Disponível — clique para reservar"
      aria-label={`Disponível — PC ${computerId} em ${date}. Clique para reservar.`}
    >
      Livre
    </button>
  );
}
