'use client';

/**
 * `PontuacaoShell` — Casca client-side da página `/pontuacao`
 * (Tasks 16.4, 16.5, 16.6, 16.7).
 *
 * Oferece duas visões:
 *   1. Pontuação própria (todos os usuários): histórico pessoal do semestre.
 *   2. Todos os membros (GP + Diretor): lista de membros com pontuação,
 *      clicável para ver o histórico individual.
 *
 * Inclui:
 *   - Formulário de registro de infração (GP apenas)
 *   - Botão de exclusão (GP + Diretor)
 *   - Toast de confirmação
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button, Toast } from '@/components/ui';
import type { InfractionItem, MemberScore } from '@/app/(portal)/pontuacao/page';

import { InfractionForm } from './InfractionForm';
import { ScoreHistory } from './ScoreHistory';
import { MemberScoreList } from './MemberScoreList';

export interface PontuacaoShellProps {
  ownInfractions: InfractionItem[];
  ownTotalPoints: number;
  semester: string;
  canViewAll: boolean;
  canCreate: boolean;
  canDelete: boolean;
  allMembers: MemberScore[];
  activeUsers: { id: string; name: string }[];
}

type ViewMode = 'own' | 'all' | 'member-detail';

export function PontuacaoShell({
  ownInfractions,
  ownTotalPoints,
  semester,
  canViewAll,
  canCreate,
  canDelete,
  allMembers,
  activeUsers,
}: PontuacaoShellProps) {
  const router = useRouter();

  const [viewMode, setViewMode] = useState<ViewMode>(canViewAll ? 'all' : 'own');
  const [selectedMember, setSelectedMember] = useState<{ id: string; name: string } | null>(null);
  const [memberInfractions, setMemberInfractions] = useState<InfractionItem[]>([]);
  const [memberTotalPoints, setMemberTotalPoints] = useState(0);
  const [loadingMember, setLoadingMember] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    visible: boolean;
    variant: 'success' | 'error';
  }>({
    message: '',
    visible: false,
    variant: 'success',
  });

  const dismissToast = useCallback(() => {
    setToast((prev) => ({ ...prev, visible: false }));
  }, []);

  function showToast(message: string, variant: 'success' | 'error' = 'success') {
    setToast({ message, visible: true, variant });
  }

  async function handleViewMember(memberId: string, memberName: string) {
    setLoadingMember(true);
    setSelectedMember({ id: memberId, name: memberName });
    setViewMode('member-detail');

    try {
      const res = await fetch(`/api/scores?userId=${memberId}&semester=${semester}`);
      if (res.ok) {
        const data = await res.json();
        setMemberInfractions(data.infractions);
        setMemberTotalPoints(data.totalPoints);
      } else {
        showToast('Erro ao carregar histórico do membro.', 'error');
      }
    } catch {
      showToast('Erro de conexão. Tente novamente.', 'error');
    } finally {
      setLoadingMember(false);
    }
  }

  async function handleDelete(infractionId: string) {
    try {
      const res = await fetch(`/api/scores/${infractionId}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
        showToast('Infração excluída com sucesso!');
      } else {
        const data = await res.json().catch(() => null);
        showToast(data?.message ?? 'Não foi possível excluir a infração.', 'error');
      }
    } catch {
      showToast('Erro de conexão. Tente novamente.', 'error');
    }
  }

  function handleCreated() {
    router.refresh();
    setFormOpen(false);
    showToast('Infração registrada com sucesso!');
  }

  function handleBackToAll() {
    setViewMode('all');
    setSelectedMember(null);
    setMemberInfractions([]);
    setMemberTotalPoints(0);
  }

  const semesterLabel = formatSemester(semester);

  return (
    <section
      aria-labelledby="pontuacao-heading"
      className="mx-auto flex w-full max-w-4xl flex-col gap-6"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            Controle
          </p>
          <h1
            id="pontuacao-heading"
            className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
          >
            Pontuação
          </h1>
          <p className="text-text-secondary">Infrações e pontuação acumulada — {semesterLabel}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* View toggle for GP+Diretor */}
          {canViewAll && (
            <>
              <Button
                type="button"
                variant={viewMode === 'all' || viewMode === 'member-detail' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => {
                  setViewMode('all');
                  setSelectedMember(null);
                }}
              >
                Todos os membros
              </Button>
              <Button
                type="button"
                variant={viewMode === 'own' ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('own')}
              >
                Minha pontuação
              </Button>
            </>
          )}

          {/* Register infraction button (GP only) */}
          {canCreate && (
            <Button type="button" variant="primary" size="sm" onClick={() => setFormOpen(true)}>
              + Registrar infração
            </Button>
          )}
        </div>
      </header>

      {/* Own score view */}
      {viewMode === 'own' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-lg border border-border-light bg-surface-card p-4">
            <p className="text-sm text-text-secondary">Pontuação acumulada no semestre</p>
            <p className="text-3xl font-bold text-text-primary">
              {ownTotalPoints} {ownTotalPoints === 1 ? 'ponto' : 'pontos'}
            </p>
          </div>
          <ScoreHistory
            infractions={ownInfractions}
            canDelete={canDelete}
            onDelete={handleDelete}
          />
        </div>
      )}

      {/* All members view */}
      {viewMode === 'all' && canViewAll && (
        <MemberScoreList members={allMembers} onViewMember={handleViewMember} />
      )}

      {/* Individual member detail */}
      {viewMode === 'member-detail' && selectedMember && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={handleBackToAll}>
              ← Voltar
            </Button>
            <span className="text-lg font-semibold text-text-primary">{selectedMember.name}</span>
          </div>
          <div className="rounded-lg border border-border-light bg-surface-card p-4">
            <p className="text-sm text-text-secondary">Pontuação acumulada no semestre</p>
            <p className="text-3xl font-bold text-text-primary">
              {loadingMember
                ? '...'
                : `${memberTotalPoints} ${memberTotalPoints === 1 ? 'ponto' : 'pontos'}`}
            </p>
          </div>
          {loadingMember ? (
            <p className="text-center text-sm text-text-muted">Carregando...</p>
          ) : (
            <ScoreHistory
              infractions={memberInfractions}
              canDelete={canDelete}
              onDelete={handleDelete}
            />
          )}
        </div>
      )}

      {/* Infraction form modal */}
      {canCreate && (
        <InfractionForm
          open={formOpen}
          onClose={() => setFormOpen(false)}
          onSaved={handleCreated}
          activeUsers={activeUsers}
        />
      )}

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

// ─── Helpers ─────────────────────────────────────────────────────────

function formatSemester(semester: string): string {
  const [year, sem] = semester.split('-');
  return sem === '1' ? `1º Semestre ${year}` : `2º Semestre ${year}`;
}
