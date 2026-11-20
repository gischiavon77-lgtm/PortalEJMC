'use client';

/**
 * `CronogramaShell` — Casca client-side da página `/cronograma`
 * (Tasks 7.5, 7.6, 7.7, 7.8 e 7.9).
 *
 * Recebe os dados pré-renderizados pelo Server Component da página e
 * adiciona:
 *
 *   1. **Navegação entre meses** (Task 7.8) — botões "Anterior" e
 *      "Próximo" + atalho "Hoje". A navegação altera a query
 *      `?month=YYYY-MM` via `router.push`, fazendo o Next refazer o
 *      fetch no servidor. Esse desenho mantém o conteúdo SSR-friendly
 *      (cache, prefetch, SEO interno) e dispensa um estado client-side
 *      para a lista de eventos.
 *
 *   2. **Modal de criação/edição** (Task 7.6) — clica no botão "Novo
 *      evento" ou em um evento existente para abrir o `EventForm`.
 *      Após salvar/excluir, fazemos `router.refresh()` para revalidar
 *      os dados do Server Component sem perder o mês selecionado.
 *
 *   3. **Permissões** (Task 7.7) — usamos `usePermission('calendar:create')`
 *      como gate único para criar/editar/excluir. A matriz RBAC já
 *      atribui as três ações (`create/update/delete`) ao mesmo
 *      conjunto de papéis (Coordenador+), então uma única flag basta
 *      para controlar a UI. As mutações continuam revalidadas no
 *      servidor pelo `withAuth(...)` da API — o gate aqui é apenas
 *      para esconder/desabilitar elementos.
 *
 *   4. **Indicador de falha de sync** (Task 7.9) — o badge no topo
 *      mostra quantos eventos do mês estão com `syncStatus === 'failed'`,
 *      complementando o ponto vermelho que cada evento ganha na
 *      grade. Ajuda o usuário com permissão a perceber que algo
 *      precisa de atenção sem precisar varrer todas as células.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import type { EventCategory } from '@prisma/client';

import { Button, PageHeader } from '@/components/ui';
import { cn } from '@/components/ui/cn';
import { usePermission } from '@/hooks/usePermission';
import { EVENT_CATEGORIES, filterByCategory } from '@/lib/event-categories';

import {
  buildMonthMatrix,
  formatMonthKey,
  groupEventsByDay,
  MONTH_NAMES,
  shiftMonth,
  type CalendarEvent,
} from './calendar-utils';
import { CalendarGrid } from './CalendarGrid';
import { EventForm } from './EventForm';
import { EventDetailModal } from './EventDetailModal';

export interface CronogramaShellProps {
  /** Ano da visualização atual (4 dígitos). */
  year: number;
  /** Mês 0-11 da visualização atual. */
  month: number;
  /** Eventos retornados pela API/Prisma para o mês. */
  events: CalendarEvent[];
}

