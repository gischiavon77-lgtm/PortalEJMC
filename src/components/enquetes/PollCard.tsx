'use client';

/**
 * `PollCard` — Card individual de enquete (Tasks 15.3, 15.4, 15.5, 15.6).
 *
 * Exibe:
 *   - Título e descrição da enquete
 *   - Badge de status (Ativa / Encerrada)
 *   - Opções com contagem de votos e lista de votantes
 *   - Destaque na opção em que o usuário votou
 *   - Botão de votar (se ativa e não votou)
 *   - Botão de encerrar (se pode encerrar)
 *   - Autor e data de criação
 */

import { useState } from 'react';

import { Button } from '@/components/ui';

export interface PollOptionItem {
  id: string;
  text: string;
  voteCount: number;
  votes: { id: string; name: string }[];
}

export interface PollItem {
  id: string;
  title: string;
  description: string;
  status: 'ACTIVE' | 'CLOSED';
  createdBy: { id: string; name: string };
  options: PollOptionItem[];
  userVotedOptionId: string | null;
  createdAt: string;
  closedAt: string | null;
}

export interface PollCardProps {
  poll: PollItem;
  canClose: boolean;
  canDelete?: boolean;
  onVote: (pollId: string, optionId: string) => Promise<void>;
  onClose: (pollId: string) => Promise<void>;
  onDelete?: (pollId: string) => Promise<void>;
}

function formatDate(isoDate: string): string {
  const date = new Date(isoDate);
  return date.toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PollCard({
  poll,
  canClose,
  canDelete = false,
  onVote,
  onClose,
  onDelete,
}: PollCardProps) {
  const [votingOptionId, setVotingOptionId] = useState<string | null>(null);
  const [closing, setClosing] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.voteCount, 0);
  const isActive = poll.status === 'ACTIVE';
  const hasVoted = poll.userVotedOptionId !== null;
  const canVote = isActive; // Users can vote or change their vote

  async function handleVote(optionId: string) {
    setVotingOptionId(optionId);
    try {
      await onVote(poll.id, optionId);
    } finally {
      setVotingOptionId(null);
    }
  }

  async function handleClose() {
    setClosing(true);
    try {
      await onClose(poll.id);
    } finally {
      setClosing(false);
    }
  }

  async function handleDelete() {
    if (!onDelete) return;
    setDeleting(true);
    try {
      await onDelete(poll.id);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <article
      className="rounded-lg border border-border-light bg-surface-card p-5 shadow-sm transition-shadow hover:shadow-md"
      aria-labelledby={`poll-title-${poll.id}`}
    >
      {/* Header */}
      <header className="mb-3 flex flex-col gap-2">
        <div className="flex items-start justify-between gap-2">
          <h2
            id={`poll-title-${poll.id}`}
            className="font-heading text-lg font-semibold text-text-primary"
          >
            {poll.title}
          </h2>
          <span
            className={[
              'inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
              isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600',
            ].join(' ')}
          >
            {isActive ? 'Ativa' : 'Encerrada'}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-wrap">
          {poll.description}
        </p>
        <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
          <span className="font-medium text-text-secondary">{poll.createdBy.name}</span>
          <span aria-hidden="true">•</span>
          <time dateTime={poll.createdAt}>{formatDate(poll.createdAt)}</time>
          {totalVotes > 0 && (
            <>
              <span aria-hidden="true">•</span>
              <span>
                {totalVotes} voto{totalVotes !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </div>
      </header>

      {/* Options */}
      <div className="mt-4 flex flex-col gap-2" role="group" aria-label="Opções da enquete">
        {poll.options.map((option) => {
          const percentage = totalVotes > 0 ? Math.round((option.voteCount / totalVotes) * 100) : 0;
          const isSelected = poll.userVotedOptionId === option.id;
          const isVoting = votingOptionId === option.id;

          return (
            <div key={option.id} className="flex flex-col gap-1">
              <div
                className={[
                  'relative overflow-hidden rounded-md border p-3 transition-all',
                  isSelected
                    ? 'border-red-core bg-red-core/5 ring-1 ring-red-core/20'
                    : 'border-border-light bg-surface-bg',
                  canVote && !isSelected
                    ? 'cursor-pointer hover:border-red-core/40 hover:bg-red-core/5'
                    : '',
                  canVote && isSelected ? 'cursor-pointer' : '',
                ].join(' ')}
                onClick={canVote && !isSelected ? () => handleVote(option.id) : undefined}
                role={canVote && !isSelected ? 'button' : undefined}
                tabIndex={canVote && !isSelected ? 0 : undefined}
                onKeyDown={
                  canVote && !isSelected
                    ? (e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleVote(option.id);
                        }
                      }
                    : undefined
                }
                aria-pressed={canVote ? isSelected : undefined}
                aria-label={
                  canVote && !isSelected
                    ? `Votar em: ${option.text}`
                    : isSelected
                      ? `Seu voto atual: ${option.text}`
                      : undefined
                }
              >
                {/* Progress bar background */}
                {(hasVoted || !isActive) && (
                  <div
                    className={[
                      'absolute inset-y-0 left-0 transition-all',
                      isSelected ? 'bg-red-core/10' : 'bg-gray-100',
                    ].join(' ')}
                    style={{ width: `${percentage}%` }}
                    aria-hidden="true"
                  />
                )}

                <div className="relative flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    {isSelected && (
                      <span className="text-red-core" aria-label="Seu voto">
                        ✓
                      </span>
                    )}
                    <span
                      className={[
                        'text-sm',
                        isSelected ? 'font-medium text-text-primary' : 'text-text-secondary',
                      ].join(' ')}
                    >
                      {option.text}
                    </span>
                  </div>

                  {(hasVoted || !isActive) && (
                    <span className="shrink-0 text-xs font-medium text-text-muted">
                      {option.voteCount} ({percentage}%)
                    </span>
                  )}

                  {isVoting && (
                    <span className="shrink-0 text-xs text-text-muted animate-pulse">
                      Votando...
                    </span>
                  )}
                </div>
              </div>

              {/* Voter names — shown after voting or when closed */}
              {(hasVoted || !isActive) && option.votes.length > 0 && (
                <p className="ml-3 text-xs text-text-muted">
                  {option.votes.map((v) => v.name).join(', ')}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Actions */}
      {((isActive && canClose) || canDelete) && (
        <div className="mt-4 flex justify-end gap-2 border-t border-border-light pt-3">
          {canDelete && onDelete && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-red-vivid hover:bg-red-vivid/10"
              onClick={handleDelete}
              loading={deleting}
              disabled={deleting}
            >
              Excluir
            </Button>
          )}
          {isActive && canClose && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleClose}
              loading={closing}
              disabled={closing}
            >
              Encerrar enquete
            </Button>
          )}
        </div>
      )}

      {/* Closed info */}
      {!isActive && poll.closedAt && (
        <div className="mt-3 border-t border-border-light pt-3">
          <p className="text-xs text-text-muted">Encerrada em {formatDate(poll.closedAt)}</p>
        </div>
      )}
    </article>
  );
}
