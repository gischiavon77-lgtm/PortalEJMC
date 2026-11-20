/**
 * Coluna direita da página inicial (Fase 2 da reforma): três cards.
 *
 *   (a) Mural de Avisos — comunicados recentes, com link para Comunicados.
 *   (b) Destaque do Mês — os cinco destaques, com link para `/destaques`.
 *   (c) Próximos Eventos — dia, mês, título e horário, com link para o
 *       Cronograma.
 *
 * Cada card mostra um estado vazio quando não há conteúdo. Sem estado
 * próprio: renderizado no servidor com os dados de `getHomeSidebar`.
 */

import Link from 'next/link';
import type { ReactNode } from 'react';

import { EmptyState } from '@/components/ui';
import type { HomeSidebarData } from '@/lib/home';

function SidebarCard({
  title,
  icon,
  link,
  children,
}: {
  title: string;
  icon: ReactNode;
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="hover-card overflow-hidden rounded-lg border border-border bg-surface">
      <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
        <h2 className="flex items-center gap-2 font-heading text-base font-bold text-text">
          <span className="text-brand" aria-hidden="true">
            {icon}
          </span>
          {title}
        </h2>
        {link && (
          <Link
            href={link.href}
            className="rounded text-xs font-medium text-text-soft transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            {link.label}
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function BellIcon() {
  return (
    <svg {...iconProps}>
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

function AwardIcon() {
  return (
    <svg {...iconProps}>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg {...iconProps}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function formatNoticeDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'short',
  }).format(new Date(iso));
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function HomeSidebar({ data }: { data: HomeSidebarData }) {
  const { notices, highlights, events } = data;

  return (
    <aside className="flex flex-col gap-4" aria-label="Avisos, destaques e eventos">
      <SidebarCard
        title="Mural de Avisos"
        icon={<BellIcon />}
        link={{ href: '/comunicados', label: 'Ver todos' }}
      >
        {notices.length === 0 ? (
          <EmptyState message="Nenhum aviso no momento." className="py-6" />
        ) : (
          <ul className="divide-y divide-border">
            {notices.map((notice) => (
              <li key={notice.id}>
                <Link
                  href="/comunicados"
                  className="block px-4 py-3 transition-colors hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-white/30"
                >
                  <p className="line-clamp-2 text-sm font-semibold text-text">{notice.title}</p>
                  <p className="mt-0.5 text-xs text-text-faint">
                    {notice.authorName} · {formatNoticeDate(notice.createdAt)}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </SidebarCard>

      <SidebarCard
        title="Destaque do Mês"
        icon={<AwardIcon />}
        link={{ href: '/destaques', label: 'Ver todos' }}
      >
        {highlights.length === 0 ? (
          <EmptyState message="Nenhum destaque definido." className="py-6" />
        ) : (
          <ul className="divide-y divide-border">
            {highlights.map((h) => (
              <li key={h.slot} className="flex items-center gap-3 px-4 py-3">
                {h.photoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={h.photoUrl}
                    alt={`Foto de ${h.name}`}
                    className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
                  />
                ) : (
                  <span
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-border bg-surface-raised text-xs font-semibold text-text"
                    aria-hidden="true"
                  >
                    {getInitials(h.name)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{h.name}</p>
                  <p className="truncate text-xs text-text-faint">{h.label}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SidebarCard>

      <SidebarCard
        title="Próximos Eventos"
        icon={<CalendarIcon />}
        link={{ href: '/cronograma', label: 'Calendário' }}
      >
        {events.length === 0 ? (
          <EmptyState message="Nenhum evento agendado." className="py-6" />
        ) : (
          <ul className="divide-y divide-border" data-testid="home-upcoming-events">
            {events.map((event) => (
              <li key={event.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-md border border-border bg-surface-raised"
                  aria-hidden="true"
                >
                  <span className="font-heading text-lg font-bold leading-none text-text">
                    {event.day}
                  </span>
                  <span className="mt-0.5 text-[11px] text-text-soft">{event.month}</span>
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{event.title}</p>
                  <p className="text-xs text-text-faint">
                    <span className="sr-only">
                      {event.day} de {event.month},{' '}
                    </span>
                    {event.time}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </SidebarCard>
    </aside>
  );
}
