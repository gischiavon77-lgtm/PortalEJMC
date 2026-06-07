'use client';

/**
 * `ProjectsList` — Listagem responsiva de projetos (Task 13.3).
 *
 * Renderiza dois layouts a partir do mesmo dataset:
 *
 *   - **Mobile (<768px)**: cada projeto vira um cartão vertical com
 *     nome e badge de status. Cada card é um link para a página de
 *     detalhes do projeto.
 *
 *   - **Desktop/Tablet (≥768px)**: tabela com colunas Nome e Status.
 *     Linhas são links clicáveis para a página de detalhes.
 */

import Link from 'next/link';
import type { ProjectStatus } from '@prisma/client';

import { Badge, type BadgeVariant } from '@/components/ui';

export interface ProjectItem {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: string;
}

export interface ProjectsListProps {
  projects: ProjectItem[];
}

/** Mapeamento de status para label legível. */
const STATUS_LABELS: Record<ProjectStatus, string> = {
  EM_ANDAMENTO: 'Em Andamento',
  CONCLUIDO: 'Concluído',
  CONGELADO: 'Congelado',
  CANCELADO: 'Cancelado',
};

/** Mapeamento de status para variante do Badge. */
const STATUS_VARIANT: Record<ProjectStatus, BadgeVariant> = {
  EM_ANDAMENTO: 'info',
  CONCLUIDO: 'success',
  CONGELADO: 'warning',
  CANCELADO: 'error',
};

function StatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge variant={STATUS_VARIANT[status]} size="sm" withDot>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

export function ProjectsList({ projects }: ProjectsListProps) {
  return (
    <div role="region" aria-label="Lista de projetos" className="w-full">
      {/* ─── Mobile: cartões empilhados (visível apenas <768px) ─── */}
      <ul
        className="flex tablet:hidden flex-col gap-3"
        aria-label="Projetos (visualização em cartões)"
      >
        {projects.map((project) => (
          <li key={project.id}>
            <Link
              href={`/projetos/${project.id}`}
              className="block rounded-lg border border-border-light bg-surface-card p-4 shadow-sm transition-colors hover:border-red-core/30 hover:bg-cream/40"
            >
              <div className="flex items-center justify-between gap-3">
                <p className="min-w-0 truncate font-heading text-base font-semibold text-text-primary">
                  {project.name}
                </p>
                <div className="flex-shrink-0">
                  <StatusBadge status={project.status} />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* ─── Desktop/Tablet: tabela (escondido em <768px) ─── */}
      <div className="hidden tablet:block w-full overflow-hidden rounded-lg border border-border-light bg-surface-card shadow-sm">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Lista de projetos da empresa, ordenada alfabeticamente por nome.
          </caption>
          <thead className="bg-surface-bg/60">
            <tr>
              <th
                scope="col"
                className="border-b border-border-light px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Nome
              </th>
              <th
                scope="col"
                className="border-b border-border-light px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Status
              </th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr
                key={project.id}
                className="border-b border-border-light last:border-b-0 transition-colors hover:bg-cream/40"
              >
                <td className="px-4 py-3 align-middle">
                  <Link
                    href={`/projetos/${project.id}`}
                    className="font-medium text-text-primary hover:text-red-core hover:underline"
                  >
                    {project.name}
                  </Link>
                </td>
                <td className="px-4 py-3 align-middle">
                  <StatusBadge status={project.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
