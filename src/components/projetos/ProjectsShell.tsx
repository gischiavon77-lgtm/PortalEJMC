'use client';

/**
 * `ProjectsShell` — tela de projetos no estilo "Radar" (Fase 3).
 *
 *   - Cabeçalho com "Novo projeto" para quem tem `project:write`.
 *   - Números no topo: em andamento, concluídos e pessoas envolvidas.
 *   - Grade de cards (`ProjectCard`); "Ver detalhes" abre
 *     `ProjectDetailModal`, que traz preço e proposta só para a gestão.
 *   - Criar e editar em `ProjectForm`.
 *
 * Depois de salvar ou excluir, `router.refresh()` recarrega os dados do
 * servidor (lista e números).
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, EmptyState, PageHeader, StatCard, Toast } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';
import type { ProjectDetail, ProjectItem, ProjectStats } from '@/lib/projects';

import { ProjectCard } from './ProjectCard';
import { ProjectDetailModal } from './ProjectDetailModal';
import { ProjectForm } from './ProjectForm';

export type { ProjectItem };

export interface ProjectsShellProps {
  projects: ProjectItem[];
  stats: ProjectStats;
}

export function ProjectsShell({ projects, stats }: ProjectsShellProps) {
  const router = useRouter();
  const { allowed: canManage } = usePermission('project:write');

  const [opened, setOpened] = useState<ProjectItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProjectDetail | null>(null);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });
  const dismissToast = useCallback(() => setToast((t) => ({ ...t, visible: false })), []);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(detail: ProjectDetail) {
    setOpened(null);
    setEditing(detail);
    setFormOpen(true);
  }

  function handleSaved(message: string) {
    setFormOpen(false);
    setEditing(null);
    router.refresh();
    setToast({ message, visible: true });
  }

  function handleDeleted() {
    setOpened(null);
    router.refresh();
    setToast({ message: 'Projeto excluído.', visible: true });
  }

  return (
    <div className="mx-auto w-full max-w-7xl">
      <PageHeader
        title="Projetos"
        subtitle="Projetos da EJMC, com ferramenta, status e equipe."
        action={
          canManage ? (
            <Button onClick={openCreate} data-testid="project-new">
              + Novo projeto
            </Button>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard value={stats.inProgress} label="Em andamento" />
        <StatCard value={stats.completed} label="Concluídos" />
        <StatCard
          value={stats.peopleInvolved}
          label="Pessoas envolvidas"
          hint="Nos projetos em andamento"
        />
      </div>

      {projects.length === 0 ? (
        <EmptyState
          bordered
          message="Nenhum projeto cadastrado."
          hint={canManage ? 'Use "Novo projeto" para cadastrar o primeiro.' : undefined}
        />
      ) : (
        <div className="grid gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} onOpen={setOpened} />
          ))}
        </div>
      )}

      <ProjectDetailModal
        project={opened}
        onClose={() => setOpened(null)}
        onEdit={openEdit}
        onDeleted={handleDeleted}
      />

      {canManage && (
        <ProjectForm
          open={formOpen}
          editProject={editing}
          onClose={() => {
            setFormOpen(false);
            setEditing(null);
          }}
          onSaved={handleSaved}
        />
      )}

      <Toast message={toast.message} visible={toast.visible} onDismiss={dismissToast} />
    </div>
  );
}
