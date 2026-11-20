/**
 * `DELETE /api/posts/:id` — apaga uma publicação do feed (Fase 2).
 *
 * Permissão `post:delete`: Diretor e Admin apagam qualquer publicação; o
 * autor apaga a própria (predicado com `context.ownerId`). A checagem só
 * pode acontecer depois de descobrir o autor, por isso o `withAuth` exige
 * apenas sessão e a permissão é conferida dentro do handler.
 *
 * Remove também a imagem no Storage e, em cascata, as curtidas.
 *   200 { success: true } · 403 sem permissão · 404 inexistente
 */

import { NextResponse, type NextRequest } from 'next/server';

import { forbiddenResponse, withAuth } from '@/lib/api-auth';
import { hasPermission } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/storage';

export const runtime = 'nodejs';

interface PostRouteParams {
  id: string;
}

export const DELETE = withAuth<PostRouteParams>(
  null,
  async (_req: NextRequest, { session, params }) => {
    const id = params?.id;
    const post = id
      ? await prisma.post.findUnique({
          where: { id },
          select: { id: true, authorId: true, imagePath: true },
        })
      : null;

    if (!post) {
      return NextResponse.json(
        { error: true, code: 'NOT_FOUND', message: 'Publicação não encontrada.' },
        { status: 404 },
      );
    }

    if (!hasPermission(session.user, 'post:delete', { ownerId: post.authorId })) {
      return forbiddenResponse();
    }

    await prisma.post.delete({ where: { id: post.id } });
    await deleteFile('images', post.imagePath);

    return NextResponse.json({ success: true }, { status: 200 });
  },
);
