import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Prisma, type Area } from '@prisma/client';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canUserSeeKpi, kpiVisibilityWhere } from '@/lib/kpis';
import { KpisShell } from '@/components/kpis/KpisShell';
import type { KpiCardData } from '@/components/kpis/KpiCard';

/**
 * `/kpis` — Listagem de KPIs por área (Tasks 9.3, 9.4).
 *
 * Server Component que carrega os KPIs visíveis ao usuário direto do
 * Prisma (mesma estratégia adotada em `/metas` e `/dashboard`) e
 * entrega ao `KpisShell` client-side, responsável pelo seletor de
 * área (Task 9.3), modais de "Inserir valor" (Task 9.5) e "Novo KPI"
 * (Task 9.6 — admin).
 *
 * ─── Por que Server Component + Prisma direto? ──────────────────────
 *
 * O layout `(portal)/layout.tsx` já garante sessão autenticada via
 * `auth()`. Daí podemos consultar o banco diretamente sem fazer um
 * roundtrip HTTP para `/api/kpis`. Vantagens:
 *
 *   - Menos latência (sem fetch interno → mesmo processo).
 *   - Cache previsível: marcamos `dynamic = 'force-dynamic'` para
 *     garantir que cada navegação reflita atualizações recentes.
 *   - Permissões consistentes: aplicamos `kpiVisibilityWhere(user)`
 *     no filtro Prisma e revalidamos com `canUserSeeKpi` em memória
 *     (defesa em profundidade).
 *
 * ─── Filtro por área (Task 9.3) ─────────────────────────────────────
 *
 * Aceita `?area=<Area>|GLOBAL|ALL` na URL. `ALL` (default) carrega o
 * conjunto completo permitido pela visibilidade; `GLOBAL` filtra
 * apenas KPIs sem área associada; valores específicos do enum
 * filtram por área. O seletor no `KpisShell` reescreve a URL via
 * `router.push(...)` sem perder estado do drawer mobile.
 */

const SUPPORTED_AREA_FILTERS = [
  'VENDAS',
  'PRESIDENCIA',
  'PROJETOS',
  'MARKETING',
  'GESTAO_PESSOAS',
  'ADM_FIN',
  'GLOBAL',
] as const;

type AreaFilter = (typeof SUPPORTED_AREA_FILTERS)[number] | 'ALL';

function normalizeAreaFilter(raw: string | undefined): AreaFilter {
  if (!raw) return 'ALL';
  const upper = raw.toUpperCase();
  if (upper === 'ALL') return 'ALL';
  if ((SUPPORTED_AREA_FILTERS as readonly string[]).includes(upper)) {
    return upper as AreaFilter;
  }
  return 'ALL';
}

export const metadata: Metadata = {
  title: 'KPIs',
  description: 'Indicadores-chave de desempenho por área no Portal Interno EJMC.',
};

// KPIs ganham valores novos com frequência (qualquer membro da área
// pode registrar). `force-dynamic` evita cacheamento que mostraria
// dados defasados.
export const dynamic = 'force-dynamic';

interface KpisPageProps {
  searchParams?: Promise<{ area?: string | string[] }> | { area?: string | string[] };
}

function decimalToNumber(value: Prisma.Decimal | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
}

export default async function KpisPage(props: KpisPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // Next 15 entrega `searchParams` como Promise; Next 14 entrega
  // como objeto direto. `Promise.resolve` cobre os dois.
  const search = (await Promise.resolve(props.searchParams)) ?? {};
  const rawArea = Array.isArray(search.area) ? search.area[0] : search.area;
  const areaFilter = normalizeAreaFilter(rawArea);

  let kpis: KpiCardData[] = [];
  try {
    // 1) Filtro de visibilidade (Req 10.1).
    const visibility = kpiVisibilityWhere({
      role: session.user.role,
      area: session.user.area,
    });

    // 2) Filtro explícito por área da URL.
    const explicitFilters: Record<string, unknown> = {};
    if (areaFilter === 'GLOBAL') {
      explicitFilters.area = null;
    } else if (areaFilter !== 'ALL') {
      explicitFilters.area = areaFilter as Area;
    }

    const where: Record<string, unknown> = { ...visibility, ...explicitFilters };
    if ('OR' in visibility && Object.keys(explicitFilters).length > 0) {
      delete where.OR;
      delete where.area;
      where.AND = [visibility, explicitFilters];
    }

    const dbKpis = await prisma.kpi.findMany({
      where,
      orderBy: [{ area: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        unit: true,
        area: true,
        intervalMin: true,
        intervalMax: true,
        values: {
          take: 1,
          orderBy: { recordedAt: 'desc' },
          select: {
            value: true,
            recordedAt: true,
          },
        },
      },
    });

    // Defesa em profundidade — protege contra qualquer eventual bug
    // no `where`.
    const visible = dbKpis.filter((k) => canUserSeeKpi(session.user, { area: k.area }));

    kpis = visible.map((k) => {
      const latest = k.values[0] ?? null;
      return {
        id: k.id,
        name: k.name,
        unit: k.unit,
        area: k.area,
        intervalMin: k.intervalMin,
        intervalMax: k.intervalMax,
        latestValue: latest ? decimalToNumber(latest.value) : null,
        latestRecordedAt: latest ? latest.recordedAt.toISOString() : null,
      };
    });
  } catch (err) {
    console.error('[kpis] DB error:', err);
    kpis = [];
  }

  // Lista das áreas disponíveis no seletor — limitamos às áreas que
  // o usuário pode ver para que o dropdown não exponha conjuntos
  // proibidos. Diretor/Admin enxergam todas.
  const userCanSeeAllAreas = session.user.role === 'ADMIN' || session.user.role === 'DIRETOR';

  return (
    <KpisShell
      kpis={kpis}
      currentArea={areaFilter}
      currentUserArea={session.user.area}
      userCanSeeAllAreas={userCanSeeAllAreas}
    />
  );
}
