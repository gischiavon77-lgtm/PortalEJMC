'use client';

/**
 * `AdminShell` — Casca client-side da página `/admin` (Task 19.8).
 *
 * Gerencia:
 *   - Tabs de status (Pendentes, Ativas, Inativas)
 *   - Tabela de usuários com ações contextuais
 *   - Modal de criação de novo usuário
 *   - Toasts de feedback
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Badge, Toast } from '@/components/ui';
import { UserTable, type UserItem } from './UserTable';
import { CreateUserForm } from './CreateUserForm';

export type StatusTab = 'PENDING' | 'ACTIVE' | 'INACTIVE';

export interface AdminShellProps {
  users: UserItem[];
  currentTab: StatusTab;
}

const TAB_LABELS: Record<StatusTab, string> = {
  PENDING: 'Pendentes',
  ACTIVE: 'Ativas',
  INACTIVE: 'Inativas',
};

export function AdminShell({ users, currentTab }: AdminShellProps) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(false);
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

  function handleTabChange(tab: StatusTab) {
    router.push(`/admin?status=${tab}`);
  }

  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, variant, visible: true });
  }

  function handleActionComplete(message: string) {
    router.refresh();
    showToast(message);
  }

  function handleActionError(message: string) {
    showToast(message, 'error');
  }

  function handleCreated() {
    router.refresh();
    showToast('Conta criada com sucesso!');
  }

  const pendingCount = currentTab === 'PENDING' ? users.length : 0;

  return (
    <section
      aria-labelledby="admin-heading"
      className="mx-auto flex w-full max-w-5xl flex-col gap-6"
    >
      {/* Header */}
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            Administração
          </p>
          <h1
            id="admin-heading"
            className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
          >
            Gerenciar Contas
          </h1>
          <p className="text-text-secondary">
            Aprove, rejeite e gerencie as contas de membros do portal.
          </p>
        </div>

        <div className="flex items-center">
          <Button type="button" variant="primary" size="sm" onClick={() => setCreateOpen(true)}>
            + Nova conta
          </Button>
        </div>
      </header>

      {/* Tabs de status */}
      <div
        className="flex gap-1 rounded-lg bg-border-light/50 p-1"
        role="tablist"
        aria-label="Status das contas"
      >
        {(['PENDING', 'ACTIVE', 'INACTIVE'] as const).map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={currentTab === tab}
            onClick={() => handleTabChange(tab)}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              currentTab === tab
                ? 'bg-surface-card text-text-primary shadow-sm'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {TAB_LABELS[tab]}
            {tab === 'PENDING' && pendingCount > 0 && (
              <Badge variant="warning" size="sm">
                {pendingCount}
              </Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tabela de usuários */}
      {users.length === 0 ? (
        <p
          role="status"
          className="rounded-lg border border-dashed border-border-light bg-surface-card p-8 text-center text-sm text-text-muted"
        >
          Nenhuma conta {TAB_LABELS[currentTab].toLowerCase()} no momento.
        </p>
      ) : (
        <UserTable
          users={users}
          status={currentTab}
          onActionComplete={handleActionComplete}
          onActionError={handleActionError}
        />
      )}

      {/* Modal de criação */}
      <CreateUserForm
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={handleCreated}
      />

      {/* Toast de feedback */}
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
