'use client';

/**
 * `KpiValueForm` — Formulário de inserção de valor de KPI (Task 9.5).
 *
 * Renderizado dentro do `Modal` da UI base. É controlado pelo
 * `KpisShell` e só é montado quando o usuário pode registrar valores
 * para o KPI alvo (decisão tomada no parent via RBAC + área).
 *
 * ─── Validação client-side ──────────────────────────────────────────
 *
 * Replica as regras universais e por-KPI do servidor para feedback
 * imediato (`@/lib/validators/kpi`):
 *
 *   - número finito,
 *   - máximo 2 casas decimais (Req 10.2),
 *   - faixas e unidade do KPI alvo (PERCENTAGE, INTEGER, DECIMAL).
 *
 * Em caso de erro vindo do servidor (ex.: a regra mudou entre o
 * client e o submit), absorvemos o `fields[].message` e mostramos
 * exatamente o texto.
 *
 * ─── Pós-sucesso ────────────────────────────────────────────────────
 *
 * Em sucesso (201), chamamos `onSaved()` para que o parent revalide a
 * lista (`router.refresh()`) e fechamos o modal. Não descartamos os
 * dados em caso de erro, conforme Req 10.3.
 */

import { useEffect, useState, type FormEvent } from 'react';
import type { KpiUnit } from '@prisma/client';

import { Button, Input, Modal } from '@/components/ui';
import { formatKpiValue, KPI_AREA_LABELS, KPI_UNIT_LABELS } from '@/lib/kpis';
import {
  KPI_VALIDATION_MESSAGES,
  KPI_VALUE_ABS_MAX,
  validateValueAgainstKpi,
} from '@/lib/validators/kpi';
import type { KpiCardData } from './KpiCard';

export interface KpiValueFormProps {
  open: boolean;
  onClose: () => void;
  kpi: KpiCardData | null;
  onSaved: () => void;
}

interface FormErrors {
  value?: string;
  _global?: string;
}

/**
 * Aceita string vinda do `<input type="number">` e devolve `number`
 * sintaticamente válido. Trata vírgula como separador decimal (UX
 * pt-BR) caso o navegador entregue assim.
 */
function parseNumberInput(raw: string): number | null {
  if (raw.trim() === '') return null;
  const normalized = raw.replace(',', '.');
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return n;
}

function hasAtMostTwoDecimals(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const rounded = Math.round(value * 100) / 100;
  return Math.abs(rounded - value) < 1e-9;
}

export function KpiValueForm({ open, onClose, kpi, onSaved }: KpiValueFormProps) {
  const [raw, setRaw] = useState<string>('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset ao abrir (com KPI diferente).
  useEffect(() => {
    if (!open) return;
    setRaw('');
    setErrors({});
  }, [open, kpi?.id]);

  if (!kpi) {
    // Modal só renderiza quando `open` é true; mantemos o early
    // return para o caso de transição.
  }

  function setValueField(value: string) {
    setRaw(value);
    setErrors((prev) => ({ ...prev, value: undefined, _global: undefined }));
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting || !kpi) return;

    setErrors({});

    const parsed = parseNumberInput(raw);
    if (parsed === null) {
      setErrors({ value: KPI_VALIDATION_MESSAGES.value.invalid });
      return;
    }

    if (Math.abs(parsed) > KPI_VALUE_ABS_MAX) {
      setErrors({ value: KPI_VALIDATION_MESSAGES.value.tooLarge });
      return;
    }

    if (!hasAtMostTwoDecimals(parsed)) {
      setErrors({ value: KPI_VALIDATION_MESSAGES.value.tooManyDecimals });
      return;
    }

    const fieldErrors = validateValueAgainstKpi(parsed, {
      unit: kpi.unit as KpiUnit,
      intervalMin: kpi.intervalMin,
      intervalMax: kpi.intervalMax,
    });
    if (fieldErrors.length > 0) {
      setErrors({ value: fieldErrors[0].message });
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/kpis/${kpi.id}/values`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: parsed }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | {
              code?: string;
              message?: string;
              fields?: Array<{ path: string; message: string }>;
            }
          | null;

        const fieldMsg = data?.fields?.find((f) => f.path === 'value')?.message;
        if (fieldMsg) {
          setErrors({ value: fieldMsg });
        } else {
          setErrors({
            _global:
              data?.message ??
              'Não foi possível registrar o valor. Tente novamente.',
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

  // Helper text dinâmico — mostra a unidade do KPI e o intervalo.
  const helper: string[] = [];
  if (kpi) {
    helper.push(`Unidade: ${KPI_UNIT_LABELS[kpi.unit]}`);
    if (kpi.unit === 'PERCENTAGE' && kpi.intervalMin === null && kpi.intervalMax === null) {
      helper.push('Faixa: 0 a 100');
    }
    if (kpi.intervalMin !== null || kpi.intervalMax !== null) {
      const min =
        kpi.intervalMin !== null ? formatKpiValue(kpi.intervalMin, kpi.unit) : '−∞';
      const max =
        kpi.intervalMax !== null ? formatKpiValue(kpi.intervalMax, kpi.unit) : '+∞';
      helper.push(`Faixa: ${min} a ${max}`);
    }
  }

  // Atributos do input que refinam a UX por unidade.
  const isInteger = kpi?.unit === 'INTEGER';
  const inputStep = isInteger ? '1' : '0.01';
  const inputMin = (() => {
    if (!kpi) return undefined;
    if (kpi.intervalMin !== null) return String(kpi.intervalMin);
    if (kpi.unit === 'PERCENTAGE') return '0';
    return undefined;
  })();
  const inputMax = (() => {
    if (!kpi) return undefined;
    if (kpi.intervalMax !== null) return String(kpi.intervalMax);
    if (kpi.unit === 'PERCENTAGE') return '100';
    return undefined;
  })();

  const description = kpi
    ? `Área: ${KPI_AREA_LABELS[(kpi.area ?? 'GLOBAL') as keyof typeof KPI_AREA_LABELS]}`
    : undefined;

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title={kpi ? `Inserir valor — ${kpi.name}` : 'Inserir valor'}
      description={description}
      size="md"
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
            form="kpi-value-form"
            variant="primary"
            loading={submitting}
            disabled={!kpi}
          >
            Salvar valor
          </Button>
        </div>
      }
    >
      <form
        id="kpi-value-form"
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
          label="Valor"
          name="value"
          type="number"
          inputMode={isInteger ? 'numeric' : 'decimal'}
          step={inputStep}
          min={inputMin}
          max={inputMax}
          value={raw}
          onChange={(e) => setValueField(e.target.value)}
          required
          autoFocus
          placeholder={isInteger ? 'Ex.: 42' : 'Ex.: 12,50'}
          error={errors.value}
          helperText={helper.join(' • ')}
          disabled={submitting}
        />
      </form>
    </Modal>
  );
}
