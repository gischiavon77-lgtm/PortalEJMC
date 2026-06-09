/**
 * `DELETE /api/album/:id` — remove um membro do álbum de figurinhas.
 *
 * Apenas Admin/Diretor via `album:manage`.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface AlbumRouteParams {
  id: string;
}

async function deleteHandler(
  _req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: AlbumRouteParams },
): Promise<Response> {
  const id = ctx.params?.id;
  if (!id) {
    return NextResponse.json(
      { error: true, code: 'NOT_FOUND', message: 'ID não fornecido.' },
      { status: 404 },
    );
  }

  const existing = await prisma.albumMember.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { error: true, code: 'NOT_FOUND', message: 'Membro não encontrado no álbum.' },
      { status: 404 },
    );
  }

  await prisma.albumMember.delete({ where: { id } });

  return NextResponse.json({ success: true }, { status: 200 });
}

export const DELETE = withAuth<AlbumRouteParams>('album:manage', deleteHandler);
