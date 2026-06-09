'use client';

/**
 * `UserTable` — Tabela de usuários para o módulo Admin (Task 19.8).
 *
 * Renderiza a lista de usuários com ações contextuais dependendo do
 * status/aba ativa:
 *   - Pendentes: Aprovar / Rejeitar
 *   - Ativas: Alterar nível de permissão / Desativar
 *   - Inativas: sem ações
 */

import { useState } from 'react';
import type { UserRole, Area } from '@prisma/client';

import { Button, Badge } from '@/components/ui';
import type { StatusTab } from './AdminShell';

export interface UserItem {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: string;
  area: Area | null;
  createdAt: string;
}

interface UserTableProps {
  users: UserItem[];
  status: StatusTab;
  onActionComplete: (message: string) => void;
  onActionError: (message: string) => void;
}

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Admin',
  DIRETOR: 'Diretor',
  GERENTE: 'Gerente',
  COORDENADOR: 'Coordenador',
  MEMBRO: 'Membro',
};

const AREA_LABELS: Record<Area, string> = {
  VENDAS: 'Vendas',
  PRESIDENCIA: 'Presidência',
  PROJETOS: 'Projetos',
  MARKETING: 'Marketing',
  GESTAO_PESSOAS: 'Gestão de Pessoas',
  ADM_FIN: 'Adm/Finanças',
};

const ROLES: UserRole[] = ['ADMIN', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'MEMBRO'];

const AREAS: Area[] = [
  'VENDAS',
  'PRESIDENCIA',
  'PROJETOS',
  'MARKETING',
  'GESTAO_PESSOAS',
  'ADM_FIN',
];

