/**
 * `POST /api/album/reorder` — Reordena membros do álbum.
 *
 * Body: `{ ids: string[] }` — array de IDs na nova ordem.
 * Atualiza o campo `order` de cada membro com base na posição no array.
 * Protegido por permissão `album:manage` (Admin/Diretor).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

async function reorderHandler(
  req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: true, code: 'INVALID_BODY', message: 'JSON inválido.' },
      { status: 400 },
    );
  }

  const { ids } = body as { ids?: unknown };

  if (
    !Array.isArray(ids) ||
    ids.length === 0 ||
    !ids.every((id) => typeof id === 'string' && id.length > 0)
  ) {
    return NextResponse.json(
      {
        error: true,
        code: 'VALIDATION_ERROR',
        message: 'Campo "ids" deve ser um array de strings não vazio.',
      },
      { status: 400 },
    );
  }

  // Update each member's order based on position in the array
  await prisma.$transaction(
    (ids as string[]).map((id, index) =>
      prisma.albumMember.update({
        where: { id },
        data: { order: index },
      }),
    ),
  );

  return NextResponse.json({ success: true }, { status: 200 });
}

export const POST = withAuth('album:manage', reorderHandler);
