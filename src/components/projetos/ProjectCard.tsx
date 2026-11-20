/**
 * Card de projeto da grade "Radar" (Fase 3): banner, etiquetas de
 * ferramenta e status, nome, descrição curta, equipe e "Ver detalhes".
 *
 * Nunca mostra preço nem proposta — isso fica nos detalhes, só para a
 * gestão. Sem banner, usa um fundo neutro com a inicial do projeto.
 */

import { StatusBadge } from '@/components/ui';
import type { ProjectItem } from '@/lib/projects';
import { PROJECT_STATUS_LABELS } from '@/lib/validators/project';

import { MemberAvatar } from './MemberAvatar';

const MAX_AVATARS = 4;

export interface ProjectCardProps {
  project: ProjectItem;
  onOpen: (project: ProjectItem) => void;
}

export function ProjectCard({ project, onOpen }: ProjectCardProps) {
  const shown = project.members.slice(0, MAX_AVATARS);
  const extra = project.members.length - shown.length;

  return (
    <article
      className="hover-card flex flex-col overflow-hidden rounded-lg border border-border bg-surface"
      data-testid="project-card"
    >
      <div className="relative aspect-[16/9] w-full border-b border-border bg-surface-raised">
        {project.bannerUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={project.bannerUrl}
            alt={`Banner do projeto ${project.name}`}
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center" aria-hidden="true">
            <span className="font-heading text-5xl font-bold text-border">
              {project.name.trim().charAt(0).toUpperCase() || '?'}
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex flex-wrap gap-1.5">
          <StatusBadge tone="neutral">{project.ferramenta}</StatusBadge>
          <StatusBadge tone={project.status === 'CONCLUIDO' ? 'ok' : 'info'}>
            {PROJECT_STATUS_LABELS[project.status]}
          </StatusBadge>
        </div>

        <h2 className="font-heading text-lg font-bold leading-tight text-text">{project.name}</h2>

        <p className="line-clamp-3 text-sm text-text-soft">
          {project.description || 'Sem descrição.'}
        </p>

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-3">
          {project.members.length === 0 ? (
            <span className="text-xs text-text-faint">Sem equipe alocada</span>
          ) : (
            <div
              className="flex items-center"
              aria-label={`Equipe: ${project.members.map((m) => m.name).join(', ')}`}
            >
              <div className="flex -space-x-2">
                {shown.map((m) => (
                  <MemberAvatar key={m.id} name={m.name} avatarUrl={m.avatarUrl} />
                ))}
              </div>
              {extra > 0 && <span className="ml-2 text-xs text-text-soft">+{extra}</span>}
            </div>
          )}

          <button
            type="button"
            onClick={() => onOpen(project)}
            className="min-h-[40px] shrink-0 rounded-md px-3 text-sm font-medium text-text transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
          >
            Ver detalhes
          </button>
        </div>
      </div>
    </article>
  );
}
