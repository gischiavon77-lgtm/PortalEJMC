'use client';

/**
 * `ProjectsShell` — Casca client-side da página `/projetos` (redesenhada).
 *
 * Exibe uma tabela/card list com colunas:
 *   Nome, Ferramenta, Progresso (barra), Equipe, Preço, Proposta
 *
 * Features:
 *   - Tabela no desktop, cards no mobile
 *   - Progress bar com cor por faixa (vermelho/amarelo/verde)
 *   - Preço formatado como R$ X.XXX,XX
 *   - Equipe em badges/pills
 *   - Proposta como link "📄 Ver Proposta"
 *   - Botão "+ Novo Projeto" (Admin/Diretor via album:manage)
 *   - Edit/Delete inline (Admin/Diretor)
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Toast } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';

import { ProjectForm } from './ProjectForm';

export interface ProjectItem {
  id: string;
  name: string;
  ferramenta: string;
  progress: number;
  team: string;
  price: number;
  proposalUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProjectsShellProps {
  projects: ProjectItem[];
}

/** Formata número como moeda brasileira (R$ 1.500,00). */
function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

/** Retorna classe de cor da progress bar conforme faixa. */
function progressBarColor(progress: number): string {
  if (progress <= 33) return 'bg-red-500';
  if (progress <= 66) return 'bg-yellow-500';
  return 'bg-green-500';
}

/**
 * Abre a proposta (PDF) em uma nova aba.
 *
 * A proposta é armazenada como data URL base64 (`data:application/pdf;base64,...`).
 * Navegadores bloqueiam abrir `data:` URLs diretamente em nova aba
 * (resultando em "about:blank#blocked"). Para contornar, convertemos
 * o data URL em um Blob e abrimos uma `blob:` URL, que não é bloqueada.
 */
function openProposal(dataUrl: string): void {
  try {
    // Aceita data URLs (base64) e também URLs http(s) (caso futuro).
    if (!dataUrl.startsWith('data:')) {
      window.open(dataUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const [meta, base64] = dataUrl.split(',');
    const mimeMatch = meta.match(/data:([^;]+)/);
    const mime = mimeMatch ? mimeMatch[1] : 'application/pdf';

    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: mime });
    const blobUrl = URL.createObjectURL(blob);
    const win = window.open(blobUrl, '_blank', 'noopener,noreferrer');
    // Revoga o objeto após um tempo para liberar memória sem cortar
    // o carregamento da aba recém-aberta.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
    // Fallback: se o popup foi bloqueado, navega na própria aba.
    if (!win) {
      window.location.href = blobUrl;
    }
  } catch {
    // Em caso de falha de decodificação, tenta abrir o data URL direto.
    window.open(dataUrl, '_blank', 'noopener,noreferrer');
  }
}

