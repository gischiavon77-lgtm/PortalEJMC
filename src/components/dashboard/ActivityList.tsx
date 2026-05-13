/**
 * `ActivityList` — Lista de atividades do mês corrente
 * (Tasks 6.4 e 6.5 / Req 7.7, 7.8).
 *
 * Renderiza até 10 itens já ordenados (responsabilidade do helper)
 * com:
 *   - ícone por tipo (cronograma, comunicado, projeto, meta),
 *   - título principal,
 *   - subtítulo opcional (`detail`) com contexto,
 *   - timestamp formatado em pt-BR (data + hora curta).
 *
 * Quando `activities` está vazio, exibe a mensagem de empty-state
 * exigida pela Req 7.8 ("lista vazia para atividades quando os dados
 * estiverem indisponíveis"). A mensagem é fixa em pt-BR e amigável.
 *
 * ─── Server-component-friendly ────────────────────────────────────
 * Sem hooks de cliente. O componente recebe os dados já hidratados
 * e só formata. A formatação de data usa `Intl.DateTimeFormat`, que
 * roda em ambiente Node sem qualquer pré-requisito.
 *
 * ─── Acessibilidade ──────────────────────────────────────────────
 *   - Lista renderizada como `<ol>` (ordem cronológica relevante).
 *   - Cada item recebe `<time dateTime="…">` para que leitores de
 *     tela e crawlers entendam a data corretamente.
 *   - O empty-state usa um `<p role="status">` para que mudanças
 *     dinâmicas sejam anunciadas (caso o componente seja
 *     re-renderizado com `[]`).
 */

import { Card } from '@/components/ui';
import { cn } from '@/components/ui/cn';
import type { DashboardActivity, DashboardActivityType } from '@/lib/dashboard';

export interface ActivityListProps {
  activities: DashboardActivity[];
  /** Título do bloco — opcional, default "Atividades do mês". */
  title?: string;
  /** Mensagem do empty-state — opcional, default em pt-BR. */
  emptyMessage?: string;
  /** Classe extra para integração com o grid da página. */
  className?: string;
}

const DEFAULT_TITLE = 'Atividades do mês';
const DEFAULT_EMPTY_MESSAGE =
  'Sem atividades registradas neste mês.';

/** Rótulo curto exibido como "tag" do tipo de cada atividade. */
const TYPE_LABELS: Record<DashboardActivityType, string> = {
  event: 'Cronograma',
  announcement: 'Comunicado',
  'project-status': 'Projeto',
  'goal-update': 'Meta',
};

/**
 * Cores semânticas por tipo. As tonalidades reusam tokens do
 * design system (vermelho EJMC para os módulos de marca; azul/âmbar
 * para diferenciação rápida em listagens densas).
 */
const TYPE_BADGE: Record<DashboardActivityType, string> = {
  event: 'bg-red-core/10 text-red-core',
  announcement: 'bg-amber-100 text-amber-700',
  'project-status': 'bg-sky-100 text-sky-700',
  'goal-update': 'bg-emerald-100 text-emerald-700',
};

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return dateFormatter.format(date);
}

export function ActivityList({
  activities,
  title = DEFAULT_TITLE,
  emptyMessage = DEFAULT_EMPTY_MESSAGE,
  className,
}: ActivityListProps) {
  const isEmpty = activities.length === 0;

  return (
    <Card variant="solid" padding="none" className={cn('flex flex-col', className)}>
      <Card.Header>
        <Card.Title>{title}</Card.Title>
        <span
          className="text-xs font-medium uppercase tracking-[1.5px] text-text-muted"
          aria-hidden="true"
        >
          {activities.length} de 10
        </span>
      </Card.Header>

      <Card.Body padding="none">
        {isEmpty ? (
          <p
            role="status"
            className="px-4 py-8 text-center text-sm text-text-secondary sm:px-5"
          >
            {emptyMessage}
          </p>
        ) : (
          <ol className="divide-y divide-border-light">
            {activities.map((activity) => (
              <li key={activity.id} className="px-4 py-3 sm:px-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[1.5px]',
                          TYPE_BADGE[activity.type],
                        )}
                      >
                        {TYPE_LABELS[activity.type]}
                      </span>
                      <ActivityIcon type={activity.type} />
                    </div>
                    <p className="mt-1.5 truncate text-sm font-semibold text-text-primary">
                      {activity.title}
                    </p>
                    {activity.detail ? (
                      <p className="mt-0.5 truncate text-xs text-text-secondary">
                        {activity.detail}
                      </p>
                    ) : null}
                  </div>

                  <time
                    dateTime={activity.timestamp}
                    className="shrink-0 text-[11px] font-medium uppercase tracking-[1.5px] text-text-muted"
                  >
                    {formatTimestamp(activity.timestamp)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card.Body>
    </Card>
  );
}

/**
 * Ícone inline 14px por tipo. Usamos ícones diferentes dos da
 * `Sidebar` para que o padrão visual seja imediato (ex.: o
 * cronograma já tem um ícone de calendário no menu, então no feed
 * usamos um clock-face para sugerir "evento").
 */
function ActivityIcon({ type }: { type: DashboardActivityType }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 14,
    height: 14,
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    className: 'text-text-muted',
  };

  switch (type) {
    case 'event':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'announcement':
      return (
        <svg {...common}>
          <path d="M3 11v2a2 2 0 002 2h2l5 4V5L7 9H5a2 2 0 00-2 2z" />
        </svg>
      );
    case 'project-status':
      return (
        <svg {...common}>
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
      );
    case 'goal-update':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
        </svg>
      );
  }
}
