'use client';

/**
 * `AnnouncementCard` — Card de comunicado individual (Task 14.4).
 *
 * Exibe:
 *   - Título em destaque
 *   - Conteúdo (texto completo, com whitespace preservado)
 *   - Nome do autor
 *   - Data de publicação (formatada em pt-BR)
 */

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  author: {
    id: string;
    name: string;
  };
  createdAt: string;
}

export interface AnnouncementCardProps {
  announcement: AnnouncementItem;
  /** Quando true, exibe o botão de exclusão. */
  canDelete?: boolean;
  /** Disparado ao confirmar a exclusão. */
  onDelete?: (announcement: AnnouncementItem) => void;
}

/**
 * Formata data ISO para exibição legível em português.
 * Ex.: "15 de janeiro de 2024 às 14:30"
 */
function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AnnouncementCard({
  announcement,
  canDelete = false,
  onDelete,
}: AnnouncementCardProps) {
  return (
    <article
      className="rounded-lg border border-border-light bg-surface-card p-5 shadow-sm transition-shadow hover:shadow-md"
      aria-labelledby={`announcement-title-${announcement.id}`}
    >
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id={`announcement-title-${announcement.id}`}
            className="font-heading text-lg font-semibold text-text-primary"
          >
            {announcement.title}
          </h2>
          <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
            <span className="font-medium text-text-secondary">{announcement.author.name}</span>
            <span aria-hidden="true">•</span>
            <time dateTime={announcement.createdAt}>{formatDate(announcement.createdAt)}</time>
          </div>
        </div>

        {canDelete && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(announcement)}
            aria-label={`Excluir comunicado ${announcement.title}`}
            className="shrink-0 rounded-md px-2 py-1 text-xs font-semibold text-red-vivid transition-colors hover:bg-red-vivid/10"
          >
            Excluir
          </button>
        )}
      </header>

      <div className="whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
        {announcement.content}
      </div>
    </article>
  );
}
