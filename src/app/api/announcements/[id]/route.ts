/**
 * `DELETE /api/announcements/:id` — exclusão de comunicado.
 *
 * Permissão: Coordenador+ via RBAC `announcement:delete`.
 *
 * Respostas:
 *   200 { success: true }
 *   404 quando o comunicado não existe.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type RouteParams = Promise<{ id: string }>;

async function deleteHandler(
  _req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: RouteParams },
): Promise<Response> {
  const params = await ctx.params!;
  const id = params.id;

  const existing = await prisma.announcement.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existing) {
    return NextResponse.json(
      { error: true, code: 'NOT_FOUND', message: 'Comunicado não encontrado.' },
      { status: 404 },
    );
  }

  await prisma.announcement.delete({ where: { id } });

  return NextResponse.json({ success: true }, { status: 200 });
}

export const DELETE = withAuth(
  'announcement:delete',
  deleteHandler as Parameters<typeof withAuth>[1],
);
