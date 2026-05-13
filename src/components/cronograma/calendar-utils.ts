/**
 * Utilitários do módulo Cronograma — geração de grade mensal e
 * formatação de datas para os componentes da Task 7.5.
 *
 * Mantemos as helpers fora do componente `CalendarGrid` por dois
 * motivos:
 *
 *   1. **Pureza/Testabilidade**: funções puras de geração de grid
 *      (`buildMonthMatrix`) podem ser exercitadas em testes unitários
 *      sem precisar montar a árvore React.
 *   2. **Reuso**: a mesma lógica de "primeiro/último dia do mês",
 *      "início da semana" e "intervalo de busca de eventos" é
 *      consumida tanto pelo Server Component da página quanto pelo
 *      Client Component de navegação entre meses.
 *
 * ─── Convenções de fuso/horário ─────────────────────────────────────
 *
 * Todas as datas exibidas pelo calendário são interpretadas no fuso
 * local do navegador/servidor — eventos do banco vêm como ISO 8601
 * UTC e são "achatados" para o dia local de início. Isso pode causar
 * pequenas diferenças em fronteiras de meia-noite UTC vs. local, mas
 * é o comportamento esperado para um cronograma interno de uma
 * empresa em fuso fixo (Brasil/SP). Para o escopo da Task 7.5, é
 * suficiente — a precisão de fuso fica para um refinamento futuro.
 *
 * ─── Início da semana ───────────────────────────────────────────────
 *
 * O calendário é exibido com a semana começando em **domingo**
 * (índice 0 em `Date.prototype.getDay()`), seguindo a convenção
 * brasileira tradicional. Os headers da grade (`WEEKDAY_LABELS`)
 * acompanham essa ordem.
 */

/** Rótulos curtos dos dias da semana, com domingo na posição 0. */
export const WEEKDAY_LABELS = [
  'Dom',
  'Seg',
  'Ter',
  'Qua',
  'Qui',
  'Sex',
  'Sáb',
] as const;

/** Nomes dos meses em pt-BR para o cabeçalho da página. */
export const MONTH_NAMES = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
] as const;

export interface MonthCell {
  /** Data do dia que esta célula representa (00:00 do fuso local). */
  date: Date;
  /** Chave estável `YYYY-MM-DD` para usar como key em listas. */
  key: string;
  /** `true` quando a célula pertence ao mês corrente da visualização. */
  inCurrentMonth: boolean;
  /** `true` quando a célula corresponde ao dia atual. */
  isToday: boolean;
}

/**
 * Formata um `Date` como `YYYY-MM-DD` no fuso local (sem ajustar para
 * UTC). Usado como chave única por dia tanto na grade quanto no
 * agrupamento de eventos.
 */
export function formatDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Retorna `YYYY-MM` para o mês informado. Útil para navegação
 * (`?month=YYYY-MM`).
 */
export function formatMonthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

/**
 * Faz parse de um `YYYY-MM`. Retorna `null` se a string for inválida
 * — neste caso, a página deve cair no mês corrente como fallback.
 */
export function parseMonthKey(input: string | null | undefined): {
  year: number;
  month: number;
} | null {
  if (!input) return null;
  const match = /^(\d{4})-(\d{2})$/.exec(input);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  if (Number.isNaN(year) || Number.isNaN(month)) return null;
  if (month < 0 || month > 11) return null;
  return { year, month };
}

/**
 * Gera a matriz de células do mês. A grade sempre tem 6 linhas × 7
 * colunas (= 42 células), o que garante visualmente que qualquer mês
 * caiba sem que o componente precise ajustar a altura entre meses.
 *
 * Semanas começam em domingo. A primeira célula da matriz é o último
 * domingo anterior ou igual ao dia 1 do mês informado; a última
 * célula é o sábado seguinte que completa as 6 semanas.
 */
