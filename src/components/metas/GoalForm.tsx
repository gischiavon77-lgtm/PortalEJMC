'use client';

/**
 * `GoalForm` — Formulário de criação de meta (Task 8.7).
 *
 * Renderizado dentro do `Modal` da UI base. Apenas Diretor/Admin
 * deveriam montar este componente — o controle vive no parent
 * (`GoalsShell`) via `usePermission('goal:create')`. A própria
 * API valida novamente no servidor, então o gate UI é só para
 * acessibilidade/UX.
 *
 * ─── Validação client-side ──────────────────────────────────────────
 *
 * Reusamos a versão "form-friendly" do schema Zod (mesmas regras
 * que a API, sem `transform` para `Date` — queremos as strings
 * cruas para reagir a `error.path`).
 *
 *   - `name`        → 1-100 caracteres.
 *   - `description` → 0-500 caracteres.
 *   - `type`        → "GENERAL" | "AREA".
 *   - `area`        → obrigatório se `type === 'AREA'`, proibido se
 *     `type === 'GENERAL'`.
 *   - `deadline`    → datetime-local; convertido para ISO antes de
 *     enviar e checado por "estritamente futuro" no client.
 *
 * O input `<select>` para `type` controla a exibição condicional do
 * `<select>` de área, evitando o usuário perder dados ao trocar.
 *
 * ─── Estados de submit ──────────────────────────────────────────────
 *
 *   - `submitting`  — durante o fetch; desabilita botões.
 *   - `errors`      — mapa por campo + `_global`.
 *
 * ─── Pós-sucesso ────────────────────────────────────────────────────
 *
 * Em sucesso (201), chamamos `onSaved()` para que o parent revalide
 * a lista e fechamos o modal. O parent (página `/metas`) usa
 * `router.refresh()` para forçar nova SSR.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';

import { Button, Input, Modal } from '@/components/ui';
import {
  GOAL_AREAS,
  GOAL_DESCRIPTION_MAX_LENGTH,
  GOAL_NAME_MAX_LENGTH,
  GOAL_VALIDATION_MESSAGES,
} from '@/lib/validators/goal';
import { AREA_LABELS } from '@/lib/goals';
import type { Area } from '@prisma/client';

/**
 * Schema de validação local, paralela ao do servidor — não importamos
 * o `createGoalSchema` direto porque ele faz `.transform()` para
 * `Date`, o que dificulta o tratamento de erros por campo. Mantemos
 * mensagens em sincronia via constantes em
 * `@/lib/validators/goal.ts`.
 */
const formSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, GOAL_VALIDATION_MESSAGES.name.tooShort)
      .max(GOAL_NAME_MAX_LENGTH, GOAL_VALIDATION_MESSAGES.name.tooLong),
    description: z
      .string()
      .trim()
      .max(
        GOAL_DESCRIPTION_MAX_LENGTH,
        GOAL_VALIDATION_MESSAGES.description.tooLong,
      ),
    type: z.enum(['GENERAL', 'AREA'], {
      error: GOAL_VALIDATION_MESSAGES.type.invalid,
    }),
    // Aceita string vazia ('') vinda do `<select>`. Schemas mais
    // restritivos ficam por conta do `superRefine` abaixo, que checa
    // a coerência com `type` e exige um valor válido em metas de área.
    area: z.string(),
    deadline: z
      .string()
      .min(1, GOAL_VALIDATION_MESSAGES.deadline.required)
      .refine((v) => !Number.isNaN(Date.parse(v)), {
        message: GOAL_VALIDATION_MESSAGES.deadline.invalid,
      })
      .refine((v) => new Date(v).getTime() > Date.now(), {
        message: GOAL_VALIDATION_MESSAGES.deadline.notFuture,
      }),
  })
  .superRefine((data, ctx) => {
    if (data.type === 'AREA') {
      if (!data.area) {
        ctx.addIssue({
          code: 'custom',
          path: ['area'],
          message: GOAL_VALIDATION_MESSAGES.area.requiredForAreaGoal,
        });
        return;
      }
      // Quando preenchido, precisa ser uma `Area` válida do enum.
      if (!(GOAL_AREAS as readonly string[]).includes(data.area)) {
        ctx.addIssue({
          code: 'custom',
          path: ['area'],
          message: GOAL_VALIDATION_MESSAGES.area.invalid,
        });
      }
    }
  });

