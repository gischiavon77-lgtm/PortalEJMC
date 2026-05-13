'use client';

/**
 * `GoalCard` — Card de exibição de uma meta (Tasks 8.4, 8.5, 8.6).
 *
 * Apresenta:
 *   - Tipo (Geral/Área) e badge de área quando aplicável.
 *   - Título e descrição.
 *   - Prazo formatado em pt-BR.
 *   - Barra de progresso com o valor inteiro 0-100% (Task 8.5).
 *   - Indicador visual de meta vencida quando `deadline` passou e
 *     `progress < 100` (Task 8.6 / Req 9.5 / Property 10).
 *   - Botão "Atualizar progresso" exibido apenas quando o usuário
 *     tem permissão `goal:updateProgress` (controle externo via
 *     `canManage`).
 *
 * É um Client Component porque emite `onUpdateProgress` ao clicar no
 * botão e usa `Intl.DateTimeFormat` (que poderia rodar em RSC, mas
 * unificamos o componente para um único bundle).
 *
 * ─── Acessibilidade ────────────────────────────────────────────────
 *
 *   - A barra de progresso é um `role="progressbar"` com
 *     `aria-valuemin/max/now` e `aria-label` descritivo.
 *   - O indicador de "vencida" é tanto visual (badge vermelho)
 *     quanto textual (rótulo "Vencida"), garantindo que a
 *     informação chegue a leitores de tela.
 *   - O título da meta usa `<h3>` (semântica do `Card.Title`).
 */

import { Badge, Button, Card } from '@/components/ui';
import { cn } from '@/components/ui/cn';
import {
  AREA_LABELS,
  GOAL_TYPE_LABELS,
  isGoalOverdue,
} from '@/lib/goals';
import type { Area } from '@prisma/client';

export interface GoalCardData {
  id: string;
  name: string;
  description: string;
  type: 'GENERAL' | 'AREA';
  area: Area | null;
  deadline: string; // ISO
  progress: number; // 0-100
}

export interface GoalCardProps {
  goal: GoalCardData;
  /**
   * Quando `true`, exibe o botão "Atualizar progresso". A decisão de
   * permissão é responsabilidade do parent (que consome
   * `usePermission('goal:updateProgress')`); o card só renderiza.
   */
  canManage?: boolean;
  /** Disparado quando o usuário clica em "Atualizar progresso". */
  onUpdateProgress?: (goal: GoalCardData) => void;
  /** Data atual injetável — útil para testes determinísticos. */
  now?: Date;
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

function formatDeadline(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return dateFormatter.format(date);
}

export function GoalCard({
  goal,
  canManage = false,
  onUpdateProgress,
  now,
}: GoalCardProps) {
  const overdue = isGoalOverdue(goal, now);
  const progressClamped = Math.min(100, Math.max(0, Math.round(goal.progress)));
  const completed = progressClamped >= 100;

  return (
    <Card
      variant="solid"
      padding="lg"
      className={cn(
        'flex h-full flex-col gap-4',
        // Borda esquerda em vermelho para destacar metas vencidas.
        // Não substitui o badge textual — é só reforço visual.
        overdue && 'border-l-4 border-l-red-vivid',
      )}
    >
      {/* Cabeçalho: tipo + área (se houver) + status */}
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="neutral" size="sm">
          {GOAL_TYPE_LABELS[goal.type]}
        </Badge>
        {goal.type === 'AREA' && goal.area && (
          <Badge variant="info" size="sm">
            {AREA_LABELS[goal.area]}
          </Badge>
        )}
        {overdue && (
          <Badge
            variant="error"
            size="sm"
            withDot
            data-testid="goal-overdue-indicator"
          >
            Vencida
          </Badge>
        )}
        {completed && !overdue && (
          <Badge variant="success" size="sm" withDot>
            Concluída
          </Badge>
        )}
      </div>

      {/* Conteúdo principal */}
      <div className="flex flex-1 flex-col gap-2">
        <h3 className="font-heading text-lg font-bold tracking-tight text-text-primary">
          {goal.name}
        </h3>
        {goal.description && (
          <p className="text-sm text-text-secondary">
            {goal.description}
          </p>
        )}

        <p className="text-xs text-text-muted">
          Prazo:{' '}
          <time dateTime={goal.deadline} className="font-medium">
            {formatDeadline(goal.deadline)}
          </time>
        </p>
      </div>

      {/* Barra de progresso (Task 8.5) */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold uppercase tracking-[1.5px] text-text-muted">
            Progresso
          </span>
          <span className="font-semibold tabular-nums text-text-primary">
            {progressClamped}%
          </span>
        </div>
        <div
          role="progressbar"
          aria-label={`Progresso da meta ${goal.name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={progressClamped}
          className="h-2 w-full overflow-hidden rounded-full bg-border-light"
        >
          <div
            className={cn(
              'h-full rounded-full transition-[width] duration-300',
              overdue
                ? 'bg-red-vivid'
                : completed
                  ? 'bg-emerald-500'
                  : 'bg-red-core',
            )}
            style={{ width: `${progressClamped}%` }}
          />
        </div>
      </div>

      {/* Ações (Task 8.8 — apenas Diretor/Admin) */}
      {canManage && onUpdateProgress && (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onUpdateProgress(goal)}
          >
            Atualizar progresso
          </Button>
        </div>
      )}
    </Card>
  );
}
