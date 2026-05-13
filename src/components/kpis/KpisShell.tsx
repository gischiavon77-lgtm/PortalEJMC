'use client';

/**
 * `KpisShell` — Casca client-side da página `/kpis` (Tasks 9.3–9.6).
 *
 * Recebe a lista pré-renderizada pelo Server Component e adiciona:
 *
 *   1. Seletor de área (Task 9.3) — atualiza `?area=...` na URL via
 *      `router.push(...)`. O Server Component reage filtrando.
 *   2. Botão "Novo KPI" (Task 9.6) — exibido apenas para Admin via
 *      `usePermission('kpi:write')`.
 *   3. Botões "Inserir valor" em cada card (Task 9.5) — exibidos
 *      quando o usuário pode registrar valores para aquele KPI:
 *        · Admin via matriz `kpi:writeValue`,
 *        · demais quando `user.area === kpi.area`.
 *      KPIs globais (sem área) ficam restritos ao Admin.
 *   4. Modais (`KpiValueForm`, `KpiConfigForm`) com revalidação por
 *      `router.refresh()` ao salvar.
 *
 * ─── Por que resolver `canWriteValue` por KPI no client? ─────────────
 *
 * O hook `usePermission('kpi:writeValue', { area })` é chamado uma
 * vez por card — vamos preferir uma checagem inline simples (puxando
 * a sessão) para evitar múltiplos `useSession()`. Aqui usamos o
 * `useSession` uma única vez e derivamos a permissão por KPI a partir
 * dele. A regra é a mesma do RBAC central:
 *
 *   - `role === ADMIN`  → sempre pode (override de matriz).
 *   - `kpi.area === user.area` → pode (predicado de mesma-área).
 *   - caso contrário → não pode.
 *
 * Esse desempate fica documentado para alinhar com `permissions.ts`;
 * a verdade autoritativa continua sendo a checagem servidor-side.
 */

import { useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import type { Area } from '@prisma/client';

import { Button } from '@/components/ui';
import { usePermission } from '@/hooks/usePermission';
import { KPI_AREA_LABELS } from '@/lib/kpis';

import { KpiCard, type KpiCardData } from './KpiCard';
import { KpiConfigForm } from './KpiConfigForm';
import { KpiValueForm } from './KpiValueForm';

const SELECTOR_AREAS: Array<Area | 'GLOBAL'> = [
  'VENDAS',
  'PRESIDENCIA',
  'PROJETOS',
  'MARKETING',
  'GESTAO_PESSOAS',
  'ADM_FIN',
  'GLOBAL',
];

export interface KpisShellProps {
  kpis: KpiCardData[];
  /** Filtro atual ('ALL' | 'GLOBAL' | Area). */
  currentArea: 'ALL' | 'GLOBAL' | Area;
  /** Área do usuário autenticado (para regra de mesma-área). */
  currentUserArea: Area | null;
  /** Diretor/Admin enxergam todas as áreas no seletor. Demais
   * usuários veem só "Todas" + a própria área + "Global". */
  userCanSeeAllAreas: boolean;
}

export function KpisShell({
  kpis,
  currentArea,
  currentUserArea,
  userCanSeeAllAreas,
}: KpisShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { allowed: canConfigureKpi, isLoading: configPermLoading } =
    usePermission('kpi:write');

  const [valueTarget, setValueTarget] = useState<KpiCardData | null>(null);
  const [configOpen, setConfigOpen] = useState(false);

  // Lista de opções do dropdown de área. Diretor/Admin veem todas;
  // demais usuários veem só sua área + Global (e "Todas" como atalho).
  const areaOptions = useMemo<Array<{ value: 'ALL' | 'GLOBAL' | Area; label: string }>>(() => {
    const base: Array<{ value: 'ALL' | 'GLOBAL' | Area; label: string }> = [
      { value: 'ALL', label: 'Todas' },
    ];

    if (userCanSeeAllAreas) {
      for (const area of SELECTOR_AREAS) {
        base.push({
          value: area,
          label: KPI_AREA_LABELS[area as keyof typeof KPI_AREA_LABELS],
        });
      }
    } else {
      if (currentUserArea) {
        base.push({
          value: currentUserArea,
          label: KPI_AREA_LABELS[currentUserArea],
        });
      }
      base.push({ value: 'GLOBAL', label: 'Global' });
    }

    return base;
  }, [userCanSeeAllAreas, currentUserArea]);

  function handleAreaChange(value: 'ALL' | 'GLOBAL' | Area) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value === 'ALL') {
      params.delete('area');
    } else {
      params.set('area', value);
    }
    const qs = params.toString();
    router.push(qs ? `/kpis?${qs}` : '/kpis');
  }

  function handleSaved() {
    router.refresh();
  }

  // Regra de "pode registrar valor neste KPI?" — deriva do RBAC central.
  function canWriteValueFor(kpi: KpiCardData): boolean {
    if (!session?.user) return false;
    if (session.user.role === 'ADMIN') return true;
    // KPIs globais: só Admin (já tratado acima).
    if (kpi.area === null) return false;
    return session.user.area === kpi.area;
  }

  // Pré-seleção do dropdown de área no formulário de config: se o
  // filtro é específico, vai como default; senão, vazio.
  const configDefaultArea: Area | 'GLOBAL' | null =
    currentArea === 'ALL' ? null : (currentArea as Area | 'GLOBAL');

  return (
    <section
      aria-labelledby="kpis-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            KPIs
          </p>
          <h1
            id="kpis-heading"
            className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
          >
            Indicadores por área
          </h1>
          <p className="text-text-secondary">
            Acompanhe os KPIs da sua área e registre os valores mais
            recentes.
          </p>
        </div>

        <div className="flex flex-col gap-3 tablet:flex-row tablet:items-center tablet:justify-between desktop:flex-row desktop:items-center desktop:justify-between">
          {/* Seletor de área (Task 9.3) */}
          <div className="flex w-full flex-col gap-1.5 tablet:max-w-xs desktop:max-w-xs">
            <label
              htmlFor="kpis-area-filter"
              className="text-xs font-semibold uppercase tracking-[1.5px] text-text-muted"
            >
              Filtrar por área
            </label>
            <select
              id="kpis-area-filter"
              value={currentArea}
              onChange={(e) =>
                handleAreaChange(
                  e.target.value as 'ALL' | 'GLOBAL' | Area,
                )
              }
              className="h-10 w-full rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30"
            >
              {areaOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {!configPermLoading && canConfigureKpi && (
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setConfigOpen(true)}
            >
              + Novo KPI
            </Button>
          )}
        </div>
      </header>

      {/* Listagem (Task 9.3, 9.4) */}
      {kpis.length === 0 ? (
        <p
          role="status"
          className="rounded-lg border border-dashed border-border-light bg-surface-card p-8 text-center text-sm text-text-muted"
        >
          Nenhum KPI visível para o filtro selecionado.
        </p>
      ) : (
        <ul
          className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3"
          aria-label="Lista de KPIs"
        >
          {kpis.map((kpi) => (
            <li key={kpi.id} className="h-full">
              <KpiCard
                kpi={kpi}
                canWriteValue={canWriteValueFor(kpi)}
                onWriteValue={(k) => setValueTarget(k)}
              />
            </li>
          ))}
        </ul>
      )}

      {/* Modais — montados sob demanda */}
      <KpiValueForm
        open={valueTarget !== null}
        onClose={() => setValueTarget(null)}
        kpi={valueTarget}
        onSaved={handleSaved}
      />
      {canConfigureKpi && (
        <KpiConfigForm
          open={configOpen}
          onClose={() => setConfigOpen(false)}
          defaultArea={configDefaultArea}
          onSaved={handleSaved}
        />
      )}
    </section>
  );
}
