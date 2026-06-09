'use client';

/**
 * `ReservasShell` — Casca client-side da página `/reservas`
 * (Tasks 17.3, 17.4, 17.5, 17.6, 17.7, 17.8).
 *
 * Exibe o grid de disponibilidade de 7 computadores × 7 dias,
 * permite reservar (com confirmação), cancelar (com confirmação),
 * e mostra feedback visual completo.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Modal, Toast } from '@/components/ui';
import type { ReservationItem } from '@/app/(portal)/reservas/page';
import { ReservationGrid } from './ReservationGrid';

export interface ReservasShellProps {
  reservations: ReservationItem[];
  dates: string[];
  currentUserId: string;
  todayStr: string;
}

export function ReservasShell({
  reservations,
  dates,
  currentUserId,
  todayStr,
}: ReservasShellProps) {
  const router = useRouter();

  // Modal states
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    computerId: number;
    date: string;
  }>({ open: false, computerId: 0, date: '' });

  const [cancelModal, setCancelModal] = useState<{
    open: boolean;
    reservationId: string;
    computerId: number;
    date: string;
  }>({ open: false, reservationId: '', computerId: 0, date: '' });

  const [loading, setLoading] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
    variant: 'success' | 'error';
  }>({
    message: '',
    visible: false,
    variant: 'success',
  });

  const dismissToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, visible: true, variant });
  }

  // ─── Handlers ──────────────────────────────────────────────────────

  function handleCellClick(computerId: number, date: string, reservation?: ReservationItem) {
    // Only allow interaction on today's date
    if (date !== todayStr) {
      showToast('Só é possível reservar um computador para o dia de hoje.', 'error');
      return;
    }

    if (reservation) {
      // It's a reservation
      if (reservation.user.id === currentUserId) {
        // Own reservation — offer to cancel
        setCancelModal({
          open: true,
          reservationId: reservation.id,
          computerId,
          date,
        });
      }
      // If someone else's reservation, do nothing (tooltip shows name)
    } else {
      // Available slot — offer to reserve
      setConfirmModal({ open: true, computerId, date });
    }
  }

  async function handleConfirmReservation() {
    setLoading(true);
    try {
      const res = await fetch('/api/reservations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          computerId: confirmModal.computerId,
          date: confirmModal.date,
        }),
      });

      if (res.ok) {
        setConfirmModal({ open: false, computerId: 0, date: '' });
        showToast('Reserva realizada com sucesso!');
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.message ?? 'Erro ao realizar reserva.', 'error');
        setConfirmModal({ open: false, computerId: 0, date: '' });
      }
    } catch {
      showToast('Erro de conexão. Tente novamente.', 'error');
      setConfirmModal({ open: false, computerId: 0, date: '' });
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmCancel() {
    setLoading(true);
    try {
      const res = await fetch(`/api/reservations/${cancelModal.reservationId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setCancelModal({ open: false, reservationId: '', computerId: 0, date: '' });
        showToast('Reserva cancelada com sucesso!');
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.message ?? 'Erro ao cancelar reserva.', 'error');
        setCancelModal({ open: false, reservationId: '', computerId: 0, date: '' });
      }
    } catch {
      showToast('Erro de conexão. Tente novamente.', 'error');
      setCancelModal({ open: false, reservationId: '', computerId: 0, date: '' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="reservas-heading"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6"
    >
      {/* Header */}
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
          Computadores
        </p>
        <h1
          id="reservas-heading"
          className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
        >
          Reservas
        </h1>
        <p className="text-text-secondary">
          Selecione um computador e dia para reservar. Máximo de 1 reserva por dia, sem 3 dias
          consecutivos.
        </p>
      </header>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-text-secondary">
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded border border-green-300 bg-green-50" />
          <span>Disponível</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded border border-blue-300 bg-blue-100" />
          <span>Minha reserva</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded border border-gray-300 bg-gray-200" />
          <span>Ocupado</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="inline-block h-4 w-4 rounded border border-red-300 bg-red-100" />
          <span>Dia lotado</span>
        </div>
      </div>

      {/* Grid */}
      <ReservationGrid
        reservations={reservations}
        dates={dates}
        currentUserId={currentUserId}
        onCellClick={handleCellClick}
        todayStr={todayStr}
      />

      {/* Confirmation Modal — Reserve (Task 17.5) */}
      <Modal
        open={confirmModal.open}
        onClose={() => setConfirmModal({ open: false, computerId: 0, date: '' })}
        title="Confirmar Reserva"
        description="Deseja confirmar esta reserva de computador?"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setConfirmModal({ open: false, computerId: 0, date: '' })}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={handleConfirmReservation}
              loading={loading}
            >
              Confirmar
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border-light bg-surface-bg p-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">Computador:</dt>
                <dd className="font-medium text-text-primary">PC {confirmModal.computerId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Data:</dt>
                <dd className="font-medium text-text-primary">{formatDateBR(confirmModal.date)}</dd>
              </div>
            </dl>
          </div>
        </div>
      </Modal>

      {/* Cancel Confirmation Modal (Task 17.6) */}
      <Modal
        open={cancelModal.open}
        onClose={() => setCancelModal({ open: false, reservationId: '', computerId: 0, date: '' })}
        title="Cancelar Reserva"
        description="Deseja cancelar esta reserva?"
        size="sm"
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() =>
                setCancelModal({ open: false, reservationId: '', computerId: 0, date: '' })
              }
              disabled={loading}
            >
              Voltar
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancel}
              loading={loading}
            >
              Cancelar Reserva
            </Button>
          </div>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-border-light bg-surface-bg p-4">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-text-secondary">Computador:</dt>
                <dd className="font-medium text-text-primary">PC {cancelModal.computerId}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-text-secondary">Data:</dt>
                <dd className="font-medium text-text-primary">{formatDateBR(cancelModal.date)}</dd>
              </div>
            </dl>
          </div>
          <p className="text-sm text-text-muted">
            O slot ficará disponível para outros membros após o cancelamento.
          </p>
        </div>
      </Modal>

      {/* Toast */}
      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={dismissToast}
        duration={4000}
      />
    </section>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDateBR(dateStr: string): string {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
}
