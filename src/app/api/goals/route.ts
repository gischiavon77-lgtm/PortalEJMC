/**
 * `GET /api/goals` e `POST /api/goals` — Task 8.1.
 *
 * GET — lista as metas visíveis ao usuário autenticado, aplicando a
 * regra de visibilidade da Req 9.7 (Property 9):
 *   - Metas gerais → para todos.
 *   - Metas por área → apenas para usuários da mesma área e para
 *     Diretor/Admin (override hierárquico).
 *
 * Aceita filtros opcionais:
 *   - `?type=GENERAL|AREA` → restringe à categoria.
 *   - `?area=<Area>`       → restringe à área (válido apenas se o
 *     usuário enxergar aquela área).
 *
 * POST — cria uma meta. Apenas Diretor/Admin via RBAC `goal:create`
 * (Req 9.1). O progresso inicial é sempre 0% (Req 9.1: "percentual
 * de progresso inicial (0%)"); o cliente não pode passar `progress`
 * no payload de criação. O timestamp `createdAt`/`updatedAt` é
 * gerenciado pelo Prisma.
 *
 * ─── Resposta do POST ───────────────────────────────────────────────
 *
 *   201 { goal }
 *
 * Onde `goal` é o registro persistido já serializado (datas como ISO
 * string). Não criamos uma `GoalUpdate` no momento da criação — o
 * histórico só faz sentido a partir da primeira atualização real,
 * conforme estilo "log de mudanças".
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import type { Area, GoalType } from '@prisma/client';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  canUserSeeGoal,
  goalVisibilityWhere,
} from '@/lib/goals';
import {
  createGoalSchema,
  listGoalsQuerySchema,
} from '@/lib/validators/goal';

export const runtime = 'nodejs';

/**
 * Shape serializável de uma meta. Convertemos `Date` → ISO string para
 * fronteiras client/server (RSC e fetch). Mantemos `area` como `null`
 * em metas gerais para que o consumidor não precise checar
 * `goal.type` antes de renderizar.
 */
function serializeGoal(goal: {
  id: string;
  name: string;
  description: string | null;
  type: GoalType;
  area: Area | null;
  deadline: Date;
  progress: number;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: goal.id,
    name: goal.name,
    description: goal.description ?? '',
    type: goal.type,
    area: goal.area,
    deadline: goal.deadline.toISOString(),
    progress: goal.progress,
    createdById: goal.createdById,
    createdAt: goal.createdAt.toISOString(),
    updatedAt: goal.updatedAt.toISOString(),
  };
}

// ─── GET ─────────────────────────────────────────────────────────────

async function listHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  let parsed: { type?: 'GENERAL' | 'AREA'; area?: Area };
  try {
    parsed = listGoalsQuerySchema.parse(queryParams);
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

  // 1. Construir o filtro base de visibilidade (Req 9.7 / Property 9).
  //    Diretor/Admin → sem filtro; demais → metas gerais + da própria
  //    área.
  const visibility = goalVisibilityWhere(ctx.session.user);

  // 2. Combinar com os filtros explícitos `?type=`/`?area=`. Quando o
  //    usuário pede uma área específica que não pode ver, o resultado
  //    sai vazio — não devolvemos 403 porque a query é "lista o que
  //    posso ver desta área", e o "vazio" comunica isso sem expor a
  //    existência das metas.
  const explicitFilters: Record<string, unknown> = {};
  if (parsed.type) explicitFilters.type = parsed.type;
  if (parsed.area) explicitFilters.area = parsed.area;

  // 3. Combinar visibility + filtros via `AND`. Usamos uma forma
  //    Prisma agnóstica — `Prisma.GoalWhereInput` poderia tipar mais
  //    fortemente, mas o objetivo aqui é coexistir com o helper
  //    `goalVisibilityWhere` que retorna `OR`/`type`.
  const where: Record<string, unknown> = { ...visibility, ...explicitFilters };
  if ('OR' in visibility && Object.keys(explicitFilters).length > 0) {
    // Quando a visibility usa `OR` e há filtros explícitos, precisamos
    // de `AND` para evitar que o `type/area` explícito sobrescreva o
    // OR. Convertemos para `{ AND: [visibility, explicitFilters] }`.
    delete where.OR;
    delete where.type;
    delete where.area;
    where.AND = [visibility, explicitFilters];
  }

  const goals = await prisma.goal.findMany({
    where,
    orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
  });

  // Defesa em profundidade: aplica `canUserSeeGoal` na lista
  // resultante. Se o filtro Prisma estiver correto, esse passo é
  // no-op; mas garante que mesmo um eventual bug no `where` jamais
  // vaze metas indevidas para a UI. Custo O(n) trivial.
  const visible = goals.filter((g) =>
    canUserSeeGoal(ctx.session.user, { type: g.type, area: g.area }),
  );

  return NextResponse.json(
    { goals: visible.map(serializeGoal) },
    { status: 200 },
  );
}

export const GET = withAuth(null, listHandler);

// ─── POST ────────────────────────────────────────────────────────────

async function createHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session },
): Promise<Response> {
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
    description: string;
    type: 'GENERAL' | 'AREA';
    area?: Area;
    deadline: Date;
  };
  try {
    payload = createGoalSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Dados da meta inválidos.',
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

  const created = await prisma.goal.create({
    data: {
      name: payload.name,
      description: payload.description || null,
      type: payload.type,
      // `area` é `undefined` quando `type === 'GENERAL'` (validação
      // já garantiu); o Prisma aceita `undefined` como "não setar".
      area: payload.type === 'AREA' ? payload.area! : null,
      deadline: payload.deadline,
      // Req 9.1 — progresso inicial sempre 0%.
      progress: 0,
      createdById: ctx.session.user.id,
    },
  });

  return NextResponse.json(
    { goal: serializeGoal(created) },
    { status: 201 },
  );
}

export const POST = withAuth('goal:create', createHandler);