export function buildMonthMatrix(year: number, month: number): MonthCell[] {
  const firstOfMonth = new Date(year, month, 1);
  const startWeekday = firstOfMonth.getDay(); // 0..6 (dom..sáb)

  // Início da grade: subtrai `startWeekday` dias do dia 1.
  const start = new Date(year, month, 1 - startWeekday);

  const today = startOfDay(new Date());
  const todayKey = formatDateKey(today);

  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i += 1) {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = formatDateKey(date);
    cells.push({
      date,
      key,
      inCurrentMonth: date.getMonth() === month,
      isToday: key === todayKey,
    });
  }
  return cells;
}

/**
 * Retorna o intervalo `[firstOfMonth, firstOfNextMonth)` em ISO 8601
 * (UTC) para o mês informado. Esse formato é exatamente o esperado
 * pela API `GET /api/calendar/events?startDate=&endDate=`.
 *
 * Importante: usamos UTC aqui para casar com o que a API faz como
 * default. A conversão para o fuso local da grade fica a cargo do
 * `CalendarGrid` (que usa `Date` local). Esse "split" mantém a API
 * consistente em qualquer fuso.
 */
export function monthRangeISO(year: number, month: number): {
  startISO: string;
  endISO: string;
} {
  const start = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month + 1, 1, 0, 0, 0, 0));
  return { startISO: start.toISOString(), endISO: end.toISOString() };
}

/**
 * Retorna a representação `Date` zerada na meia-noite local. Útil para
 * comparar "mesmo dia" sem precisar formatar como string.
 */
export function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Avança/retrocede um mês. Aceita valores negativos. Resolve o
 * "carry over" automaticamente (ex.: dezembro → janeiro do ano
 * seguinte).
 */
export function shiftMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const ref = new Date(year, month + delta, 1);
  return { year: ref.getFullYear(), month: ref.getMonth() };
}

export interface CalendarEvent {
  id: string;
  title: string;
  startsAt: string; // ISO
  endsAt: string; // ISO
  syncStatus: string;
  createdById: string;
}

/**
 * Agrupa eventos pelas chaves de dia (`YYYY-MM-DD`) que eles cobrem.
 * Um evento que atravessa múltiplos dias aparece em todas as células
 * dentro do seu intervalo (start..end inclusivos no mesmo dia).
 *
 * A função usa o fuso local — eventos que cruzam meia-noite UTC mas
 * pertencem ao mesmo dia local ainda são agrupados corretamente.
 */
export function groupEventsByDay(
  events: CalendarEvent[],
): Map<string, CalendarEvent[]> {
  const map = new Map<string, CalendarEvent[]>();

  for (const event of events) {
    const start = new Date(event.startsAt);
    const end = new Date(event.endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) continue;

    // Iteramos do dia local de start até o dia local de end. O loop
    // tem proteção de cap em 60 iterações para o caso degenerado de
    // datas com >2 meses de diferença (não esperado, mas defensivo).
    const cursor = startOfDay(start);
    const limit = startOfDay(end);
    let safety = 60;
    while (cursor.getTime() <= limit.getTime() && safety > 0) {
      const key = formatDateKey(cursor);
      const list = map.get(key);
      if (list) {
        list.push(event);
      } else {
        map.set(key, [event]);
      }
      cursor.setDate(cursor.getDate() + 1);
      safety -= 1;
    }
  }

  // Ordena cada lista por horário de início — UI mostra os primeiros
  // do dia primeiro, mais natural para uma agenda. Usamos `forEach`
  // (em vez de `for…of`) por compatibilidade com o target ES5 do
  // tsconfig — `for…of` sobre `Map` exigiria `downlevelIteration`.
  map.forEach((list) => {
    list.sort(
      (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
    );
  });

  return map;
}

/**
 * Formata o intervalo de horas de um evento como "HH:mm" em pt-BR.
 * Retorna apenas a hora de início se o evento durar exatamente o dia
 * inteiro (00:00 → 00:00 do dia seguinte) — caso comum para eventos
 * "all day" criados via Google Calendar.
 */
export function formatEventTime(event: CalendarEvent): string {
  const start = new Date(event.startsAt);
  if (Number.isNaN(start.getTime())) return '';
  return start.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
