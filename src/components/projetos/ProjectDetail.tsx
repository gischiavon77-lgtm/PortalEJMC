'use client';

/**
 * `ProjectDetail` — Casca client-side da página `/projetos/[id]`
 * (Tasks 13.4, 13.5).
 *
 * Exibe os detalhes completos de um projeto:
 *   - Nome e descrição
 *   - Status atual com badge colorido
 *   - Equipe (membros com nome, área e cargo)
 *   - Histórico de alterações de status (mais recente primeiro)
 *
 * Para admins (Task 13.5), exibe um dropdown para alterar o status
 * do projeto, com PATCH para a API e toast de confirmação.
 */

import { useCallback, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Area, ProjectStatus } from '@prisma/client';

import { Badge, Button, Toast, type BadgeVariant } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';
import { AREA_LABELS } from '@/lib/goals';

// ─── Types ───────────────────────────────────────────────────────────

export interface ProjectMemberItem {
  id: string;
  name: string;
  area: Area | null;
  position: string | null;
}

export interface StatusHistoryItem {
  id: string;
  oldStatus: ProjectStatus | null;
  newStatus: ProjectStatus;
  changedBy: string;
  changedAt: string;
}

export interface ProjectDetailData {
  id: string;
  name: string;
  description: string | null;
  status: ProjectStatus;
  members: ProjectMemberItem[];
  statusHistory: StatusHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

// ─── Constants ───────────────────────────────────────────────────────

const STATUS_LABELS: Record<ProjectStatus, string> = {
  EM_ANDAMENTO: 'Em Andamento',
  CONCLUIDO: 'Concluído',
  CONGELADO: 'Congelado',
  CANCELADO: 'Cancelado',
};

const STATUS_VARIANT: Record<ProjectStatus, BadgeVariant> = {
  EM_ANDAMENTO: 'info',
  CONCLUIDO: 'success',
  CONGELADO: 'warning',
  CANCELADO: 'error',
};

const STATUS_OPTIONS: { value: ProjectStatus; label: string }[] = [
  { value: 'EM_ANDAMENTO', label: 'Em Andamento' },
  { value: 'CONCLUIDO', label: 'Concluído' },
  { value: 'CONGELADO', label: 'Congelado' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

// ─── Props ───────────────────────────────────────────────────────────

export interface ProjectDetailProps {
  project: ProjectDetailData;
}

// ─── Component ───────────────────────────────────────────────────────

export function ProjectDetail({ project }: ProjectDetailProps) {
  const router = useRouter();

  // Admin check for status change (Task 13.5)
  const { allowed: canChangeStatus, isLoading: permissionLoading } =
    usePermission('project:updateStatus');

  const [selectedStatus, setSelectedStatus] = useState<ProjectStatus>(project.status);
  const [isUpdating, setIsUpdating] = useState(false);

  // Toast state
  const [toast, setToast] = useState<{
    message: string;
    variant: 'success' | 'error';
    visible: boolean;
  }>({
    message: '',
    variant: 'success',
    visible: false,
  });

  const dismissToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  async function handleStatusChange() {
    if (selectedStatus === project.status) return;

    setIsUpdating(true);
    try {
      const res = await fetch(`/api/projects/${project.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedStatus }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const msg = data?.message ?? 'Erro ao atualizar o status do projeto.';
        setToast({ message: msg, variant: 'error', visible: true });
        return;
      }

      setToast({
        message: 'Status do projeto atualizado com sucesso!',
        variant: 'success',
        visible: true,
      });
      router.refresh();
    } catch {
      setToast({
        message: 'Erro de conexão. Tente novamente.',
        variant: 'error',
        visible: true,
      });
    } finally {
      setIsUpdating(false);
    }
  }

  return (
    <section
      aria-labelledby="project-detail-heading"
      className="mx-auto flex w-full max-w-4xl flex-col gap-8"
    >
      {/* Voltar link */}
      <Link
        href="/projetos"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary hover:text-red-core transition-colors"
      >
        <svg
          viewBox="0 0 24 24"
          width="16"
          height="16"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <polyline points="15 18 9 12 15 6" />
        </svg>
        Voltar
      </Link>

      {/* Header: name + status */}
      <header className="flex flex-col gap-2">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            Projeto
          </p>
          <h1
            id="project-detail-heading"
            className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
          >
            {project.name}
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={STATUS_VARIANT[project.status]} size="md" withDot>
            {STATUS_LABELS[project.status]}
          </Badge>
        </div>
      </header>

      {/* Description */}
      {project.description && (
        <div className="rounded-lg border border-border-light bg-surface-card p-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[1.5px] text-text-muted">
            Descrição
          </h2>
          <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
            {project.description}
          </p>
        </div>
      )}

      {/* Status change - Admin only (Task 13.5) */}
      {!permissionLoading && canChangeStatus && (
        <div className="rounded-lg border border-border-light bg-surface-card p-5">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-[1.5px] text-text-muted">
            Alterar Status
          </h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex flex-1 flex-col gap-1.5">
              <label
                htmlFor="project-status-select"
                className="text-sm font-medium text-text-secondary"
              >
                Novo status
              </label>
              <select
                id="project-status-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as ProjectStatus)}
                disabled={isUpdating}
                className="h-10 w-full rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30 disabled:opacity-60"
              >
                {STATUS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <Button
              variant="primary"
              size="md"
              loading={isUpdating}
              disabled={selectedStatus === project.status}
              onClick={handleStatusChange}
            >
              Salvar
            </Button>
          </div>
        </div>
      )}

      {/* Team members */}
      <div className="rounded-lg border border-border-light bg-surface-card p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[1.5px] text-text-muted">
          Equipe
        </h2>
        {project.members.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhum membro vinculado a este projeto.</p>
        ) : (
          <MemberList members={project.members} />
        )}
      </div>

      {/* Status history */}
      <div className="rounded-lg border border-border-light bg-surface-card p-5">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-[1.5px] text-text-muted">
          Histórico de Status
        </h2>
        {project.statusHistory.length === 0 ? (
          <p className="text-sm text-text-muted">Nenhuma alteração de status registrada.</p>
        ) : (
          <StatusHistory history={project.statusHistory} />
        )}
      </div>

      {/* Toast */}
      <Toast
        message={toast.message}
        variant={toast.variant}
        visible={toast.visible}
        onDismiss={dismissToast}
        duration={4000}
      />
    </section>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────

function MemberList({ members }: { members: ProjectMemberItem[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {members.map((member) => (
        <li
          key={member.id}
          className="flex flex-col gap-0.5 rounded-md border border-border-light/60 p-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-center sm:gap-3">
            <span className="font-medium text-text-primary">{member.name}</span>
            {member.position && (
              <span className="text-sm text-text-secondary">{member.position}</span>
            )}
          </div>
          {member.area && (
            <Badge variant="info" size="sm">
              {AREA_LABELS[member.area]}
            </Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

function StatusHistory({ history }: { history: StatusHistoryItem[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {history.map((entry) => (
        <li key={entry.id} className="flex flex-col gap-1 border-l-2 border-border-light pl-4 py-1">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            {entry.oldStatus ? (
              <Badge variant={STATUS_VARIANT[entry.oldStatus]} size="sm">
                {STATUS_LABELS[entry.oldStatus]}
              </Badge>
            ) : (
              <Badge variant="neutral" size="sm">
                (inicial)
              </Badge>
            )}
            <span className="text-text-muted" aria-hidden="true">
              →
            </span>
            <Badge variant={STATUS_VARIANT[entry.newStatus]} size="sm">
              {STATUS_LABELS[entry.newStatus]}
            </Badge>
          </div>
          <p className="text-xs text-text-muted">
            Por {entry.changedBy} em{' '}
            {new Date(entry.changedAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </p>
        </li>
      ))}
    </ul>
  );
}