export function CronogramaShell({ year, month, events }: CronogramaShellProps) {
  const router = useRouter();
  const { allowed: canManage, isLoading: permissionLoading } = usePermission('calendar:create');

  // Estado do modal — `mode`:
  //   - 'closed': modal fechado.
  //   - 'create': modal aberto em modo criação (sem evento).
  //   - 'edit'  : modal aberto em modo edição com evento selecionado.
  const [modalMode, setModalMode] = useState<'closed' | 'create' | 'edit'>('closed');
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);
  // Evento exibido na caixa de detalhes (somente leitura, para quem
  // não pode editar).
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null);

  // Memoizamos a matriz e o agrupamento — re-render barato, mas isso
  // evita rebuilding em cada interação client-side (ex.: abrir modal).
  const cells = useMemo(() => buildMonthMatrix(year, month), [year, month]);
  // Fase 4: filtro por categoria (uma por vez; `null` = todas).
  const [category, setCategory] = useState<EventCategory | null>(null);
  const visibleEvents = useMemo(() => filterByCategory(events, category), [events, category]);
  const eventsByDay = useMemo(() => groupEventsByDay(visibleEvents), [visibleEvents]);

  const failedSyncCount = useMemo(
    () => events.filter((e) => e.syncStatus === 'failed').length,
    [events],
  );

  function navigateTo(newYear: number, newMonth: number) {
    const monthKey = formatMonthKey(newYear, newMonth);
    router.push(`/cronograma?month=${monthKey}`);
  }

  function handlePrev() {
    const next = shiftMonth(year, month, -1);
    navigateTo(next.year, next.month);
  }

  function handleNext() {
    const next = shiftMonth(year, month, 1);
    navigateTo(next.year, next.month);
  }

  function handleToday() {
    const today = new Date();
    navigateTo(today.getFullYear(), today.getMonth());
  }

  function openCreate(date?: Date | null) {
    if (!canManage) return;
    setActiveEvent(null);
    setDefaultDate(date ?? null);
    setModalMode('create');
  }

  function openEdit(event: CalendarEvent) {
    if (!canManage) return;
    setActiveEvent(event);
    setDefaultDate(null);
    setModalMode('edit');
  }

  // Clique em evento: quem pode gerenciar abre a edição; quem não
  // pode, abre a caixa de detalhes (somente leitura).
  function handleEventClick(event: CalendarEvent) {
    if (canManage) {
      openEdit(event);
    } else {
      setDetailEvent(event);
    }
  }

  function closeModal() {
    setModalMode('closed');
    setActiveEvent(null);
    setDefaultDate(null);
  }

  function handleSaved() {
    // Revalida os dados do Server Component sem mudar a URL.
    router.refresh();
  }

  const chipBase =
    'inline-flex min-h-[36px] shrink-0 items-center gap-2 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30';

  return (
    <section
      aria-labelledby="cronograma-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-5"
    >
      <PageHeader
        titleId="cronograma-heading"
        title="Cronograma"
        subtitle="Reuniões, entregas e eventos da EJMC."
        className="mb-0"
        action={
          <>
            {failedSyncCount > 0 && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-full border border-brand px-3 py-1 text-xs font-semibold text-danger"
                title="Eventos com falha de sincronização com o Google Calendar"
              >
                <span aria-hidden="true" className="inline-flex h-2 w-2 rounded-full bg-brand" />
                {failedSyncCount} {failedSyncCount === 1 ? 'falha' : 'falhas'} de sincronização
              </span>
            )}
            {!permissionLoading && canManage && (
              <Button type="button" variant="primary" onClick={() => openCreate(null)}>
                + Novo evento
              </Button>
            )}
          </>
        }
      />

      {/* ─── Filtros por categoria (Fase 4) ─── */}
      <div
        className="scrollbar-hide -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 tablet:mx-0 tablet:flex-wrap tablet:overflow-visible tablet:px-0"
        role="group"
        aria-label="Filtrar por categoria"
      >
        <button
          type="button"
          aria-pressed={category === null}
          onClick={() => setCategory(null)}
          className={cn(
            chipBase,
            category === null
              ? 'border-brand bg-brand text-white'
              : 'border-border text-text-soft hover:bg-surface-raised hover:text-text',
          )}
        >
          Todos
        </button>
        {EVENT_CATEGORIES.map((c) => {
          const active = category === c.value;
          return (
            <button
              key={c.value}
              type="button"
              aria-pressed={active}
              onClick={() => setCategory(active ? null : c.value)}
              className={cn(
                chipBase,
                active
                  ? 'border-text-soft bg-surface-raised text-text'
                  : 'border-border text-text-soft hover:bg-surface-raised hover:text-text',
              )}
              data-testid={`category-filter-${c.value}`}
            >
              <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', c.dot)} />
              {c.label}
            </button>
          );
        })}
      </div>

      {/* ─── Navegação entre meses (Task 7.8), no topo do calendário ─── */}
      <div className="flex flex-col gap-2">
        <div
          className="flex items-center justify-between gap-2"
          role="group"
          aria-label="Navegação entre meses"
        >
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handlePrev}
            aria-label="Mês anterior"
          >
            <span aria-hidden="true">←</span>
            <span className="hidden sm:inline">Anterior</span>
          </Button>
          <div className="flex items-center gap-3">
            <h2 className="font-heading text-xl font-bold text-text" aria-live="polite">
              {MONTH_NAMES[month]} de {year}
            </h2>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleToday}
              aria-label="Ir para o mês atual"
            >
              Hoje
            </Button>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleNext}
            aria-label="Próximo mês"
          >
            <span className="hidden sm:inline">Próximo</span>
            <span aria-hidden="true">→</span>
          </Button>
        </div>

        {/* ─── Grade do calendário (Tasks 7.5 e 7.9) ─── */}
        <CalendarGrid
          cells={cells}
          eventsByDay={eventsByDay}
          onEventClick={handleEventClick}
          onDayClick={canManage ? (date) => openCreate(date) : undefined}
        />
      </div>

      {/* ─── Legenda das categorias (Fase 4) ─── */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5" aria-label="Legenda das categorias">
        {EVENT_CATEGORIES.map((c) => (
          <li key={c.value} className="flex items-center gap-1.5 text-xs text-text-soft">
            <span aria-hidden="true" className={cn('h-2 w-2 rounded-full', c.dot)} />
            {c.label}
          </li>
        ))}
      </ul>

      {/* Mensagem de leitura-somente para Membros (Req 8.5/8.6) */}
      {!permissionLoading && !canManage && (
        <p role="note" className="text-xs text-text-faint">
          Visualização somente leitura. Clique em um evento para ver os detalhes. Apenas Diretor,
          Gerente e Coordenador podem criar, editar ou excluir eventos.
        </p>
      )}

      {/* Caixa de detalhes do evento (somente leitura) — disponível a todos. */}
      <EventDetailModal
        open={detailEvent !== null}
        onClose={() => setDetailEvent(null)}
        event={detailEvent}
      />

      {/* ─── Modal de criar/editar evento (Task 7.6) ─── */}
      {canManage && (
        <EventForm
          open={modalMode !== 'closed'}
          onClose={closeModal}
          event={modalMode === 'edit' ? activeEvent : null}
          defaultDate={defaultDate}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}