export function ProjectsShell({ projects }: ProjectsShellProps) {
  const router = useRouter();

  const { allowed: canManage, isLoading: permissionLoading } = usePermission('album:manage');

  // Modal state
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectItem | null>(null);

  // Toast
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });
  const dismissToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  function handleSaved() {
    router.refresh();
    setToast({
      message: editingProject ? 'Projeto atualizado!' : 'Projeto criado com sucesso!',
      visible: true,
    });
    setEditingProject(null);
  }

  function handleEdit(project: ProjectItem) {
    setEditingProject(project);
    setFormOpen(true);
  }

  async function handleDelete(project: ProjectItem) {
    if (!confirm(`Deseja realmente excluir o projeto "${project.name}"?`)) return;

    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
        setToast({ message: 'Projeto excluído.', visible: true });
      } else {
        setToast({ message: 'Erro ao excluir projeto.', visible: true });
      }
    } catch {
      setToast({ message: 'Erro de conexão.', visible: true });
    }
  }

  function handleOpenCreate() {
    setEditingProject(null);
    setFormOpen(true);
  }

  const isEmpty = projects.length === 0;

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
            Lista de projetos da empresa, com progresso, equipe e proposta comercial.
          </p>
        </div>

        {/* Botão "+ Novo Projeto" — visível apenas para Admin/Diretor */}
        {!permissionLoading && canManage && (
          <div className="flex items-center">
            <Button type="button" variant="primary" size="sm" onClick={handleOpenCreate}>
              + Novo Projeto
            </Button>
          </div>
        )}
      </header>

      {isEmpty ? (
        <p
          role="status"
          className="rounded-lg border border-dashed border-border-light bg-surface-card p-8 text-center text-sm text-text-muted"
        >
          Nenhum projeto cadastrado no momento.
        </p>
      ) : (
        <>
          {/* ─── Mobile: cards (visible <768px) ─── */}
          <ul className="flex tablet:hidden flex-col gap-3" aria-label="Projetos (cartões)">
            {projects.map((project) => (
              <li key={project.id}>
                <div className="rounded-lg border border-border-light bg-surface-card p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-heading text-base font-semibold text-text-primary truncate">
                        {project.name}
                      </p>
                      <p className="text-xs text-text-muted mt-0.5">{project.ferramenta}</p>
                    </div>
                    {canManage && (
                      <div className="flex gap-1 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(project)}
                          className="text-xs text-blue-600 hover:underline"
                          aria-label={`Editar ${project.name}`}
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDelete(project)}
                          className="text-xs text-red-600 hover:underline"
                          aria-label={`Excluir ${project.name}`}
                        >
                          🗑️
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                      <span>Progresso</span>
                      <span>{project.progress}%</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${progressBarColor(project.progress)}`}
                        style={{ width: `${project.progress}%` }}
                      />
                    </div>
                  </div>

                  {/* Team */}
                  {project.team && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {project.team.split(',').map((member, i) => (
                        <span
                          key={i}
                          className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-secondary"
                        >
                          {member.trim()}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Price & Proposal */}
                  <div className="mt-3 flex items-center justify-between text-sm">
                    <span className="font-medium text-text-primary">
                      {formatBRL(project.price)}
                    </span>
                    {project.proposalUrl && (
                      <button
                        type="button"
                        onClick={() => openProposal(project.proposalUrl!)}
                        className="text-blue-600 hover:underline text-xs"
                      >
                        📄 Ver Proposta
                      </button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>

          {/* ─── Desktop/Tablet: table (hidden <768px) ─── */}
          <div className="hidden tablet:block w-full overflow-hidden rounded-lg border border-border-light bg-surface-card shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <caption className="sr-only">Lista de projetos da empresa.</caption>
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
                      Ferramenta
                    </th>
                    <th
                      scope="col"
                      className="border-b border-border-light px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                    >
                      Progresso
                    </th>
                    <th
                      scope="col"
                      className="border-b border-border-light px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                    >
                      Equipe
                    </th>
                    <th
                      scope="col"
                      className="border-b border-border-light px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                    >
                      Preço
                    </th>
                    <th
                      scope="col"
                      className="border-b border-border-light px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                    >
                      Proposta
                    </th>
                    {canManage && (
                      <th
                        scope="col"
                        className="border-b border-border-light px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
                      >
                        Ações
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => (
                    <tr
                      key={project.id}
                      className="border-b border-border-light last:border-b-0 transition-colors hover:bg-cream/40"
                    >
                      <td className="px-4 py-3 align-middle font-medium text-text-primary">
                        {project.name}
                      </td>
                      <td className="px-4 py-3 align-middle text-text-secondary">
                        {project.ferramenta}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-20 rounded-full bg-gray-200 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${progressBarColor(project.progress)}`}
                              style={{ width: `${project.progress}%` }}
                            />
                          </div>
                          <span className="text-xs text-text-muted">{project.progress}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex flex-wrap gap-1 max-w-[200px]">
                          {project.team ? (
                            project.team.split(',').map((member, i) => (
                              <span
                                key={i}
                                className="inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-text-secondary"
                              >
                                {member.trim()}
                              </span>
                            ))
                          ) : (
                            <span className="text-text-muted text-xs">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-text-primary whitespace-nowrap">
                        {formatBRL(project.price)}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        {project.proposalUrl ? (
                          <button
                            type="button"
                            onClick={() => openProposal(project.proposalUrl!)}
                            className="text-blue-600 hover:underline text-xs whitespace-nowrap"
                          >
                            📄 Ver Proposta
                          </button>
                        ) : (
                          <span className="text-text-muted text-xs">—</span>
                        )}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 align-middle">
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleEdit(project)}
                              className="text-xs text-blue-600 hover:underline"
                              aria-label={`Editar ${project.name}`}
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => handleDelete(project)}
                              className="text-xs text-red-600 hover:underline"
                              aria-label={`Excluir ${project.name}`}
                            >
                              Excluir
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Modal de criação/edição */}
      {canManage && (
        <ProjectForm
          open={formOpen}
          onClose={() => {
            setFormOpen(false);
            setEditingProject(null);
          }}
          onSaved={handleSaved}
          editProject={editingProject}
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
