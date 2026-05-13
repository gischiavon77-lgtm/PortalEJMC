'use client';

/**
 * `CalendarGrid` — Visualização mensal do cronograma (Tasks 7.5 e 7.9).
 *
 * Componente apresentacional que recebe a matriz do mês (já calculada
 * pela página) e a lista de eventos agrupada por dia. Não toca em
 * fetch nem em estado de servidor — é puro render.
 *
 * ─── Responsabilidades ──────────────────────────────────────────────
 *
 *   - Renderiza um grid 7×N com os rótulos da semana (Dom..Sáb) e as
 *     células de cada dia. As células fora do mês corrente recebem
 *     opacidade reduzida para diferenciar visualmente sem esconder.
 *   - Marca o dia atual com um destaque (badge no número do dia).
 *   - Em cada célula, lista até 3 eventos (com "+N" overflow) por
 *     limitação de espaço. Isso preserva a leitura em mobile/tablet —
 *     um modo "agenda" denso fica para um refinamento futuro.
 *   - Exibe o indicador visual de falha de sincronização (Task 7.9):
 *     eventos com `syncStatus === 'failed'` ganham um ponto vermelho
 *     antes do título, com `title`/`aria-label` "Falha de sincronização"
 *     para assistive tech.
 *   - Permite que cada evento seja clicável quando o usuário tem
 *     permissão de edição: o componente recebe `onEventClick` opcional.
 *     Quando ausente, o evento é renderizado como `<div>` informativo
 *     (somente leitura, comportamento dos Membros — Req 8.5).
 *
 * ─── Por que `'use client'`? ────────────────────────────────────────
 *
 * Apesar do markup ser estático, queremos handlers de clique
 * (`onEventClick`) e o consumo do `data-testid`/listener para abrir o
 * modal de edição. O Server Component da página passa as props já
 * serializáveis (`CalendarEvent[]` com strings, não Dates), e este
 * client component apenas adiciona a interatividade.
 */

import { Fragment } from 'react';

import { cn } from '@/components/ui/cn';
import {
  formatEventTime,
  WEEKDAY_LABELS,
  type CalendarEvent,
  type MonthCell,
} from './calendar-utils';

const MAX_VISIBLE_EVENTS = 3;

export interface CalendarGridProps {
  /** Matriz de 42 células gerada por `buildMonthMatrix`. */
  cells: MonthCell[];
  /** Eventos do mês agrupados por chave `YYYY-MM-DD`. */
  eventsByDay: Map<string, CalendarEvent[]>;
  /**
   * Quando informado, cada evento vira um botão. Sem callback, eles
   * permanecem como elementos não interativos (modo somente leitura
   * dos Membros — Req 8.5/8.6).
   */
  onEventClick?: (event: CalendarEvent) => void;
  /** Quando informado, clicar em uma célula vazia chama com a data. */
  onDayClick?: (date: Date) => void;
}

