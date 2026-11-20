/**
 * Categorias dos eventos do calendário (Fase 4 da reforma).
 *
 * Fonte única de nome, descrição e cor de cada categoria. Usado pelo
 * calendário (pontos, fundo leve, filtros e legenda), pelo formulário de
 * evento, pelos detalhes e pela coluna "Próximos Eventos" da página inicial.
 *
 * As cores são tons apagados (tokens `cat-*` em `tailwind.config.ts`), para
 * não competir com o vermelho da marca, que fica reservado para "hoje",
 * item ativo e botões. As classes precisam ser escritas por extenso aqui
 * para o Tailwind gerá-las.
 *
 * Módulo puro: serve a Server e Client Components.
 */

import type { EventCategory } from '@prisma/client';

export interface EventCategoryInfo {
  value: EventCategory;
  label: string;
  /** Para que serve, mostrado na legenda/ajuda do formulário. */
  hint: string;
  /** Ponto colorido (`bg-*`). */
  dot: string;
  /** Fundo leve + borda do evento no calendário. */
  chip: string;
}

/** Ordem de exibição (filtros, legenda, formulário). */
export const EVENT_CATEGORIES: readonly EventCategoryInfo[] = [
  {
    value: 'INSTITUCIONAL',
    label: 'Institucional',
    hint: 'Reuniões gerais e da diretoria',
    dot: 'bg-cat-institucional',
    chip: 'bg-cat-institucional/15 border-cat-institucional/40',
  },
  {
    value: 'REUNIAO_AREA',
    label: 'Reunião de área',
    hint: 'Reuniões internas de cada área',
    dot: 'bg-cat-area',
    chip: 'bg-cat-area/15 border-cat-area/40',
  },
  {
    value: 'PROJETOS_CLIENTES',
    label: 'Projetos e clientes',
    hint: 'Reuniões e entregas de projetos',
    dot: 'bg-cat-projetos',
    chip: 'bg-cat-projetos/15 border-cat-projetos/40',
  },
  {
    value: 'COMERCIAL',
    label: 'Comercial',
    hint: 'Prospecção, diagnósticos, visitas a clientes',
    dot: 'bg-cat-comercial',
    chip: 'bg-cat-comercial/15 border-cat-comercial/40',
  },
  {
    value: 'CAPACITACAO',
    label: 'Capacitação',
    hint: 'Treinamentos e workshops',
    dot: 'bg-cat-capacitacao',
    chip: 'bg-cat-capacitacao/15 border-cat-capacitacao/40',
  },
  {
    value: 'PROCESSO_SELETIVO',
    label: 'Processo seletivo',
    hint: 'Inscrições, dinâmicas, entrevistas',
    dot: 'bg-cat-ps',
    chip: 'bg-cat-ps/15 border-cat-ps/40',
  },
  {
    value: 'EVENTOS_INTEGRACAO',
    label: 'Eventos e integração',
    hint: 'Eventos do movimento, confraternizações',
    dot: 'bg-cat-eventos',
    chip: 'bg-cat-eventos/15 border-cat-eventos/40',
  },
  {
    value: 'OUTROS',
    label: 'Outros',
    hint: 'O que não se encaixa nas demais',
    dot: 'bg-cat-outros',
    chip: 'bg-cat-outros/15 border-cat-outros/40',
  },
] as const;

export const EVENT_CATEGORY_VALUES = EVENT_CATEGORIES.map((c) => c.value) as [
  EventCategory,
  ...EventCategory[],
];

/** Categoria sugerida para eventos novos. */
export const DEFAULT_NEW_EVENT_CATEGORY: EventCategory = 'INSTITUCIONAL';

const BY_VALUE = new Map(EVENT_CATEGORIES.map((c) => [c.value, c]));

/** Dados de uma categoria; categoria desconhecida cai em "Outros". */
export function getEventCategory(value: string | null | undefined): EventCategoryInfo {
  return BY_VALUE.get(value as EventCategory) ?? (BY_VALUE.get('OUTROS') as EventCategoryInfo);
}

/** Filtra eventos por categoria; `null` = todas. Função pura. */
export function filterByCategory<T extends { category: string }>(
  events: T[],
  category: EventCategory | null,
): T[] {
  return category ? events.filter((e) => e.category === category) : events;
}
