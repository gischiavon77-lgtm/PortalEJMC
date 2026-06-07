'use client';

/**
 * `ComunicadosShell` — Casca client-side da página `/comunicados`
 * (Tasks 14.3, 14.5, 14.6).
 *
 * Recebe a lista pré-renderizada pelo Server Component (já paginada
 * e ordenada por data descendente) e adiciona:
 *
 *   1. **Paginação** — controle de navegação de páginas com 20 itens
 *      por página. Trocar a página reescreve a URL via `router.push`.
 *
 *   2. **Empty-state** (Task 14.6) — quando não há comunicados, exibe
 *      "Nenhum comunicado disponível no momento."
 *
 *   3. **Formulário de criação** (Task 14.5) — botão "Novo comunicado"
 *      visível apenas para Diretor/Gerente/Coordenador via
 *      `usePermission('announcement:create')`.
 *
 *   4. **Toast de confirmação** após criação com sucesso.
 */

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button, Pagination, Toast } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';

import { AnnouncementCard, type AnnouncementItem } from './AnnouncementCard';
import { AnnouncementForm } from './AnnouncementForm';

export interface ComunicadosShellProps {
  announcements: AnnouncementItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function ComunicadosShell({ announcements, pagination }: ComunicadosShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Permissão de criação: Coordenador+ (Task 14.5)
  const { allowed: canCreate, isLoading: permissionLoading } = usePermission('announcement:create');

  // Estado do modal de criação
  const [createOpen, setCreateOpen] = useState(false);

  // Toast de feedback
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });

  const dismissToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (newPage <= 1) {
      params.delete('page');
    } else {
      params.set('page', String(newPage));
    }
    const qs = params.toString();
    router.push(qs ? `/comunicados?${qs}` : '/comunicados');
  }

  function handleCreated() {
    router.refresh();
    setToast({ message: 'Comunicado publicado com sucesso!', visible: true });
  }

  const isEmpty = announcements.length === 0 && pagination.total === 0;

  // Summary text for pagination
  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
  const summary =
    pagination.total > 0
      ? `Mostrando ${start}–${end} de ${pagination.total} comunicado${pagination.total !== 1 ? 's' : ''}`
      : undefined;

  return (
    <section
      aria-labelledby="comunicados-heading"
      className="mx-auto flex w-full max-w-4xl flex-col gap-6"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            Mural
          </p>
          <h1
            id="comunicados-heading"
            className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
          >
            Comunicados
          </h1>
          <p className="text-text-secondary">Informes e avisos importantes da empresa.</p>
        </div>

        {/* Botão "Novo comunicado" — visível apenas para Coordenador+ (Task 14.5) */}
        {!permissionLoading && canCreate && (
          <div className="flex items-center">
            <Button type="button" variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              + Novo comunicado
            </Button>
          </div>
        )}
      </header>

      {/* Empty-state ou listagem de comunicados (Task 14.6) */}
      {isEmpty ? (
        <p
          role="status"
          className="rounded-lg border border-dashed border-border-light bg-surface-card p-8 text-center text-sm text-text-muted"
        >
          Nenhum comunicado disponível no momento.
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-4" role="feed" aria-label="Mural de comunicados">
            {announcements.map((announcement) => (
              <AnnouncementCard key={announcement.id} announcement={announcement} />
            ))}
          </div>

          {/* Paginação (Task 14.3 — 20 por página) */}
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

      {/* Modal de criação — montado apenas quando o usuário tem permissão (Task 14.5) */}
      {canCreate && (
        <AnnouncementForm
          open={createOpen}
          onClose={() => setCreateOpen(false)}
          onSaved={handleCreated}
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