export function CalendarGrid({
  cells,
  eventsByDay,
  onEventClick,
  onDayClick,
}: CalendarGridProps) {
  return (
    <div
      role="grid"
      aria-label="Calendário mensal de eventos"
      className="overflow-hidden rounded-lg border border-border-light bg-surface-card"
    >
      {/* Cabeçalho com dias da semana */}
      <div
        role="row"
        className="grid grid-cols-7 border-b border-border-light bg-surface-bg"
      >
        {WEEKDAY_LABELS.map((label) => (
          <div
            key={label}
            role="columnheader"
            className="px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[1.5px] text-text-muted"
          >
            {label}
          </div>
        ))}
      </div>

      {/* Grid das células — 6 semanas × 7 dias */}
      <div role="rowgroup" className="grid grid-cols-7">
        {cells.map((cell, index) => {
          const events = eventsByDay.get(cell.key) ?? [];
          const visible = events.slice(0, MAX_VISIBLE_EVENTS);
          const overflow = events.length - visible.length;
          const isLastRow = index >= 35;
          const isLastCol = (index + 1) % 7 === 0;

          return (
            <Fragment key={cell.key}>
              <div
                role="gridcell"
                data-date={cell.key}
                data-in-month={cell.inCurrentMonth ? 'true' : 'false'}
                className={cn(
                  'flex min-h-[110px] flex-col gap-1 border-border-light p-1.5 sm:p-2',
                  !isLastCol && 'border-r',
                  !isLastRow && 'border-b',
                  cell.inCurrentMonth ? 'bg-surface-card' : 'bg-surface-bg/60',
                )}
              >
                {/* Cabeçalho do dia */}
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={
                      onDayClick ? () => onDayClick(cell.date) : undefined
                    }
                    disabled={!onDayClick}
                    aria-label={
                      onDayClick
                        ? `Criar evento em ${cell.date.toLocaleDateString('pt-BR')}`
                        : cell.date.toLocaleDateString('pt-BR')
                    }
                    className={cn(
                      'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums',
                      cell.inCurrentMonth
                        ? 'text-text-primary'
                        : 'text-text-muted',
                      cell.isToday &&
                        'bg-red-core text-white shadow-sm',
                      onDayClick &&
                        !cell.isToday &&
                        'transition-colors hover:bg-border-light',
                      !onDayClick && 'cursor-default',
                    )}
                  >
                    {cell.date.getDate()}
                  </button>
                </div>

                {/* Eventos visíveis */}
                <ul className="flex flex-col gap-1">
                  {visible.map((event) => (
                    <li key={event.id}>
                      <EventItem
                        event={event}
                        onClick={onEventClick}
                      />
                    </li>
                  ))}
                  {overflow > 0 && (
                    <li className="text-[10px] font-medium text-text-muted">
                      +{overflow} mais
                    </li>
                  )}
                </ul>
              </div>
            </Fragment>
          );
        })}
      </div>
    </div>
  );
}

interface EventItemProps {
  event: CalendarEvent;
  onClick?: (event: CalendarEvent) => void;
}

/**
 * Item visual de um evento em uma célula. Renderiza:
 *   - indicador de falha de sincronização (Task 7.9) quando aplicável,
 *   - hora curta de início,
 *   - título truncado (uma linha).
 *
 * Quando `onClick` está disponível (usuário tem permissão de edição),
 * vira um `<button>` para que o evento de teclado/click seja semântico.
 * Sem `onClick`, é um `<div>` puramente informativo.
 */
function EventItem({ event, onClick }: EventItemProps) {
  const hasFailedSync = event.syncStatus === 'failed';
  const isPendingSync = event.syncStatus === 'pending';

  const content = (
    <span className="flex min-w-0 items-center gap-1">
      {hasFailedSync && (
        <span
          aria-label="Falha de sincronização com Google Calendar"
          title="Falha de sincronização com Google Calendar"
          role="img"
          className="inline-flex h-2 w-2 shrink-0 rounded-full bg-red-vivid ring-2 ring-red-vivid/30"
        />
      )}
      {isPendingSync && !hasFailedSync && (
        <span
          aria-label="Sincronização pendente"
          title="Sincronização pendente"
          role="img"
          className="inline-flex h-2 w-2 shrink-0 rounded-full bg-amber-500"
        />
      )}
      <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.5px] text-text-muted">
        {formatEventTime(event)}
      </span>
      <span className="truncate text-[11px] font-medium text-text-primary">
        {event.title}
      </span>
    </span>
  );

  if (!onClick) {
    return (
      <div
        data-testid="calendar-event"
        data-sync-status={event.syncStatus}
        className={cn(
          'block rounded px-1.5 py-0.5 text-left',
          hasFailedSync
            ? 'bg-red-vivid/10'
            : 'bg-red-core/5',
        )}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-testid="calendar-event"
      data-sync-status={event.syncStatus}
      onClick={() => onClick(event)}
      className={cn(
        'block w-full rounded px-1.5 py-0.5 text-left transition-colors',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/40',
        hasFailedSync
          ? 'bg-red-vivid/10 hover:bg-red-vivid/20'
          : 'bg-red-core/5 hover:bg-red-core/10',
      )}
    >
      {content}
    </button>
  );
}
