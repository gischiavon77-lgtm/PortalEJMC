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

import { Button } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';

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

export interface CronogramaShellProps {
  /** Ano da visualização atual (4 dígitos). */
  year: number;
  /** Mês 0-11 da visualização atual. */
  month: number;
  /** Eventos retornados pela API/Prisma para o mês. */
  events: CalendarEvent[];
}

export function CronogramaShell({
  year,
  month,
  events,
}: CronogramaShellProps) {
  const router = useRouter();
  const { allowed: canManage, isLoading: permissionLoading } = usePermission(
    'calendar:create',
  );

  // Estado do modal — `mode`:
  //   - 'closed': modal fechado.
  //   - 'create': modal aberto em modo criação (sem evento).
  //   - 'edit'  : modal aberto em modo edição com evento selecionado.
  const [modalMode, setModalMode] = useState<'closed' | 'create' | 'edit'>(
    'closed',
  );
  const [activeEvent, setActiveEvent] = useState<CalendarEvent | null>(null);
  const [defaultDate, setDefaultDate] = useState<Date | null>(null);

  // Memoizamos a matriz e o agrupamento — re-render barato, mas isso
  // evita rebuilding em cada interação client-side (ex.: abrir modal).
  const cells = useMemo(() => buildMonthMatrix(year, month), [year, month]);
  const eventsByDay = useMemo(() => groupEventsByDay(events), [events]);

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

  function closeModal() {
    setModalMode('closed');
    setActiveEvent(null);
    setDefaultDate(null);
  }

  function handleSaved() {
    // Revalida os dados do Server Component sem mudar a URL.
    router.refresh();
  }

  return (
    <section
      aria-labelledby="cronograma-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      {/* ─── Cabeçalho com título, navegação e ação de criar ─── */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            Cronograma
          </p>
          <h1
            id="cronograma-heading"
            className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
          >
            {MONTH_NAMES[month]} de {year}
          </h1>
          <p className="text-text-secondary">
            Eventos sincronizados com o Google Calendar.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Controles de navegação entre meses (Task 7.8) */}
          <div
            className="flex items-center gap-2"
            role="group"
            aria-label="Navegação entre meses"
          >
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handlePrev}
              aria-label="Mês anterior"
            >
              <span aria-hidden="true">←</span> Anterior
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleToday}
              aria-label="Ir para o mês atual"
            >
              Hoje
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={handleNext}
              aria-label="Próximo mês"
            >
              Próximo <span aria-hidden="true">→</span>
            </Button>
          </div>

          {/* Indicador de falha de sync (Task 7.9) + botão de criar */}
          <div className="flex flex-wrap items-center gap-3">
            {failedSyncCount > 0 && (
              <span
                role="status"
                className="inline-flex items-center gap-1.5 rounded-full bg-red-vivid/10 px-3 py-1 text-xs font-semibold text-red-vivid"
                title="Eventos com falha de sincronização com o Google Calendar"
              >
                <span
                  aria-hidden="true"
                  className="inline-flex h-2 w-2 rounded-full bg-red-vivid"
                />
                {failedSyncCount} {failedSyncCount === 1 ? 'falha' : 'falhas'} de
                sincronização
              </span>
            )}

            {!permissionLoading && canManage && (
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => openCreate(null)}
              >
                + Novo evento
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* ─── Grade do calendário (Tasks 7.5 e 7.9) ─── */}
      <CalendarGrid
        cells={cells}
        eventsByDay={eventsByDay}
        onEventClick={canManage ? openEdit : undefined}
        onDayClick={canManage ? (date) => openCreate(date) : undefined}
      />

      {/* Mensagem de leitura-somente para Membros (Req 8.5/8.6) */}
      {!permissionLoading && !canManage && (
        <p
          role="note"
          className="text-xs text-text-muted"
        >
          Visualização somente leitura. Apenas Diretor, Gerente e Coordenador
          podem criar, editar ou excluir eventos.
        </p>
      )}

      {/* ─── Modal de criar/editar evento (Task 7.6) ───
          Renderizado apenas quando o usuário tem permissão. Isso evita
          montar o componente para Membros, mantendo o bundle interativo
          mais leve para o caso comum (visualização). */}
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
