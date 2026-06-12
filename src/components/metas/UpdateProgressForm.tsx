'use client';

/**
 * `UpdateProgressForm` — Atualização de progresso de uma meta
 * (Task 8.8).
 *
 * Diretor/Admin apenas. Exibe um slider + input numérico, ambos
 * sincronizados, para escolher um valor inteiro entre 0 e 100. O
 * sync entre os dois inputs é simples: o `<input type="range">`
 * dispara `change` em cada movimento; o `<input type="number">`
 * espelha o valor para edição direta com o teclado.
 *
 * Submete via `PATCH /api/goals/:id` com `{ progress }`. Em sucesso,
 * chama `onSaved()` para revalidar a lista e fecha o modal.
 *
 * ─── Por que slider + número juntos? ────────────────────────────────
 *
 * O slider sozinho é confortável em mouse/touch mas impreciso em
 * valores como 73%. O input numérico isolado exige ao menos dois
 * cliques (focus + digitar). O par cobre ambos os modos sem custo
 * adicional de UX, e ambos respeitam `min=0`/`max=100`/`step=1`.
 */

import { useEffect, useState, type FormEvent } from 'react';

import { Button, Modal } from '@/components/ui';
import {
  GOAL_PROGRESS_MAX,
  GOAL_PROGRESS_MIN,
  GOAL_VALIDATION_MESSAGES,
} from '@/lib/validators/goal';

export interface UpdateProgressFormProps {
  open: boolean;
  onClose: () => void;
  /** Meta sendo editada. `null` quando o modal está fechado. */
  goal: { id: string; name: string; progress: number; deadline: string } | null;
  onSaved: () => void;
}

function clamp(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(GOAL_PROGRESS_MAX, Math.max(GOAL_PROGRESS_MIN, Math.round(value)));
}

/**
 * Converte um ISO 8601 para o formato aceito por `<input type="datetime-local">`
 * (`YYYY-MM-DDTHH:mm`) no fuso local do navegador.
 */
function toDateTimeLocal(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

export function UpdateProgressForm({ open, onClose, goal, onSaved }: UpdateProgressFormProps) {
  const [value, setValue] = useState<number>(0);
  const [deadline, setDeadline] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Reseta o valor sempre que o modal abre com uma meta diferente.
  useEffect(() => {
    if (!open || !goal) return;
    setValue(clamp(goal.progress));
    setDeadline(toDateTimeLocal(goal.deadline));
    setError(null);
  }, [open, goal]);

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting || !goal) return;

    const next = clamp(value);
    if (next < GOAL_PROGRESS_MIN || next > GOAL_PROGRESS_MAX) {
      setError(GOAL_VALIDATION_MESSAGES.progress.outOfRange);
      return;
    }

    // Monta o payload: sempre envia progresso; envia prazo apenas se
    // o usuário preencheu o campo (convertido para ISO).
    const body: { progress: number; deadline?: string } = { progress: next };
    if (deadline) {
      const parsed = new Date(deadline);
      if (Number.isNaN(parsed.getTime())) {
        setError(GOAL_VALIDATION_MESSAGES.deadline.invalid);
        return;
      }
      body.deadline = parsed.toISOString();
    }

    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          message?: string;
          fields?: Array<{ path: string; message: string }>;
        } | null;
        const fieldMsg =
          data?.fields?.find((f) => f.path === 'deadline')?.message ??
          data?.fields?.find((f) => f.path === 'progress')?.message;
        setError(
          fieldMsg ?? data?.message ?? 'Não foi possível atualizar a meta. Tente novamente.',
        );
        return;
      }

      onSaved();
      onClose();
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Atualizar meta"
      description={goal ? `Meta: ${goal.name}` : undefined}
      size="md"
      closeOnEscape={!submitting}
      closeOnOverlayClick={!submitting}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button
            type="submit"
            form="goal-progress-form"
            variant="primary"
            loading={submitting}
            disabled={!goal}
          >
            Salvar
          </Button>
        </div>
      }
    >
      <form
        id="goal-progress-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        {error && (
          <div
            role="alert"
            className="rounded-md border border-red-vivid/30 bg-red-vivid/5 px-3 py-2 text-sm text-red-vivid"
          >
            {error}
          </div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex items-end justify-between">
            <label htmlFor="goal-progress-range" className="text-sm font-medium text-text-primary">
              Progresso
            </label>
            <span
              className="font-heading text-2xl font-bold tabular-nums text-text-primary"
              aria-live="polite"
            >
              {value}%
            </span>
          </div>

          <input
            id="goal-progress-range"
            type="range"
            min={GOAL_PROGRESS_MIN}
            max={GOAL_PROGRESS_MAX}
            step={1}
            value={value}
            onChange={(e) => setValue(clamp(Number(e.target.value)))}
            disabled={submitting}
            className="w-full accent-red-core"
            aria-valuemin={GOAL_PROGRESS_MIN}
            aria-valuemax={GOAL_PROGRESS_MAX}
            aria-valuenow={value}
          />

          <div className="flex items-center gap-2">
            <input
              id="goal-progress-number"
              type="number"
              min={GOAL_PROGRESS_MIN}
              max={GOAL_PROGRESS_MAX}
              step={1}
              value={value}
              onChange={(e) => setValue(clamp(Number(e.target.value)))}
              disabled={submitting}
              aria-label="Valor exato do progresso (0 a 100)"
              className="h-10 w-24 rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30 disabled:cursor-not-allowed disabled:bg-surface-bg"
            />
            <span className="text-sm text-text-muted">%</span>
          </div>
        </div>

        {/* Ajuste de prazo */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="goal-deadline" className="text-sm font-medium text-text-primary">
            Prazo
          </label>
          <input
            id="goal-deadline"
            type="datetime-local"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
            disabled={submitting}
            className="h-10 w-full rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30 disabled:cursor-not-allowed disabled:bg-surface-bg"
          />
          <p className="text-xs text-text-muted">O prazo deve ser uma data futura.</p>
        </div>
      </form>
    </Modal>
  );
}
