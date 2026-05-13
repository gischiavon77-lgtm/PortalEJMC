'use client';

/**
 * `KpiConfigForm` — Formulário de configuração de um novo KPI
 * (Task 9.6 — Admin apenas, Req 10.5).
 *
 * Renderizado dentro do `Modal`. Apenas usuários com permissão
 * `kpi:write` deveriam montar este componente — o controle vive no
 * `KpisShell` via `usePermission('kpi:write')`. A API revalida no
 * servidor.
 *
 * Campos:
 *   - `name`        → 1–60 caracteres (Req 10.5).
 *   - `unit`        → enum KpiUnit (PERCENTAGE | INTEGER | DECIMAL).
 *   - `area`        → enum Area ou "GLOBAL" (sem área).
 *   - `intervalMin` → opcional, número.
 *   - `intervalMax` → opcional, número; quando ambos definidos,
 *                     `min ≤ max`.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';
import type { Area, KpiUnit } from '@prisma/client';

import { Button, Input, Modal } from '@/components/ui';
import { KPI_AREA_LABELS, KPI_UNIT_LABELS } from '@/lib/kpis';
import {
  KPI_AREAS,
  KPI_NAME_MAX_LENGTH,
  KPI_UNITS,
  KPI_VALIDATION_MESSAGES,
} from '@/lib/validators/kpi';

/**
 * Schema de validação local para o formulário. Usa strings cruas
 * (em vez do `createKpiSchema` direto) para tratar `intervalMin` /
 * `intervalMax` como opcionais e devolver mensagens por campo.
 */
const formSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(1, KPI_VALIDATION_MESSAGES.name.tooShort)
      .max(KPI_NAME_MAX_LENGTH, KPI_VALIDATION_MESSAGES.name.tooLong),
    unit: z.enum(KPI_UNITS, {
      error: KPI_VALIDATION_MESSAGES.unit.invalid,
    }),
    area: z.string(), // "" | Area | "GLOBAL"
    intervalMin: z.string(),
    intervalMax: z.string(),
  })
  .superRefine((data, ctx) => {
    // Área deve ser válida (Area ou "GLOBAL").
    if (
      data.area !== 'GLOBAL' &&
      !(KPI_AREAS as readonly string[]).includes(data.area)
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['area'],
        message: KPI_VALIDATION_MESSAGES.area.invalid,
      });
    }

    // Intervalos: vazios = ok; preenchidos devem ser numéricos finitos.
    const min = data.intervalMin.trim();
    const max = data.intervalMax.trim();
    let minNum: number | null = null;
    let maxNum: number | null = null;

    if (min !== '') {
      const parsed = Number(min.replace(',', '.'));
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({
          code: 'custom',
          path: ['intervalMin'],
          message: KPI_VALIDATION_MESSAGES.interval.invalidNumber,
        });
      } else {
        minNum = parsed;
      }
    }
    if (max !== '') {
      const parsed = Number(max.replace(',', '.'));
      if (!Number.isFinite(parsed)) {
        ctx.addIssue({
          code: 'custom',
          path: ['intervalMax'],
          message: KPI_VALIDATION_MESSAGES.interval.invalidNumber,
        });
      } else {
        maxNum = parsed;
      }
    }

    if (minNum !== null && maxNum !== null && minNum > maxNum) {
      ctx.addIssue({
        code: 'custom',
        path: ['intervalMin'],
        message: KPI_VALIDATION_MESSAGES.interval.minGreaterThanMax,
      });
    }
  });

type FormErrors = Partial<
  Record<'name' | 'unit' | 'area' | 'intervalMin' | 'intervalMax' | '_global', string>
>;

interface FormValues {
  name: string;
  unit: KpiUnit;
  /** "" significa "não selecionado". `GLOBAL` é a opção explícita. */
  area: '' | Area | 'GLOBAL';
  intervalMin: string;
  intervalMax: string;
}

export interface KpiConfigFormProps {
  open: boolean;
  onClose: () => void;
  /** Pré-seleção de área no dropdown (vem do filtro atual). */
  defaultArea?: Area | 'GLOBAL' | null;
  onSaved: () => void;
}

function buildInitialValues(defaultArea: Area | 'GLOBAL' | null): FormValues {
  return {
    name: '',
    unit: 'DECIMAL',
    area: defaultArea ?? '',
    intervalMin: '',
    intervalMax: '',
  };
}

