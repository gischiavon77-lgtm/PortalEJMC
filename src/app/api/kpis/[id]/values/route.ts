/**
 * `POST /api/kpis/:id/values` — Inserção de valor de KPI (Tasks 9.1, 9.2).
 *
 * Cria um `KpiValue` para o KPI informado. Aplica:
 *
 *   1. **Resolução do KPI** (404 se não existir).
 *   2. **Autorização contextual**: usa `kpi:writeValue` com
 *      `context.area` derivado do KPI alvo. O predicado RBAC
 *      (em `permissions.ts`) só permite quando o usuário pertence à
 *      mesma área. Admin ainda passa pela matriz, mesmo para KPIs de
 *      outras áreas, mantendo o "override administrativo" do RBAC.
 *      Para KPIs globais (`area === null`) só Admin via matriz —
 *      o predicado retorna `false` quando `context.area` é nulo.
 *   3. **Validação universal** do payload (`createKpiValueSchema`):
 *      número finito, no máximo 2 casas decimais, dentro do range
 *      absoluto.
 *   4. **Validação por KPI**: aplica `validateValueAgainstKpi` para
 *      checar `unit` (PERCENTAGE/INTEGER) e `intervalMin`/`Max` do KPI.
 *
 * ─── Resposta ───────────────────────────────────────────────────────
 *
 *   201 { value: { id, kpiId, value, recordedAt, recordedById } }
 *   404 quando o KPI não existe.
 *   400 quando o body é inválido.
 *   403 quando o usuário não pode registrar para este KPI.
 *
 * O timestamp `recordedAt` é gerenciado pelo Prisma (`@default(now())`).
 * Não aceitamos `recordedAt` no payload — Req 10.2 exige a "data de
 * inserção" como momento do registro, não uma data informada pelo
 * usuário.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

import {
  ForbiddenError,
  UnauthorizedError,
  forbiddenResponse,
  requirePermission,
  unauthorizedResponse,
} from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  createKpiValueSchema,
  validateValueAgainstKpi,
} from '@/lib/validators/kpi';

export const runtime = 'nodejs';

interface KpiRouteParams {
  id: string;
}

function notFoundResponse(): Response {
  return NextResponse.json(
    {
      error: true,
      code: 'NOT_FOUND',
      message: 'KPI não encontrado.',
    },
    { status: 404 },
  );
}

/**
 * Esta rota usa o estilo "throw" do `requirePermission` (em vez do
 * wrapper `withAuth`) porque a checagem precisa do `context.area`
 * resolvido via consulta ao banco — fluxo mais natural com try/catch
 * do que com o `getContext` opcional do wrapper.
 */
export async function POST(
  req: NextRequest,
  routeContext: { params: Promise<KpiRouteParams> | KpiRouteParams },
): Promise<Response> {
  try {
    const params = await Promise.resolve(routeContext.params);
    const id = params?.id;
    if (!id) return notFoundResponse();

    // 1) Resolve o KPI para descobrir a `area` e impor a permissão.
    const kpi = await prisma.kpi.findUnique({
      where: { id },
      select: {
        id: true,
        unit: true,
        area: true,
        intervalMin: true,
        intervalMax: true,
      },
    });

    if (!kpi) return notFoundResponse();

    // 2) Autorização contextual: matriz (Admin) OU mesma-área via
    //    predicado em `permissions.ts`. Para KPIs globais
    //    (`area === null`) o predicado falha → só Admin grava.
    const session = await requirePermission('kpi:writeValue', {
      area: kpi.area,
    });

    // 3) Parse do body (esperamos JSON com `value` numérico).
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

    let payload: { value: number };
    try {
      payload = createKpiValueSchema.parse(rawBody);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          {
            error: true,
            code: 'VALIDATION_ERROR',
            message: 'Dados do valor inválidos.',
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

    // 4) Validação cruzada (KPI + valor).
    const fieldErrors = validateValueAgainstKpi(payload.value, {
      unit: kpi.unit,
      intervalMin: kpi.intervalMin,
      intervalMax: kpi.intervalMax,
    });
    if (fieldErrors.length > 0) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Valor inválido para este KPI.',
          fields: fieldErrors,
        },
        { status: 400 },
      );
    }

    const created = await prisma.kpiValue.create({
      data: {
        kpiId: kpi.id,
        // Prisma aceita `number` ou `Decimal` em colunas Decimal —
        // passamos o `number` validado. A precisão de 2 casas é
        // garantida pelo schema (`Decimal(10,2)`); o banco trunca
        // qualquer ruído IEEE-754 residual.
        value: new Prisma.Decimal(payload.value.toFixed(2)),
        recordedById: session.user.id,
      },
      select: {
        id: true,
        kpiId: true,
        value: true,
        recordedAt: true,
        recordedById: true,
      },
    });

    return NextResponse.json(
      {
        value: {
          id: created.id,
          kpiId: created.kpiId,
          value:
            created.value instanceof Prisma.Decimal
              ? created.value.toNumber()
              : Number(created.value),
          recordedAt: created.recordedAt.toISOString(),
          recordedById: created.recordedById,
        },
      },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return unauthorizedResponse(err.message);
    }
    if (err instanceof ForbiddenError) {
      return forbiddenResponse(err.message);
    }
    throw err;
  }
}
