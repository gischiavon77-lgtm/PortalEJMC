'use client';

/**
 * `ScoreHistory` — Lista de infrações ordenada (mais recente primeiro)
 * (Tasks 16.6, 16.7).
 *
 * Exibe cada infração com tipo, data, pontos e quem registrou.
 * Inclui botão de exclusão quando o usuário tem permissão.
 */

import { Button } from '@/components/ui';
import type { InfractionItem } from '@/app/(portal)/pontuacao/page';

export interface ScoreHistoryProps {
  infractions: InfractionItem[];
  canDelete: boolean;
  onDelete: (id: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  ATRASO: 'Atraso',
  FALTA: 'Falta',
  DRESS_CODE: 'Dress Code',
};

const TYPE_COLORS: Record<string, string> = {
  ATRASO: 'bg-warn/15 text-warn',
  FALTA: 'bg-brand/20 text-danger',
  DRESS_CODE: 'bg-info/15 text-info',
};

export function ScoreHistory({ infractions, canDelete, onDelete }: ScoreHistoryProps) {
  if (infractions.length === 0) {
    return (
      <p
        role="status"
        className="rounded-lg border border-dashed border-border bg-surface p-8 text-center text-sm text-text-faint"
      >
        Nenhuma infração registrada neste semestre.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2" role="list" aria-label="Histórico de infrações">
      {infractions.map((infraction) => (
        <div
          key={infraction.id}
          role="listitem"
          className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${TYPE_COLORS[infraction.type] ?? 'bg-surface-raised text-text'}`}
              >
                {TYPE_LABELS[infraction.type] ?? infraction.type}
              </span>
              <span className="text-xs text-text-faint">{formatDate(infraction.date)}</span>
              <span className="text-xs font-semibold text-text">
                {infraction.points} {infraction.points === 1 ? 'ponto' : 'pontos'}
              </span>
            </div>
            <p className="text-xs text-text-faint">
              Registrado por {infraction.createdBy.name} em {formatDate(infraction.createdAt)}
            </p>
          </div>

          {canDelete && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onDelete(infraction.id)}
            >
              Excluir
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────

function formatDate(isoDate: string): string {
  const d = new Date(isoDate);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
