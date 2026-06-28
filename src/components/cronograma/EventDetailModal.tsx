'use client';

/**
 * `EventDetailModal` — Caixa de detalhes de um evento (somente leitura).
 *
 * Usado por quem NÃO tem permissão para editar eventos: ao clicar em
 * um evento na grade, abre esta caixa maior mostrando título, data e
 * horário do evento.
 */

import { Modal, Button } from '@/components/ui';
import type { CalendarEvent } from './calendar-utils';

export interface EventDetailModalProps {
  open: boolean;
  onClose: () => void;
  event: CalendarEvent | null;
}

function formatFullDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function sameDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
}

export function EventDetailModal({ open, onClose, event }: EventDetailModalProps) {
  const multiDay = event ? !sameDay(event.startsAt, event.endsAt) : false;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={event?.title ?? 'Detalhes do evento'}
      size="md"
      footer={
        <div className="flex w-full items-center justify-end">
          <Button type="button" variant="primary" onClick={onClose}>
            Fechar
          </Button>
        </div>
      }
    >
      {event && (
        <div className="flex flex-col gap-4">
          {/* Data */}
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="text-xl">
              📅
            </span>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[1.5px] text-text-muted">
                Data
              </span>
              <span className="text-sm font-medium capitalize text-text-primary">
                {formatFullDate(event.startsAt)}
                {multiDay && (
                  <>
                    {' '}
                    <span className="lowercase text-text-muted">até</span>{' '}
                    {formatFullDate(event.endsAt)}
                  </>
                )}
              </span>
            </div>
          </div>

          {/* Horário */}
          <div className="flex items-start gap-3">
            <span aria-hidden="true" className="text-xl">
              🕐
            </span>
            <div className="flex flex-col">
              <span className="text-[11px] font-semibold uppercase tracking-[1.5px] text-text-muted">
                Horário
              </span>
              <span className="text-sm font-medium text-text-primary">
                {formatTime(event.startsAt)} — {formatTime(event.endsAt)}
              </span>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
