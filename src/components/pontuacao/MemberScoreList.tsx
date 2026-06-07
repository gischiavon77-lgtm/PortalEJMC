'use client';

/**
 * `MemberScoreList` — Lista de todos os membros com pontuação
 * (Task 16.4 — visão GP + Diretor).
 *
 * Mostra nome, área e total de pontos. Cada linha é clicável para
 * visualizar o histórico individual do membro.
 */

import type { MemberScore } from '@/app/(portal)/pontuacao/page';

export interface MemberScoreListProps {
  members: MemberScore[];
  onViewMember: (id: string, name: string) => void;
}

const AREA_LABELS: Record<string, string> = {
  VENDAS: 'Vendas',
  PRESIDENCIA: 'Presidência',
  PROJETOS: 'Projetos',
  MARKETING: 'Marketing',
  GESTAO_PESSOAS: 'Gestão de Pessoas',
  ADM_FIN: 'Adm/Financeiro',
};

export function MemberScoreList({ members, onViewMember }: MemberScoreListProps) {
  if (members.length === 0) {
    return (
      <p
        role="status"
        className="rounded-lg border border-dashed border-border-light bg-surface-card p-8 text-center text-sm text-text-muted"
      >
        Nenhum membro ativo encontrado.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-1" role="list" aria-label="Pontuação dos membros">
      {/* Header */}
      <div className="hidden items-center gap-4 rounded-lg bg-surface-card px-4 py-2 text-xs font-semibold uppercase tracking-wide text-text-muted sm:flex">
        <span className="flex-1">Membro</span>
        <span className="w-32 text-center">Área</span>
        <span className="w-24 text-center">Pontos</span>
      </div>

      {members.map((member) => (
        <button
          key={member.id}
          type="button"
          role="listitem"
          onClick={() => onViewMember(member.id, member.name)}
          className="flex flex-col gap-1 rounded-lg border border-border-light bg-surface-card p-4 text-left transition-colors hover:border-red-core/30 hover:bg-red-core/5 sm:flex-row sm:items-center sm:gap-4"
        >
          <span className="flex-1 text-sm font-medium text-text-primary">{member.name}</span>
          <span className="w-32 text-center text-xs text-text-muted sm:block">
            {member.area ? (AREA_LABELS[member.area] ?? member.area) : '—'}
          </span>
          <span
            className={`w-24 text-center text-sm font-bold ${member.totalPoints > 0 ? 'text-red-vivid' : 'text-text-muted'}`}
          >
            {member.totalPoints}
          </span>
        </button>
      ))}
    </div>
  );
}
