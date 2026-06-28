/**
 * `GET /api/scores` e `POST /api/scores` — Tasks 16.1, 16.2, 16.3, 16.8.
 *
 * GET — lista infrações de um usuário em um semestre:
 *   - `?userId=<id>` → infrações desse usuário (requer permissão GP+Diretor).
 *   - Sem `userId` → infrações do usuário logado (qualquer autenticado).
 *   - `?semester=YYYY-S` → semestre específico; padrão = semestre vigente.
 *   Response: { infractions: [...], totalPoints: number, semester: string }
 *
 * POST — registra nova infração (equipe GP apenas via `infraction:create`).
 *   Body: { type, date, targetId }
 *   Pontos são resolvidos automaticamente a partir de InfractionConfig.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth, loadPermissionUser } from '@/lib/api-auth';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import {
  createInfractionSchema,
  getCurrentSemester,
  getSemesterForDate,
  isValidSemester,
} from '@/lib/validators/score';

export const runtime = 'nodejs';

// ─── GET ─────────────────────────────────────────────────────────────

async function getHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get('userId');
  const semesterParam = searchParams.get('semester');

  // Determine semester
  const semester =
    semesterParam && isValidSemester(semesterParam) ? semesterParam : getCurrentSemester();

  // Determine target user
  let targetUserId = ctx.session.user.id;

  if (requestedUserId && requestedUserId !== ctx.session.user.id) {
    // Viewing another user's scores requires GP (área) ou Diretor+.
    // Lê a área ATUAL do banco para não depender de sessão antiga.
    const permUser = await loadPermissionUser(ctx.session.user.id);
    if (!permUser || !hasPermission(permUser, 'infraction:delete')) {
      return NextResponse.json(
        { error: true, code: 'FORBIDDEN', message: 'Acesso negado.' },
        { status: 403 },
      );
    }
    targetUserId = requestedUserId;
  }

  const infractions = await prisma.infraction.findMany({
    where: {
      userId: targetUserId,
      semester,
    },
    orderBy: { occurredAt: 'desc' },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      target: {
        select: { id: true, name: true },
      },
    },
  });

  const totalPoints = infractions.reduce((sum, inf) => sum + inf.points, 0);

  const serialized = infractions.map((inf) => ({
    id: inf.id,
    type: inf.type,
    date: inf.occurredAt.toISOString(),
    points: inf.points,
    target: { id: inf.target.id, name: inf.target.name },
    createdBy: { id: inf.createdBy.id, name: inf.createdBy.name },
    createdAt: inf.createdAt.toISOString(),
  }));

  return NextResponse.json({ infractions: serialized, totalPoints, semester }, { status: 200 });
}

export const GET = withAuth(null, getHandler);

// ─── POST ────────────────────────────────────────────────────────────

async function createHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session },
): Promise<Response> {
  // Permissão lida da área ATUAL no banco (GP pode registrar mesmo que
  // a sessão tenha sido emitida antes da atribuição da área).
  const permUser = await loadPermissionUser(ctx.session.user.id);
  if (!permUser || !hasPermission(permUser, 'infraction:create')) {
    return NextResponse.json(
      { error: true, code: 'FORBIDDEN', message: 'Acesso negado.' },
      { status: 403 },
    );
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

  // Validate payload
  let payload: { type: 'ATRASO' | 'FALTA' | 'DRESS_CODE'; date: string; targetId: string };
  try {
    payload = createInfractionSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Dados da infração inválidos.',
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

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: payload.targetId },
    select: { id: true, name: true, status: true },
  });

  if (!targetUser) {
    return NextResponse.json(
      {
        error: true,
        code: 'NOT_FOUND',
        message: 'Membro infrator não encontrado.',
      },
      { status: 404 },
    );
  }

  // Get points from InfractionConfig (Task 16.8)
  const config = await prisma.infractionConfig.findUnique({
    where: { type: payload.type },
  });

  if (!config) {
    return NextResponse.json(
      {
        error: true,
        code: 'CONFIG_NOT_FOUND',
        message: 'Configuração de pontos não encontrada para este tipo de infração.',
      },
      { status: 500 },
    );
  }

  // Calculate semester for the infraction date
  const occurredAt = new Date(payload.date);
  const semester = getSemesterForDate(occurredAt);

  // Create the infraction
  const created = await prisma.infraction.create({
    data: {
      type: payload.type,
      occurredAt,
      points: config.points,
      userId: payload.targetId,
      createdById: ctx.session.user.id,
      semester,
    },
    include: {
      createdBy: {
        select: { id: true, name: true },
      },
      target: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json(
    {
      infraction: {
        id: created.id,
        type: created.type,
        date: created.occurredAt.toISOString(),
        points: created.points,
        target: { id: created.target.id, name: created.target.name },
        createdBy: { id: created.createdBy.id, name: created.createdBy.name },
        createdAt: created.createdAt.toISOString(),
      },
    },
    { status: 201 },
  );
}

export const POST = withAuth(null, createHandler);