export function KpiConfigForm({
  open,
  onClose,
  defaultArea = null,
  onSaved,
}: KpiConfigFormProps) {
  const [values, setValues] = useState<FormValues>(() =>
    buildInitialValues(defaultArea),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Reseta o formulário ao abrir.
  useEffect(() => {
    if (!open) return;
    setValues(buildInitialValues(defaultArea));
    setErrors({});
  }, [open, defaultArea]);

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

    const payload: Record<string, unknown> = {
      name: parsed.data.name,
      unit: parsed.data.unit,
      area: parsed.data.area === 'GLOBAL' ? null : parsed.data.area,
    };
    const minRaw = parsed.data.intervalMin.trim();
    const maxRaw = parsed.data.intervalMax.trim();
    if (minRaw !== '') payload.intervalMin = Number(minRaw.replace(',', '.'));
    if (maxRaw !== '') payload.intervalMax = Number(maxRaw.replace(',', '.'));

    setSubmitting(true);
    try {
      const res = await fetch('/api/kpis', {
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
        } else if (data?.code === 'AREA_KPI_LIMIT') {
          setErrors({ area: data.message ?? 'Limite de KPIs por área atingido.' });
        } else {
          setErrors({
            _global:
              data?.message ??
              'Não foi possível criar o KPI. Tente novamente.',
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
      title="Novo KPI"
      description="Configure um indicador adicional para uma área (até 20 por área)."
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
            form="kpi-config-form"
            variant="primary"
            loading={submitting}
          >
            Criar KPI
          </Button>
        </div>
      }
    >
      <form
        id="kpi-config-form"
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
          maxLength={KPI_NAME_MAX_LENGTH}
          required
          placeholder="Ex.: Tempo médio de resposta"
          error={errors.name}
          helperText={`${values.name.trim().length}/${KPI_NAME_MAX_LENGTH} caracteres`}
          disabled={submitting}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex w-full flex-col gap-1.5">
            <label
              htmlFor="kpi-unit"
              className="text-sm font-medium text-text-primary"
            >
              Unidade de medida
              <span aria-hidden="true" className="ml-0.5 text-red-vivid">
                *
              </span>
            </label>
            <select
              id="kpi-unit"
              value={values.unit}
              onChange={(e) => setField('unit', e.target.value as KpiUnit)}
              disabled={submitting}
              className="h-10 w-full rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30 disabled:cursor-not-allowed disabled:bg-surface-bg"
            >
              {KPI_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {KPI_UNIT_LABELS[unit]}
                </option>
              ))}
            </select>
            {errors.unit && (
              <p className="text-xs text-red-vivid">{errors.unit}</p>
            )}
          </div>

          <div className="flex w-full flex-col gap-1.5">
            <label
              htmlFor="kpi-area"
              className="text-sm font-medium text-text-primary"
            >
              Área
              <span aria-hidden="true" className="ml-0.5 text-red-vivid">
                *
              </span>
            </label>
            <select
              id="kpi-area"
              value={values.area}
              onChange={(e) =>
                setField('area', e.target.value as FormValues['area'])
              }
              disabled={submitting}
              aria-invalid={Boolean(errors.area) || undefined}
              className="h-10 w-full rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30 disabled:cursor-not-allowed disabled:bg-surface-bg"
            >
              <option value="">Selecione…</option>
              <option value="GLOBAL">Global (sem área)</option>
              {KPI_AREAS.map((area) => (
                <option key={area} value={area}>
                  {KPI_AREA_LABELS[area]}
                </option>
              ))}
            </select>
            {errors.area && (
              <p className="text-xs text-red-vivid">{errors.area}</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Limite mínimo (opcional)"
            name="intervalMin"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={values.intervalMin}
            onChange={(e) => setField('intervalMin', e.target.value)}
            placeholder="Ex.: 0"
            error={errors.intervalMin}
            disabled={submitting}
          />
          <Input
            label="Limite máximo (opcional)"
            name="intervalMax"
            type="number"
            inputMode="decimal"
            step="0.01"
            value={values.intervalMax}
            onChange={(e) => setField('intervalMax', e.target.value)}
            placeholder="Ex.: 100"
            error={errors.intervalMax}
            disabled={submitting}
          />
        </div>
      </form>
    </Modal>
  );
}
