'use client';

/**
 * Detalhes de um projeto (Fase 3), numa janela sobre a lista.
 *
 * Busca `GET /api/projects/:id` ao abrir. O servidor só inclui preço e
 * informação de proposta (`management`) para quem tem `project:write`;
 * esta tela apenas mostra o que veio. Para a gestão, oferece também
 * "Ver proposta", Editar e Excluir.
 */

import { useEffect, useState } from 'react';

import { Button, Modal, StatusBadge } from '@/components/ui';
import { getAreaTheme } from '@/lib/area-theme';
import { proposalUrlFor } from '@/lib/file-urls';
import type { ProjectDetail, ProjectItem } from '@/lib/projects';
import { PROJECT_STATUS_LABELS } from '@/lib/validators/project';

import { MemberAvatar } from './MemberAvatar';

export interface ProjectDetailModalProps {
  project: ProjectItem | null;
  onClose: () => void;
  onEdit: (detail: ProjectDetail) => void;
  onDeleted: () => void;
}

function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function ProjectDetailModal({
  project,
  onClose,
  onEdit,
  onDeleted,
}: ProjectDetailModalProps) {
  const [detail, setDetail] = useState<ProjectDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!project) return;
    let cancelled = false;
    setDetail(null);
    setError(null);
    fetch(`/api/projects/${encodeURIComponent(project.id)}`, { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = (await res.json()) as { project: ProjectDetail };
        if (!cancelled) setDetail(data.project);
      })
      .catch(() => {
        if (!cancelled) setError('Não foi possível carregar os detalhes do projeto.');
      });
    return () => {
      cancelled = true;
    };
  }, [project]);

  async function handleDelete() {
    if (!detail || deleting) return;
    if (!confirm(`Deseja realmente excluir o projeto "${detail.name}"?`)) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/projects/${encodeURIComponent(detail.id)}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error();
      onDeleted();
    } catch {
      setError('Não foi possível excluir o projeto.');
      setDeleting(false);
    }
  }

  // Enquanto carrega, mostra o que já veio da listagem.
  const shown: ProjectItem | null = detail ?? project;
  const management = detail?.management ?? null;

  return (
    <Modal
      open={project !== null}
      onClose={onClose}
      title={shown?.name ?? 'Projeto'}
      size="xl"
      footer={
        management && detail ? (
          <>
            <Button variant="destructive" onClick={handleDelete} loading={deleting}>
              Excluir
            </Button>
            <Button variant="secondary" onClick={() => onEdit(detail)}>
              Editar
            </Button>
          </>
        ) : undefined
      }
    >
      {shown && (
        <div className="flex flex-col gap-5">
          {shown.bannerUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={shown.bannerUrl}
              alt={`Banner do projeto ${shown.name}`}
              className="aspect-[16/9] w-full rounded-md border border-border object-cover"
            />
          )}

          <div className="flex flex-wrap gap-1.5">
            <StatusBadge tone="neutral">{shown.ferramenta}</StatusBadge>
            <StatusBadge tone={shown.status === 'CONCLUIDO' ? 'ok' : 'info'}>
              {PROJECT_STATUS_LABELS[shown.status]}
            </StatusBadge>
          </div>

          <section>
            <h3 className="mb-1.5 text-base">Descrição</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-text-soft">
              {shown.description || 'Sem descrição.'}
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base">Equipe</h3>
            {shown.members.length === 0 ? (
              <p className="text-sm text-text-faint">Sem equipe alocada.</p>
            ) : (
              <ul className="grid gap-2 sm:grid-cols-2">
                {shown.members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <MemberAvatar
                      name={m.name}
                      avatarUrl={m.avatarUrl}
                      size="md"
                      className="border-border"
                    />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text">{m.name}</p>
                      <p className="truncate text-xs text-text-faint">
                        {[m.position, getAreaTheme(m.area).label].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {management && (
            <section
              className="rounded-md border border-border bg-surface-raised p-4"
              data-testid="project-management"
            >
              <h3 className="mb-2 text-base">Gestão</h3>
              <dl className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <div>
                  <dt className="text-xs text-text-faint">Preço</dt>
                  <dd className="font-semibold text-text">{formatBRL(management.price)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-text-faint">Proposta</dt>
                  <dd>
                    {management.hasProposal ? (
                      <a
                        href={proposalUrlFor(shown.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-text underline underline-offset-2 hover:text-text-soft"
                      >
                        Ver proposta (PDF)
                      </a>
                    ) : (
                      <span className="text-text-faint">Nenhuma anexada</span>
                    )}
                  </dd>
                </div>
              </dl>
            </section>
          )}

          {!detail && !error && <p className="text-xs text-text-faint">Carregando detalhes…</p>}
          {error && (
            <p role="alert" className="text-sm text-danger">
              {error}
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
