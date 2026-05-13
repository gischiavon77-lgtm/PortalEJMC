/**
 * `GET /api/kpis` e `POST /api/kpis` — Tasks 9.1 e 9.6.
 *
 * GET — lista os KPIs visíveis ao usuário autenticado, aplicando a
 * regra de visibilidade da Req 10.1 (KPIs da própria área + globais;
 * Diretor/Admin veem tudo). Aceita filtro opcional:
 *
 *   - `?area=<Area>`  → restringe à área (ex.: `VENDAS`).
 *   - `?area=GLOBAL`  → restringe aos KPIs sem área associada.
 *
 * Cada KPI vem acompanhado do **valor mais recente** (`latestValue` +
 * `latestRecordedAt`) — Req 10.4 / Task 9.4. Servimos o valor já
 * convertido para `number` (Decimal serialization safe) e datas como
 * ISO strings para que a página `/kpis` (Server Component) consiga
 * passar ao Client Component sem trips adicionais.
 *
 * POST — cria um KPI (configuração administrativa, Req 10.5). Apenas
 * Admin via RBAC `kpi:write`. Validações:
 *   - `name` 1–60 chars (Req 10.5).
 *   - `unit` ∈ KpiUnit.
 *   - `area` enum ou `null` (KPI global).
 *   - `intervalMin` ≤ `intervalMax` quando ambos definidos.
 *
 * ─── Limite de 20 KPIs adicionais por área (Req 10.5) ───────────────
 *
 * Req 10.5: "permitir que um Administrador configure até 20 KPIs
 * adicionais por Área". Os 5 KPIs pré-definidos (seed) não contam
 * para esse limite — eles existem por padrão. A rota verifica o
 * número de KPIs por área ANTES de criar; quando excedido, devolve
 * 400 com `code: 'AREA_KPI_LIMIT'`.
 *
 * O critério "adicionais" é interpretado como "não-seed" — usamos
 * a lista de nomes/áreas seedados como referência. Manter a
 * referência aqui (em vez de uma flag persistida) evita migração
 * adicional só para distinguir "default" de "custom"; a chance de
 * colisão por nome é mitigada pela checagem de unicidade
 * `(name, area)` que faríamos em uma evolução futura — hoje o
 * Prisma não tem essa unique key, então duplicatas são possíveis e
 * a contagem inclui-as (decisão segura do lado conservador).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { Prisma, type Area, type KpiUnit } from '@prisma/client';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { canUserSeeKpi, kpiVisibilityWhere } from '@/lib/kpis';
import {
  createKpiSchema,
  listKpisQuerySchema,
} from '@/lib/validators/kpi';

export const runtime = 'nodejs';

/** Limite de KPIs "adicionais" por área (Req 10.5). */
const MAX_KPIS_PER_AREA = 20 + /* offset por seeds da área */ 0;

/**
 * KPIs seed (Task 9.7) — não contam para o limite de "adicionais"
 * por área. Mantemos a referência aqui para que a rota saiba
 * subtrair antes de aplicar o limite. A lista coincide com
 * `prisma/seed.ts`.
 */
const SEED_KPI_NAMES_BY_AREA: Partial<Record<Area, string[]>> = {
  ADM_FIN: ['Inadimplência'],
  PROJETOS: ['Capacidade Produtiva', 'Congelamentos'],
  VENDAS: ['NPS', 'CSAT'],
};

interface KpiWithLatest {
  id: string;
  name: string;
  unit: KpiUnit;
  area: Area | null;
  intervalMin: number | null;
  intervalMax: number | null;
  latestValue: number | null;
  latestRecordedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function decimalToNumber(value: Prisma.Decimal | number | null): number | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
}

// ─── GET ─────────────────────────────────────────────────────────────

