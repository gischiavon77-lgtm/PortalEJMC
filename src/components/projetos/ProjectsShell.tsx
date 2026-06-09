'use client';

/**
 * `ProjectsShell` — Casca client-side da página `/projetos`
 * (Tasks 13.3, 13.6).
 *
 * Recebe a lista pré-renderizada pelo Server Component (já filtrada,
 * paginada e ordenada alfabeticamente) e adiciona:
 *
 *   1. **Filtro por status** (Task 13.2) — dropdown com opções:
 *      Todos, Em Andamento, Concluído, Congelado, Cancelado.
 *      Trocar o status reescreve a URL via `router.push`.
 *
 *   2. **Paginação** — 50 por página com o componente Pagination.
 *
 *   3. **Empty-state** (Task 13.6) — quando o filtro não retorna
 *      resultados, exibe: "Nenhum projeto encontrado com o status
 *      selecionado."
 *
 *   4. **Layout responsivo** — delegado ao `ProjectsList`, que
 *      renderiza cartões em mobile e tabela em desktop.
 *
 *   5. **Botão "+ Novo Projeto"** — visível apenas para Admin via
 *      `usePermission('project:updateStatus')`. Abre modal de criação.
 */

import { useCallback, useState } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';
import type { ProjectStatus } from '@prisma/client';

import { Button, Pagination, Toast } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';

import { ProjectsList, type ProjectItem } from './ProjectsList';
import { ProjectForm } from './ProjectForm';

const STATUS_OPTIONS: { value: 'ALL' | ProjectStatus; label: string }[] = [
  { value: 'ALL', label: 'Todos' },
  { value: 'EM_ANDAMENTO', label: 'Em Andamento' },
  { value: 'CONCLUIDO', label: 'Concluído' },
  { value: 'CONGELADO', label: 'Congelado' },
  { value: 'CANCELADO', label: 'Cancelado' },
];

export interface ProjectsShellProps {
  projects: ProjectItem[];
  currentStatus: ProjectStatus | null;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function ProjectsShell({ projects, currentStatus, pagination }: ProjectsShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Admin permission for creating projects
  const { allowed: canCreate, isLoading: permissionLoading } =
    usePermission('project:updateStatus');

  // Modal state
  const [createOpen, setCreateOpen] = useState(false);

  // Toast de feedback
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });

  const dismissToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  function handleCreateSaved() {
    router.refresh();
    setToast({ message: 'Projeto criado com sucesso!', visible: true });
  }

  function handleStatusChange(value: 'ALL' | ProjectStatus) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value === 'ALL') {
      params.delete('status');
    } else {
      params.set('status', value);
    }
    // Reset to page 1 when filter changes
    params.delete('page');
    const qs = params.toString();
    router.push(qs ? `/projetos?${qs}` : '/projetos');
  }

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (newPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }
    const qs = params.toString();
    router.push(qs ? `/projetos?${qs}` : '/projetos');
  }

  const isEmpty = projects.length === 0;
  const emptyMessage = currentStatus
    ? 'Nenhum projeto encontrado com o status selecionado.'
    : 'Nenhum projeto cadastrado no momento.';

  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
  const summary =
    pagination.total > 0
      ? `Mostrando ${start}–${end} de ${pagination.total} projeto${pagination.total !== 1 ? 's' : ''}`
      : undefined;

  return (
    <section
      aria-labelledby="projetos-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            Gestão
          </p>
          <h1
            id="projetos-heading"
            className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
          >
            Projetos
          </h1>
          <p className="text-text-secondary">
            Lista de projetos da empresa, ordenada alfabeticamente.
          </p>
        </div>

        {/* Filtro por status + botão criar */}
        <div className="flex flex-col gap-3 tablet:flex-row tablet:items-end tablet:justify-between">
          <div className="flex w-full flex-col gap-1.5 tablet:max-w-xs desktop:max-w-xs">
            <label
              htmlFor="projetos-status-filter"
              className="text-xs font-semibold uppercase tracking-[1.5px] text-text-muted"
            >
              Filtrar por status
            </label>
            <select
              id="projetos-status-filter"
              value={currentStatus ?? 'ALL'}
              onChange={(e) => handleStatusChange(e.target.value as 'ALL' | ProjectStatus)}
              className="h-10 w-full rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Botão "+ Novo Projeto" — visível apenas para Admin */}
          {!permissionLoading && canCreate && (
            <div className="flex items-center">
              <Button type="button" variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
                + Novo Projeto
              </Button>
            </div>
          )}
        </div>
      </header>

      {/* Empty-state (Task 13.6) ou listagem responsiva (Task 13.3) */}
      {isEmpty ? (
        <p
          role="status"
          className="rounded-lg border border-dashed border-border-light bg-surface-card p-8 text-center text-sm text-text-muted"
        >
          {emptyMessage}
        </p>
      ) : (
        <>
          <ProjectsList projects={projects} />

          {/* Paginação (50 por página) */}
          {pagination.totalPages > 1 && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={handlePageChange}
              summary={summary}
            />
          )}
        </>
      )}
      {/* Modal de criação — montado apenas quando Admin */}
      {canCreate && (
        <ProjectForm
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={handleCreateSaved}
        />
      )}

      {/* Toast de confirmação */}
      <Toast
        message={toast.message}
        variant="success"
        visible={toast.visible}
        onDismiss={dismissToast}
        duration={4000}
      />
    </section>
  );
}
