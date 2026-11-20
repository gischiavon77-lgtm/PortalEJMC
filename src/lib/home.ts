/**
 * Dados da coluna direita da página inicial (Fase 2 da reforma).
 *
 *   - Mural de Avisos: comunicados dos últimos 30 dias, os 3 mais recentes.
 *     Comunicados não têm data de validade; "ativo" = publicado há até
 *     30 dias (decisão aprovada na Fase 2).
 *   - Destaque do Mês: os cinco destaques principais (trainee,
 *     coordenador, assessor, gerente, equipe) que têm nome preenchido.
 *     O carrossel completo, com Referências e Prêmio Cultura, fica em
 *     `/destaques`.
 *   - Próximos Eventos: os 5 próximos eventos do calendário (início a
 *     partir de agora), com dia, mês, título e horário em São Paulo.
 *
 * As funções de formatação são puras para poderem ser testadas sem banco.
 */

import { highlightPhotoUrlFor } from '@/lib/file-urls';
import { prisma } from '@/lib/prisma';

export const NOTICE_WINDOW_DAYS = 30;
export const NOTICE_LIMIT = 3;
export const UPCOMING_EVENTS_LIMIT = 5;
export const HOME_TIME_ZONE = 'America/Sao_Paulo';

/** Os cinco destaques mostrados no card, na ordem de exibição. */
export const HOME_HIGHLIGHT_SLOTS = [
  { slot: 'trainee', label: 'Trainee destaque' },
  { slot: 'coordenador', label: 'Coordenador destaque' },
  { slot: 'assessor', label: 'Assessor destaque' },
  { slot: 'gerente', label: 'Gerente destaque' },
  { slot: 'equipe', label: 'Equipe destaque' },
] as const;

export interface HomeNotice {
  id: string;
  title: string;
  authorName: string;
  createdAt: string;
}

export interface HomeHighlight {
  slot: string;
  label: string;
  name: string;
  photoUrl: string | null;
}

export interface HomeEvent {
  id: string;
  title: string;
  /** Dia do mês, ex.: "25". */
  day: string;
  /** Mês abreviado em caixa normal, ex.: "nov". */
  month: string;
  /** Horário de início, ex.: "09:00". */
  time: string;
  startsAt: string;
}

export interface HomeSidebarData {
  notices: HomeNotice[];
  highlights: HomeHighlight[];
  events: HomeEvent[];
}

/** Partes de data de um evento no fuso de São Paulo. Função pura. */
export function eventDateParts(date: Date): Pick<HomeEvent, 'day' | 'month' | 'time'> {
  const get = (options: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: HOME_TIME_ZONE, ...options }).format(date);

  return {
    day: get({ day: 'numeric' }),
    month: get({ month: 'short' }).replace('.', ''),
    time: get({ hour: '2-digit', minute: '2-digit', hour12: false }),
  };
}

/** Início da janela do Mural de Avisos. Função pura. */
export function noticeWindowStart(now: Date): Date {
  return new Date(now.getTime() - NOTICE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * Ordena os destaques pela ordem do card e descarta os vazios. Função pura.
 */
export function pickHomeHighlights(
  rows: { slot: string; name: string; photoPath: string | null }[],
): HomeHighlight[] {
  return HOME_HIGHLIGHT_SLOTS.flatMap(({ slot, label }) => {
    const row = rows.find((r) => r.slot === slot);
    if (!row || !row.name.trim()) return [];
    return [{ slot, label, name: row.name, photoUrl: highlightPhotoUrlFor(slot, row.photoPath) }];
  });
}

/** Avisos, destaques e próximos eventos. Cada parte falha sozinha (vira vazia). */
export async function getHomeSidebar(now: Date = new Date()): Promise<HomeSidebarData> {
  const [notices, highlights, events] = await Promise.all([
    prisma.announcement
      .findMany({
        where: { createdAt: { gte: noticeWindowStart(now) } },
        orderBy: { createdAt: 'desc' },
        take: NOTICE_LIMIT,
        select: { id: true, title: true, createdAt: true, author: { select: { name: true } } },
      })
      .then((rows) =>
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          authorName: r.author.name,
          createdAt: r.createdAt.toISOString(),
        })),
      )
      .catch((err) => {
        console.error('[home] avisos:', err);
        return [] as HomeNotice[];
      }),

    prisma.highlight
      .findMany({
        where: { slot: { in: HOME_HIGHLIGHT_SLOTS.map((s) => s.slot) } },
        select: { slot: true, name: true, photoPath: true },
      })
      .then(pickHomeHighlights)
      .catch((err) => {
        console.error('[home] destaques:', err);
        return [] as HomeHighlight[];
      }),

    prisma.event
      .findMany({
        where: { startsAt: { gte: now } },
        orderBy: { startsAt: 'asc' },
        take: UPCOMING_EVENTS_LIMIT,
        select: { id: true, title: true, startsAt: true },
      })
      .then((rows) =>
        rows.map((r) => ({
          id: r.id,
          title: r.title,
          startsAt: r.startsAt.toISOString(),
          ...eventDateParts(r.startsAt),
        })),
      )
      .catch((err) => {
        console.error('[home] eventos:', err);
        return [] as HomeEvent[];
      }),
  ]);

  return { notices, highlights, events };
}
