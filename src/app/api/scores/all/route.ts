/**
 * `GET /api/scores/all` — Task 16.4.
 *
 * Retorna a pontuação acumulada de TODOS os membros ativos para o semestre.
 * Acesso restrito a GP + Diretor (usa `infraction:delete` como proxy de
 * permissão "visualizar todos").
 *
 * Response: { members: [{ id, name, area, totalPoints }], semester }
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { getCurrentSemester, isValidSemester } from '@/lib/validators/score';

export const runtime = 'nodejs';

async function handler(
  req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const { searchParams } = new URL(req.url);
  const semesterParam = searchParams.get('semester');

  const semester =
    semesterParam && isValidSemester(semesterParam) ? semesterParam : getCurrentSemester();

  // Get all active users with their infractions for the semester
  const users = await prisma.user.findMany({
    where: { status: 'ACTIVE' },
    select: {
      id: true,
      name: true,
      area: true,
      infractions: {
        where: { semester },
        select: { points: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const members = users.map((user) => ({
    id: user.id,
    name: user.name,
    area: user.area,
    totalPoints: user.infractions.reduce(
      (sum: number, inf: { points: number }) => sum + inf.points,
      0,
    ),
  }));

  return NextResponse.json({ members, semester }, { status: 200 });
}

export const GET = withAuth('infraction:delete', handler);
