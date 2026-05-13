/**
 * `PATCH /api/goals/:id` — atualização de progresso (Tasks 8.1, 8.8).
 *
 * Apenas Diretor/Admin via RBAC `goal:updateProgress` (Req 9.3).
 * Aceita um payload mínimo `{ progress: number }`, validado pelo
 * `updateProgressSchema` (inteiro 0-100).
 *
 * ─── Histórico (`GoalUpdate`) ────────────────────────────────────────
 *
 * Cada atualização registra um `GoalUpdate` com `oldProgress` (valor
 * anterior) e `newProgress` (valor novo) — esse log alimenta a feed
 * de atividades do dashboard (Task 6.2) e fornece auditoria simples
 * para futuras telas. A atualização do `Goal` e a inserção do
 * `GoalUpdate` ocorrem em `prisma.$transaction([...])` para impedir
 * estados inconsistentes (ex.: registro do log sem alteração da meta
 * ou vice-versa).
 *
 * Comportamento idempotente: quando o cliente envia o mesmo valor
 * de progresso já persistido, ainda assim escrevemos o `GoalUpdate`
 * (com `oldProgress === newProgress`). Manter o registro mesmo de
 * "no-op" é coerente com o estilo "audit log": fica claro que houve
 * uma confirmação naquele instante, mesmo que o número não tenha
 * mudado. O custo extra é desprezível e simplifica o handler.
 *
 * ─── Resposta ───────────────────────────────────────────────────────
 *
 *   200 { goal }
 *   404 quando a meta não existe.
 *   400 quando o body é inválido.
 *
 * Não exigimos `If-Match`/optimistic-locking aqui — o módulo é
 * gerenciado por poucos usuários (Diretor/Admin) e o cenário de
 * race condition é improvável; se mais tarde virar problema, a
 * adição é localizada nesta rota.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';
import type { Area, GoalType } from '@prisma/client';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { updateProgressSchema } from '@/lib/validators/goal';

export const runtime = 'nodejs';

interface GoalRouteParams {
  id: string;
}

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

function notFoundResponse(): Response {
  return NextResponse.json(
    {
      error: true,
      code: 'NOT_FOUND',
      message: 'Meta não encontrada.',
    },
    { status: 404 },
  );
}

async function patchHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: GoalRouteParams },
): Promise<Response> {
  const id = ctx.params?.id;
  if (!id) {
    return notFoundResponse();
  }

  const existing = await prisma.goal.findUnique({ where: { id } });
  if (!existing) {
    return notFoundResponse();
  }

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

  let payload: { progress: number };
  try {
    payload = updateProgressSchema.parse(rawBody);
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

  // Atualização da meta + log do histórico em uma única transação.
  // Garante atomicidade: ou ambos persistem, ou nenhum.
  const [updated] = await prisma.$transaction([
    prisma.goal.update({
      where: { id },
      data: { progress: payload.progress },
    }),
    prisma.goalUpdate.create({
      data: {
        goalId: id,
        updatedById: ctx.session.user.id,
        oldProgress: existing.progress,
        newProgress: payload.progress,
      },
    }),
  ]);

  return NextResponse.json(
    { goal: serializeGoal(updated) },
    { status: 200 },
  );
}

export const PATCH = withAuth<GoalRouteParams>(
  'goal:updateProgress',
  patchHandler,
);
