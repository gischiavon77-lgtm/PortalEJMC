/**
 * `DELETE /api/scores/:id` — Tasks 16.1, 16.6.
 *
 * Exclui uma infração. Permissão: equipe GP + Diretor (`infraction:delete`).
 * Após a exclusão, a pontuação acumulada é automaticamente recalculada
 * (a soma no frontend é derivada das infrações restantes — Task 16.2).
 *
 * Resposta:
 *   200 { success: true, message: '...' }
 *   404 se não encontrada
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth, loadPermissionUser } from '@/lib/api-auth';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

type RouteParams = Promise<{ id: string }>;

async function deleteHandler(
  _req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: RouteParams },
): Promise<Response> {
  // Excluir exige GP (área atual no banco) ou Diretor+.
  const permUser = await loadPermissionUser(ctx.session.user.id);
  if (!permUser || !hasPermission(permUser, 'infraction:delete')) {
    return NextResponse.json(
      { error: true, code: 'FORBIDDEN', message: 'Acesso negado.' },
      { status: 403 },
    );
  }

  const params = await ctx.params!;
  const infractionId = params.id;

  if (!infractionId) {
    return NextResponse.json(
      { error: true, code: 'BAD_REQUEST', message: 'ID da infração é obrigatório.' },
      { status: 400 },
    );
  }

  // Verify infraction exists
  const infraction = await prisma.infraction.findUnique({
    where: { id: infractionId },
    select: { id: true },
  });

  if (!infraction) {
    return NextResponse.json(
      { error: true, code: 'NOT_FOUND', message: 'Infração não encontrada.' },
      { status: 404 },
    );
  }

  // Delete the infraction (recalculation is implicit — remaining infractions sum)
  await prisma.infraction.delete({
    where: { id: infractionId },
  });

  return NextResponse.json(
    { success: true, message: 'Infração excluída com sucesso.' },
    { status: 200 },
  );
}

export const DELETE = withAuth(null, deleteHandler as Parameters<typeof withAuth>[1]);
