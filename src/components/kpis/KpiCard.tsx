'use client';

/**
 * `KpiCard` — Card de exibição de um KPI (Tasks 9.3, 9.4).
 *
 * Apresenta:
 *   - Badge da área (ou "Global" para KPIs sem área).
 *   - Nome do KPI.
 *   - Valor mais recente formatado de acordo com a unidade do KPI
 *     (Req 10.4 — `formatKpiValue` em `@/lib/kpis`).
 *   - Data da última inserção (Req 10.4) em formato local pt-BR.
 *   - Indicador da unidade (PERCENTAGE/INTEGER/DECIMAL) e do
 *     intervalo configurado (quando houver).
 *   - Botão "Inserir valor" exibido apenas quando `canWriteValue`.
 *
 * Diferente do `components/dashboard/KpiCard.tsx`: este card é
 * específico do módulo KPIs por Área (Req 10), com unidade variável
 * e data de inserção. O do dashboard é especializado em métricas
 * "agregadas" (faturamento, leads) com formato fixo.
 *
 * ─── Acessibilidade ─────────────────────────────────────────────────
 *   - O nome do KPI usa `<h3>` (semântica de subtítulo de card).
 *   - A data utiliza `<time dateTime="...">` para que leitores de
 *     tela compreendam o formato.
 *   - Quando não há valor, exibimos "—" com `aria-label="Sem valor
 *     registrado"` para tornar o estado vazio acessível.
 */

import type { Area, KpiUnit } from '@prisma/client';

import { Badge, Button, Card } from '@/components/ui';
import { cn } from '@/components/ui/cn';
import { formatKpiValue, KPI_AREA_LABELS, KPI_UNIT_LABELS } from '@/lib/kpis';

export interface KpiCardData {
  id: string;
  name: string;
  unit: KpiUnit;
  area: Area | null;
  intervalMin: number | null;
  intervalMax: number | null;
  /** Valor mais recente já convertido para `number`. `null` quando
   * nenhum valor foi registrado ainda. */
  latestValue: number | null;
  /** Data ISO do último registro. `null` quando não há valor. */
  latestRecordedAt: string | null;
}

export interface KpiCardProps {
  kpi: KpiCardData;
  /** Quando `true`, exibe o botão "Inserir valor". A decisão de
   * permissão fica no parent (`KpisShell`), que combina o RBAC
   * client-side com a área do KPI. */
  canWriteValue?: boolean;
  onWriteValue?: (kpi: KpiCardData) => void;
}

const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

function formatRecordedAt(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return dateFormatter.format(date);
}

function formatInterval(
  min: number | null,
  max: number | null,
  unit: KpiUnit,
): string | null {
  if (min === null && max === null) return null;

  const fmt = (v: number) =>
    formatKpiValue(v, unit).replace(/^—$/, String(v));

  if (min !== null && max !== null) {
    return `${fmt(min)} a ${fmt(max)}`;
  }
  if (min !== null) return `≥ ${fmt(min)}`;
  return `≤ ${fmt(max!)}`;
}

export function KpiCard({ kpi, canWriteValue = false, onWriteValue }: KpiCardProps) {
  const hasValue = kpi.latestValue !== null;
  const interval = formatInterval(kpi.intervalMin, kpi.intervalMax, kpi.unit);
  const areaKey = (kpi.area ?? 'GLOBAL') as Area | 'GLOBAL';
  const areaLabel = KPI_AREA_LABELS[areaKey];

  return (
    <Card
      variant="solid"
      padding="lg"
      className={cn('flex h-full flex-col gap-4')}
      data-testid="kpi-card"
    >
      {/* Cabeçalho: área + unidade */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={kpi.area === null ? 'neutral' : 'info'}
            size="sm"
          >
            {areaLabel}
          </Badge>
          <span className="text-[10px] font-semibold uppercase tracking-[1.5px] text-text-muted">
            {KPI_UNIT_LABELS[kpi.unit]}
          </span>
        </div>
      </div>

      {/* Nome */}
      <h3 className="font-heading text-lg font-bold tracking-tight text-text-primary">
        {kpi.name}
      </h3>

      {/* Valor mais recente */}
      <div className="flex flex-col gap-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
          Valor mais recente
        </p>
        <p
          className="font-heading text-3xl font-bold leading-none tracking-[-0.5px] text-text-primary tabular-nums"
          aria-label={hasValue ? undefined : 'Sem valor registrado'}
        >
          {hasValue ? formatKpiValue(kpi.latestValue, kpi.unit) : '—'}
        </p>
        {hasValue && kpi.latestRecordedAt ? (
          <p className="text-xs text-text-muted">
            Registrado em{' '}
            <time
              dateTime={kpi.latestRecordedAt}
              className="font-medium tabular-nums text-text-secondary"
            >
              {formatRecordedAt(kpi.latestRecordedAt)}
            </time>
          </p>
        ) : (
          <p className="text-xs text-text-muted">
            Nenhum valor registrado ainda.
          </p>
        )}
      </div>

      {/* Intervalo configurado (quando houver) */}
      {interval && (
        <p className="text-xs text-text-muted">
          Intervalo permitido:{' '}
          <span className="font-medium text-text-secondary">{interval}</span>
        </p>
      )}

      {/* Ação */}
      {canWriteValue && onWriteValue && (
        <div className="mt-auto flex justify-end">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => onWriteValue(kpi)}
          >
            Inserir valor
          </Button>
        </div>
      )}
    </Card>
  );
}