type FormErrors = Partial<
  Record<'name' | 'description' | 'type' | 'area' | 'deadline' | '_global', string>
>;

export interface GoalFormProps {
  open: boolean;
  onClose: () => void;
  /** Chamado após criar com sucesso para revalidar dados. */
  onSaved: () => void;
}

interface FormValues {
  name: string;
  description: string;
  type: 'GENERAL' | 'AREA';
  area: '' | Area;
  deadline: string; // datetime-local
}

/**
 * Estado inicial — meta geral, prazo padrão "amanhã às 18:00".
 *
 * Usar amanhã como default evita o erro de validação "data futura"
 * logo na primeira interação (que ocorreria com `now()`), e oferece
 * um valor sensato para revisão pelo usuário.
 */
function buildInitialValues(): FormValues {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(18, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  const local = `${tomorrow.getFullYear()}-${pad(tomorrow.getMonth() + 1)}-${pad(
    tomorrow.getDate(),
  )}T${pad(tomorrow.getHours())}:${pad(tomorrow.getMinutes())}`;
  return {
    name: '',
    description: '',
    type: 'GENERAL',
    area: '',
    deadline: local,
  };
}

export function GoalForm({ open, onClose, onSaved }: GoalFormProps) {
  const [values, setValues] = useState<FormValues>(() => buildInitialValues());
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Reseta o formulário quando o modal abre.
  useEffect(() => {
    if (!open) return;
    setValues(buildInitialValues());
    setErrors({});
  }, [open]);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, _global: undefined }));
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;

    setErrors({});

    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = (issue.path[0] as keyof FormErrors) ?? '_global';
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    // Monta o payload — converte `deadline` local para ISO e omite
    // `area` quando GENERAL.
    const payload: Record<string, unknown> = {
      name: parsed.data.name,
      description: parsed.data.description,
      type: parsed.data.type,
      deadline: new Date(parsed.data.deadline).toISOString(),
    };
    if (parsed.data.type === 'AREA' && parsed.data.area) {
      payload.area = parsed.data.area as Area;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | {
              code?: string;
              message?: string;
              fields?: Array<{ path: string; message: string }>;
            }
          | null;

        if (data?.fields?.length) {
          const next: FormErrors = {};
          for (const f of data.fields) {
            const key = (f.path as keyof FormErrors) ?? '_global';
            if (!next[key]) next[key] = f.message;
          }
          setErrors(next);
        } else {
          setErrors({
            _global:
              data?.message ??
              'Não foi possível criar a meta. Tente novamente.',
          });
        }
        return;
      }

      onSaved();
      onClose();
    } catch {
      setErrors({
        _global:
          'Erro de conexão. Verifique sua internet e tente novamente.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Nova meta"
      description="Defina uma meta com prazo e progresso inicial em 0%."
      size="lg"
      closeOnEscape={!submitting}
      closeOnOverlayClick={!submitting}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={onClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            form="goal-form"
            variant="primary"
            loading={submitting}
          >
            Criar meta
          </Button>
        </div>
      }
    >
      <form
        id="goal-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        {errors._global && (
          <div
            role="alert"
            className="rounded-md border border-red-vivid/30 bg-red-vivid/5 px-3 py-2 text-sm text-red-vivid"
          >
            {errors._global}
          </div>
        )}

        <Input
          label="Nome"
          name="name"
          value={values.name}
          onChange={(e) => setField('name', e.target.value)}
          maxLength={GOAL_NAME_MAX_LENGTH}
          required
          placeholder="Ex.: Atingir R$ 100 mil em vendas"
          error={errors.name}
          helperText={`${values.name.trim().length}/${GOAL_NAME_MAX_LENGTH} caracteres`}
          disabled={submitting}
        />

        <div className="flex w-full flex-col gap-1.5">
          <label
            htmlFor="goal-description"
            className="text-sm font-medium text-text-primary"
          >
            Descrição
          </label>
          <textarea
            id="goal-description"
            value={values.description}
            onChange={(e) => setField('description', e.target.value)}
            maxLength={GOAL_DESCRIPTION_MAX_LENGTH}
            rows={3}
            disabled={submitting}
            placeholder="Detalhe o objetivo da meta (opcional)."
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={
              errors.description
                ? 'goal-description-error'
                : 'goal-description-hint'
            }
            className={[
              'w-full resize-y rounded-md border bg-white px-3 py-2 text-sm text-text-primary',
              'placeholder:text-text-muted',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30',
              errors.description
                ? 'border-red-vivid focus-visible:border-red-vivid focus-visible:ring-red-vivid/30'
                : 'border-border-light focus-visible:border-red-core',
              'disabled:cursor-not-allowed disabled:bg-surface-bg disabled:text-text-muted',
            ].join(' ')}
          />
          {errors.description ? (
            <p id="goal-description-error" className="text-xs text-red-vivid">
              {errors.description}
            </p>
          ) : (
            <p id="goal-description-hint" className="text-xs text-text-muted">
              {values.description.trim().length}/{GOAL_DESCRIPTION_MAX_LENGTH} caracteres
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex w-full flex-col gap-1.5">
            <label
              htmlFor="goal-type"
              className="text-sm font-medium text-text-primary"
            >
              Tipo
              <span aria-hidden="true" className="ml-0.5 text-red-vivid">
                *
              </span>
            </label>
            <select
              id="goal-type"
              value={values.type}
              onChange={(e) => {
                const nextType = e.target.value as 'GENERAL' | 'AREA';
                setValues((prev) => ({
                  ...prev,
                  type: nextType,
                  // Limpa área ao voltar para GENERAL.
                  area: nextType === 'GENERAL' ? '' : prev.area,
                }));
                setErrors((prev) => ({ ...prev, type: undefined, area: undefined, _global: undefined }));
              }}
              disabled={submitting}
              className="h-10 w-full rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30 disabled:cursor-not-allowed disabled:bg-surface-bg"
            >
              <option value="GENERAL">Geral (empresa toda)</option>
              <option value="AREA">Por área</option>
            </select>
            {errors.type && (
              <p className="text-xs text-red-vivid">{errors.type}</p>
            )}
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <label
              htmlFor="goal-area"
              className="text-sm font-medium text-text-primary"
            >
              Área
              {values.type === 'AREA' && (
                <span aria-hidden="true" className="ml-0.5 text-red-vivid">
                  *
                </span>
              )}
            </label>
            <select
              id="goal-area"
              value={values.area}
              onChange={(e) =>
                setField('area', e.target.value as '' | Area)
              }
              disabled={submitting || values.type !== 'AREA'}
              aria-invalid={Boolean(errors.area) || undefined}
              className="h-10 w-full rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30 disabled:cursor-not-allowed disabled:bg-surface-bg"
            >
              <option value="">
                {values.type === 'AREA' ? 'Selecione…' : 'Não aplicável'}
              </option>
              {GOAL_AREAS.map((area) => (
                <option key={area} value={area}>
                  {AREA_LABELS[area]}
                </option>
              ))}
            </select>
            {errors.area && (
              <p className="text-xs text-red-vivid">{errors.area}</p>
            )}
          </div>
        </div>

        <Input
          label="Prazo"
          name="deadline"
          type="datetime-local"
          value={values.deadline}
          onChange={(e) => setField('deadline', e.target.value)}
          required
          error={errors.deadline}
          helperText="A data/hora deve estar no futuro."
          disabled={submitting}
        />
      </form>
    </Modal>
  );
}