async function listHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  let parsed: { area?: Area | 'GLOBAL' };
  try {
    parsed = listKpisQuerySchema.parse(queryParams);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de consulta inválidos.',
          fields: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    throw err;
  }

  // 1) Visibilidade (Req 10.1).
  const visibility = kpiVisibilityWhere(ctx.session.user);

  // 2) Filtro explícito ?area=...
  const explicitFilters: Record<string, unknown> = {};
  if (parsed.area === 'GLOBAL') {
    explicitFilters.area = null;
  } else if (parsed.area) {
    explicitFilters.area = parsed.area;
  }

  // 3) Combinação visibility + filtros — usa AND quando há overlap
  //    para evitar que filtro explícito sobrescreva o OR.
  const where: Record<string, unknown> = { ...visibility, ...explicitFilters };
  if ('OR' in visibility && Object.keys(explicitFilters).length > 0) {
    delete where.OR;
    delete where.area;
    where.AND = [visibility, explicitFilters];
  }

  const kpis = await prisma.kpi.findMany({
    where,
    orderBy: [{ area: 'asc' }, { name: 'asc' }],
    select: {
      id: true,
      name: true,
      unit: true,
      area: true,
      intervalMin: true,
      intervalMax: true,
      createdAt: true,
      updatedAt: true,
      // Inclui apenas o valor mais recente (Req 10.4 / Task 9.4).
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

  // Defesa em profundidade: filtra novamente em memória.
  const visible = kpis.filter((k) =>
    canUserSeeKpi(ctx.session.user, { area: k.area }),
  );

  const serialized: KpiWithLatest[] = visible.map((k) => {
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
      createdAt: k.createdAt.toISOString(),
      updatedAt: k.updatedAt.toISOString(),
    };
  });

  return NextResponse.json({ kpis: serialized }, { status: 200 });
}

export const GET = withAuth(null, listHandler);

// ─── POST ────────────────────────────────────────────────────────────

async function createHandler(req: NextRequest): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: true,
        code: 'INVALID_JSON',
        message: 'Corpo da requisição inválido. Esperado JSON válido.',
      },
      { status: 400 },
    );
  }

  let payload: {
    name: string;
    unit: KpiUnit;
    area: Area | null;
    intervalMin?: number;
    intervalMax?: number;
  };
  try {
    payload = createKpiSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Dados do KPI inválidos.',
          fields: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    throw err;
  }

  // Limite de KPIs adicionais por área (Req 10.5). KPIs globais
  // (area === null) não recebem o limite — não fazem parte do "20
  // por Área". Caso a empresa precise restringir globais no futuro,
  // basta adicionar uma entrada análoga.
  if (payload.area !== null) {
    const seedCount = SEED_KPI_NAMES_BY_AREA[payload.area]?.length ?? 0;
    const totalInArea = await prisma.kpi.count({
      where: { area: payload.area },
    });
    const additional = Math.max(0, totalInArea - seedCount);
    if (additional >= MAX_KPIS_PER_AREA) {
      return NextResponse.json(
        {
          error: true,
          code: 'AREA_KPI_LIMIT',
          message: `Cada área pode ter no máximo ${MAX_KPIS_PER_AREA} KPIs adicionais.`,
        },
        { status: 400 },
      );
    }
  }

  const created = await prisma.kpi.create({
    data: {
      name: payload.name,
      unit: payload.unit,
      area: payload.area,
      intervalMin: payload.intervalMin ?? null,
      intervalMax: payload.intervalMax ?? null,
    },
    select: {
      id: true,
      name: true,
      unit: true,
      area: true,
      intervalMin: true,
      intervalMax: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json(
    {
      kpi: {
        id: created.id,
        name: created.name,
        unit: created.unit,
        area: created.area,
        intervalMin: created.intervalMin,
        intervalMax: created.intervalMax,
        latestValue: null,
        latestRecordedAt: null,
        createdAt: created.createdAt.toISOString(),
        updatedAt: created.updatedAt.toISOString(),
      },
    },
    { status: 201 },
  );
}

export const POST = withAuth('kpi:write', createHandler);
