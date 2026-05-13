'use client';

/**
 * `GoalsShell` — Casca client-side da página `/metas` (Tasks 8.4, 8.7
 * e 8.8).
 *
 * Recebe a lista de metas pré-renderizada pelo Server Component e
 * adiciona:
 *
 *   1. Botão "Nova meta" (Task 8.7) — exibido apenas para Diretor/Admin
 *      via `usePermission('goal:create')`.
 *   2. Botões "Atualizar progresso" em cada card (Task 8.8) — exibidos
 *      apenas para Diretor/Admin via
 *      `usePermission('goal:updateProgress')`.
 *   3. Modais para criar/atualizar com revalidação por
 *      `router.refresh()` ao salvar.
 *
 * Como `goal:create` e `goal:updateProgress` são concedidos ao mesmo
 * conjunto de papéis pela matriz RBAC (`['ADMIN', 'DIRETOR']`),
 * usamos uma única flag `canManage` para os dois — alterações futuras
 * que dissociem as permissões precisariam separar as flags.
 */

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';
import { isGoalOverdue } from '@/lib/goals';

import { GoalCard, type GoalCardData } from './GoalCard';
import { GoalForm } from './GoalForm';
import { UpdateProgressForm } from './UpdateProgressForm';

export interface GoalsShellProps {
  goals: GoalCardData[];
}

export function GoalsShell({ goals }: GoalsShellProps) {
  const router = useRouter();
  const { allowed: canManage, isLoading: permissionLoading } = usePermission(
    'goal:create',
  );

  const [createOpen, setCreateOpen] = useState(false);
  const [progressTarget, setProgressTarget] = useState<GoalCardData | null>(
    null,
  );

  // Resumo numérico exibido no cabeçalho. Calculamos no client porque
  // os cards já estão hidratados — nenhum custo extra.
  const summary = useMemo(() => {
    const now = new Date();
    let overdue = 0;
    let completed = 0;
    for (const goal of goals) {
      if (isGoalOverdue(goal, now)) overdue += 1;
      if (goal.progress >= 100) completed += 1;
    }
    return { total: goals.length, overdue, completed };
  }, [goals]);

  function handleSaved() {
    // Revalida o Server Component sem mudar de URL — refeed dos dados
    // sem perder estado de modal/scroll.
    router.refresh();
  }

  return (
    <section
      aria-labelledby="metas-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            Metas
          </p>
          <h1
            id="metas-heading"
            className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
          >
            Metas da empresa e da minha área
          </h1>
          <p className="text-text-secondary">
            Acompanhe o progresso das metas gerais e das metas da área à qual
            você pertence.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            className="flex flex-wrap gap-3 text-xs"
            aria-label="Resumo das metas"
          >
            <SummaryPill label="Total" value={summary.total} tone="neutral" />
            <SummaryPill
              label="Concluídas"
              value={summary.completed}
              tone="success"
            />
            <SummaryPill
              label="Vencidas"
              value={summary.overdue}
              tone={summary.overdue > 0 ? 'danger' : 'neutral'}
            />
          </div>

          {!permissionLoading && canManage && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setCreateOpen(true)}
            >
              + Nova meta
            </Button>
          )}
        </div>
      </header>

      {/* Listagem (Task 8.4) */}
      {goals.length === 0 ? (
        <p
          role="status"
          className="rounded-lg border border-dashed border-border-light bg-surface-card p-8 text-center text-sm text-text-muted"
        >
          Nenhuma meta visível para você no momento.
        </p>
      ) : (
        <ul
          className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-2"
          aria-label="Lista de metas"
        >
          {goals.map((goal) => (
            <li key={goal.id} className="h-full">
              <GoalCard
                goal={goal}
                canManage={canManage}
                onUpdateProgress={(g) => setProgressTarget(g)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Modais — montados apenas quando o usuário tem permissão */}
      {canManage && (
        <>
          <GoalForm
            open={createOpen}
            onClose={() => setCreateOpen(false)}
            onSaved={handleSaved}
          />
          <UpdateProgressForm
            open={progressTarget !== null}
            onClose={() => setProgressTarget(null)}
            goal={progressTarget}
            onSaved={handleSaved}
          />
        </>
      )}
    </section>
  );
}

interface SummaryPillProps {
  label: string;
  value: number;
  tone: 'neutral' | 'success' | 'danger';
}

const TONE_CLASSES: Record<SummaryPillProps['tone'], string> = {
  neutral: 'bg-border-light text-text-secondary',
  success: 'bg-emerald-100 text-emerald-700',
  danger: 'bg-red-vivid/10 text-red-vivid',
};

function SummaryPill({ label, value, tone }: SummaryPillProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${TONE_CLASSES[tone]}`}
    >
      <span className="tabular-nums">{value}</span>
      <span className="uppercase tracking-[1.5px]">{label}</span>
    </span>
  );
}
