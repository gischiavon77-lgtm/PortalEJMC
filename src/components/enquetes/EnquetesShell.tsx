'use client';

/**
 * `EnquetesShell` — Casca client-side da página `/enquetes`
 * (Tasks 15.3, 15.4, 15.5, 15.6, 15.7).
 *
 * Recebe a lista pré-renderizada pelo Server Component e adiciona:
 *   1. Empty-state quando não há enquetes
 *   2. Formulário de criação (Diretor/Gerente via `poll:create`)
 *   3. Votação (qualquer usuário autenticado)
 *   4. Encerramento (Diretor/Gerente via `poll:close`)
 *   5. Toast de confirmação após ações
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Toast } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';

import { PollCard, type PollItem } from './PollCard';
import { PollForm } from './PollForm';

export interface EnquetesShellProps {
  polls: PollItem[];
}

export function EnquetesShell({ polls }: EnquetesShellProps) {
  const router = useRouter();

  // Permissions
  const { allowed: canCreate, isLoading: createLoading } = usePermission('poll:create');
  const { allowed: canClose, isLoading: closeLoading } = usePermission('poll:close');

  // State
  const [createOpen, setCreateOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; visible: boolean }>({
    message: '',
    visible: false,
  });

  const dismissToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  function showToast(message: string) {
    setToast({ message, visible: true });
  }

  async function handleVote(pollId: string, optionId: string) {
    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.message ?? 'Não foi possível registrar seu voto.';
        showToast(message);
        return;
      }

      router.refresh();
      showToast('Voto registrado com sucesso!');
    } catch {
      showToast('Erro de conexão. Tente novamente.');
    }
  }

  async function handleClose(pollId: string) {
    try {
      const res = await fetch(`/api/polls/${pollId}/close`, {
        method: 'PATCH',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        const message = data?.message ?? 'Não foi possível encerrar a enquete.';
        showToast(message);
        return;
      }

      router.refresh();
      showToast('Enquete encerrada com sucesso!');
    } catch {
      showToast('Erro de conexão. Tente novamente.');
    }
  }

  function handleCreated() {
    router.refresh();
    showToast('Enquete criada com sucesso!');
  }

  const isEmpty = polls.length === 0;
  const permissionsLoading = createLoading || closeLoading;

  return (
    <section
      aria-labelledby="enquetes-heading"
      className="mx-auto flex w-full max-w-4xl flex-col gap-6"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            Votação
          </p>
          <h1
            id="enquetes-heading"
            className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
          >
            Enquetes
          </h1>
          <p className="text-text-secondary">Vote e acompanhe as enquetes da empresa.</p>
        </div>

        {/* Botão "Nova Enquete" — Diretor/Gerente apenas (Task 15.7) */}
        {!permissionsLoading && canCreate && (
          <div className="flex items-center">
            <Button type="button" variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
              + Nova enquete
            </Button>
          </div>
        )}
      </header>

      {/* Content */}
      {isEmpty ? (
        <p
          role="status"
          className="rounded-lg border border-dashed border-border-light bg-surface-card p-8 text-center text-sm text-text-muted"
        >
          Nenhuma enquete disponível no momento.
        </p>
      ) : (
        <div className="flex flex-col gap-4" role="feed" aria-label="Lista de enquetes">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              canClose={!permissionsLoading && canClose}
              onVote={handleVote}
              onClose={handleClose}
            />
          ))}
        </div>
      )}

      {/* Modal de criação */}
      {canCreate && (
        <PollForm open={createOpen} onClose={() => setCreateOpen(false)} onSaved={handleCreated} />
      )}

      {/* Toast */}
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