export function UserTable({ users, status, onActionComplete, onActionError }: UserTableProps) {
  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  async function handleApprove(userId: string) {
    setLoadingAction(`approve-${userId}`);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' }),
      });
      if (!res.ok) {
        const data = await res.json();
        onActionError(data.message || 'Erro ao aprovar conta.');
        return;
      }
      onActionComplete('Conta aprovada com sucesso! Email de notificação enviado.');
    } catch {
      onActionError('Erro de conexão ao aprovar conta.');
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleReject(userId: string) {
    setLoadingAction(`reject-${userId}`);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' }),
      });
      if (!res.ok) {
        const data = await res.json();
        onActionError(data.message || 'Erro ao rejeitar conta.');
        return;
      }
      onActionComplete('Conta rejeitada. Email de notificação enviado.');
    } catch {
      onActionError('Erro de conexão ao rejeitar conta.');
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleChangeRole(userId: string, newRole: UserRole) {
    setLoadingAction(`role-${userId}`);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changeRole', role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        onActionError(data.message || 'Erro ao alterar permissão.');
        return;
      }
      onActionComplete(`Permissão alterada para ${ROLE_LABELS[newRole]}.`);
    } catch {
      onActionError('Erro de conexão ao alterar permissão.');
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleChangeArea(userId: string, newArea: Area | null) {
    setLoadingAction(`area-${userId}`);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'changeArea', area: newArea }),
      });
      if (!res.ok) {
        const data = await res.json();
        onActionError(data.message || 'Erro ao alterar área.');
        return;
      }
      onActionComplete(`Área alterada para ${newArea ? AREA_LABELS[newArea] : 'Sem área'}.`);
    } catch {
      onActionError('Erro de conexão ao alterar área.');
    } finally {
      setLoadingAction(null);
    }
  }

  async function handleDeactivate(userId: string) {
    setLoadingAction(`deactivate-${userId}`);
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        onActionError(data.message || 'Erro ao desativar conta.');
        return;
      }
      onActionComplete('Conta desativada com sucesso.');
    } catch {
      onActionError('Erro de conexão ao desativar conta.');
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border-light bg-surface-card shadow-sm">
      <table className="w-full text-sm" aria-label="Tabela de usuários">
        <thead>
          <tr className="border-b border-border-light bg-surface-bg/50">
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Nome</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Email</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Nível</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Área</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Desde</th>
            {status !== 'INACTIVE' && (
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Ações</th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-border-light">
          {users.map((user) => (
            <tr key={user.id} className="hover:bg-surface-bg/30 transition-colors">
              <td className="px-4 py-3 font-medium text-text-primary">{user.name}</td>
              <td className="px-4 py-3 text-text-secondary">{user.email}</td>
              <td className="px-4 py-3">
                <Badge
                  variant={
                    user.role === 'ADMIN' ? 'error' : user.role === 'DIRETOR' ? 'info' : 'neutral'
                  }
                  size="sm"
                >
                  {ROLE_LABELS[user.role]}
                </Badge>
              </td>
              <td className="px-4 py-3 text-text-secondary">
                {user.area ? AREA_LABELS[user.area] : '—'}
              </td>
              <td className="px-4 py-3 text-text-muted">
                {new Date(user.createdAt).toLocaleDateString('pt-BR')}
              </td>
              {status !== 'INACTIVE' && (
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {/* Ações para contas pendentes */}
                    {status === 'PENDING' && (
                      <>
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          loading={loadingAction === `approve-${user.id}`}
                          disabled={loadingAction !== null}
                          onClick={() => handleApprove(user.id)}
                        >
                          Aprovar
                        </Button>
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          loading={loadingAction === `reject-${user.id}`}
                          disabled={loadingAction !== null}
                          onClick={() => handleReject(user.id)}
                        >
                          Rejeitar
                        </Button>
                      </>
                    )}

                    {/* Ações para contas ativas */}
                    {status === 'ACTIVE' && (
                      <>
                        <RoleSelector
                          currentRole={user.role}
                          disabled={loadingAction !== null}
                          loading={loadingAction === `role-${user.id}`}
                          onChange={(newRole) => handleChangeRole(user.id, newRole)}
                        />
                        <AreaSelector
                          currentArea={user.area}
                          disabled={loadingAction !== null}
                          loading={loadingAction === `area-${user.id}`}
                          onChange={(newArea) => handleChangeArea(user.id, newArea)}
                        />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          loading={loadingAction === `deactivate-${user.id}`}
                          disabled={loadingAction !== null}
                          onClick={() => handleDeactivate(user.id)}
                        >
                          Desativar
                        </Button>
                      </>
                    )}
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Sub-componente: Dropdown de seleção de papel ────────────────────────────

interface RoleSelectorProps {
  currentRole: UserRole;
  disabled: boolean;
  loading: boolean;
  onChange: (role: UserRole) => void;
}

function RoleSelector({ currentRole, disabled, loading, onChange }: RoleSelectorProps) {
  return (
    <select
      value={currentRole}
      disabled={disabled || loading}
      onChange={(e) => {
        const newRole = e.target.value as UserRole;
        if (newRole !== currentRole) {
          onChange(newRole);
        }
      }}
      aria-label="Alterar nível de permissão"
      className="rounded-md border border-border-light bg-surface-card px-2 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-red-core/30 disabled:opacity-50"
    >
      {ROLES.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]}
        </option>
      ))}
    </select>
  );
}

// ─── Sub-componente: Dropdown de seleção de área ─────────────────────────────

interface AreaSelectorProps {
  currentArea: Area | null;
  disabled: boolean;
  loading: boolean;
  onChange: (area: Area | null) => void;
}

function AreaSelector({ currentArea, disabled, loading, onChange }: AreaSelectorProps) {
  return (
    <select
      value={currentArea ?? ''}
      disabled={disabled || loading}
      onChange={(e) => {
        const value = e.target.value;
        const newArea = value === '' ? null : (value as Area);
        if (newArea !== currentArea) {
          onChange(newArea);
        }
      }}
      aria-label="Alterar área"
      className="rounded-md border border-border-light bg-surface-card px-2 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-text-muted focus:outline-none focus:ring-2 focus:ring-red-core/30 disabled:opacity-50"
    >
      <option value="">Sem área</option>
      {AREAS.map((area) => (
        <option key={area} value={area}>
          {AREA_LABELS[area]}
        </option>
      ))}
    </select>
  );
}
