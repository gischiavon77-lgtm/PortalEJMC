'use client';

/**
 * `PortfolioShell` — Casca client-side da página `/portfolio`
 * (Tasks 12.3, 12.4).
 *
 * Recebe a lista pré-renderizada pelo Server Component (já paginada
 * e ordenada alfabeticamente) e adiciona:
 *
 *   1. **Paginação** — controle de navegação de páginas com 50 itens
 *      por página. Trocar a página reescreve a URL via `router.push`
 *      e o Server Component refaz o fetch já com o offset correto.
 *
 *   2. **Empty-state** — quando não há serviços cadastrados, exibe
 *      uma mensagem informativa.
 *
 *   3. **Layout responsivo** — delegado ao `ServicesList`, que
 *      renderiza cartões em mobile e tabela em desktop.
 *
 *   4. **Formulário de adição/edição** (Task 12.4) — botão
 *      "Adicionar Serviço" e ações "Editar" por item, visíveis
 *      apenas para Admin/Diretor via `usePermission('service:write')`.
 *
 * ─── Estado de paginação na URL ───────────────────────────────────
 *
 * Manter a página na URL (`?page=...`) permite:
 *   - Compartilhamento: copiar o link preserva a posição.
 *   - Navegação: voltar/avançar funciona naturalmente.
 *   - SSR: o Server Component lê o `searchParams` e já entrega o
 *     dataset correto sem flash de recarregamento.
 */

import { useCallback, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { Button, Pagination, Toast } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';

import { ServicesList, type ServiceItem } from './ServicesList';
import { ServiceForm } from './ServiceForm';

export interface PortfolioShellProps {
  services: ServiceItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export function PortfolioShell({ services, pagination }: PortfolioShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Permissão de escrita: Admin/Diretor (Task 12.4)
  const { allowed: canManage, isLoading: permissionLoading } = usePermission('service:write');

  // Estado dos modais de criação/edição
  const [createOpen, setCreateOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);

  // Toast de feedback (Task 12.5)
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
    router.push(qs ? `/portfolio?${qs}` : '/portfolio');
  }

  function handleCreateSaved() {
    router.refresh();
    setToast({ message: 'Serviço adicionado com sucesso!', visible: true });
  }

  function handleEditSaved() {
    router.refresh();
    setToast({ message: 'Serviço atualizado com sucesso!', visible: true });
  }

  const isEmpty = services.length === 0 && pagination.total === 0;

  // Summary text for pagination
  const start = (pagination.page - 1) * pagination.pageSize + 1;
  const end = Math.min(pagination.page * pagination.pageSize, pagination.total);
  const summary =
    pagination.total > 0
      ? `Mostrando ${start}–${end} de ${pagination.total} serviço${pagination.total !== 1 ? 's' : ''}`
      : undefined;

  return (
    <section
      aria-labelledby="portfolio-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            Portfólio
          </p>
          <h1
            id="portfolio-heading"
            className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
          >
            Serviços
          </h1>
          <p className="text-text-secondary">
            Lista de serviços oferecidos pela empresa, em ordem alfabética.
          </p>
        </div>

        {/* Botão "Adicionar Serviço" — visível apenas para Admin/Diretor (Task 12.4) */}
        {!permissionLoading && canManage && (
          <div className="flex items-center">
            <Button type="button" variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              + Adicionar Serviço
            </Button>
          </div>
        )}
      </header>

      {/* Empty-state ou listagem responsiva */}
      {isEmpty ? (
        <p
          role="status"
          className="rounded-lg border border-dashed border-border-light bg-surface-card p-8 text-center text-sm text-text-muted"
        >
          Nenhum serviço cadastrado no portfólio.
        </p>
      ) : (
        <>
          <ServicesList
            services={services}
            canManage={canManage}
            onEdit={(service) => setEditingService(service)}
          />

          {/* Paginação (Task 12.3 — 50 por página) */}
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

      {/* Modais — montados apenas quando o usuário tem permissão (Task 12.4) */}
      {canManage && (
        <>
          <ServiceForm
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onSaved={handleCreateSaved}
          />
          <ServiceForm
            open={editingService !== null}
            onClose={() => setEditingService(null)}
            onSaved={handleEditSaved}
            editingService={editingService}
          />
        </>
      )}

      {/* Toast de confirmação (Task 12.5) */}
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
