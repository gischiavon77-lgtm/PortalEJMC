/**
 * `POST /api/posts/:id/like` — curtir · `DELETE /api/posts/:id/like` — descurtir.
 *
 * Qualquer usuário logado (que já é sempre um membro ativo: a sessão é
 * reconferida no banco a cada requisição). Uma curtida por pessoa em cada
 * publicação, garantida pela chave primária (postId, userId).
 *
 * As duas operações são idempotentes: curtir de novo ou descurtir o que
 * não estava curtido não muda nada e não dá erro.
 *   200 { likeCount, likedByMe } · 404 publicação inexistente
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { Session } from 'next-auth';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface LikeRouteParams {
  id: string;
}

function notFound(): Response {
  return NextResponse.json(
    { error: true, code: 'NOT_FOUND', message: 'Publicação não encontrada.' },
    { status: 404 },
  );
}

async function likeState(postId: string, userId: string) {
  const [likeCount, mine] = await Promise.all([
    prisma.postLike.count({ where: { postId } }),
    prisma.postLike.findUnique({
      where: { postId_userId: { postId, userId } },
      select: { postId: true },
    }),
  ]);
  return { likeCount, likedByMe: Boolean(mine) };
}

async function handle(
  like: boolean,
  session: Session,
  postId: string | undefined,
): Promise<Response> {
  if (!postId) return notFound();
  const exists = await prisma.post.findUnique({ where: { id: postId }, select: { id: true } });
  if (!exists) return notFound();

  const userId = session.user.id;
  if (like) {
    await prisma.postLike.upsert({
      where: { postId_userId: { postId, userId } },
      create: { postId, userId },
      update: {},
    });
  } else {
    await prisma.postLike.deleteMany({ where: { postId, userId } });
  }

  return NextResponse.json(await likeState(postId, userId), { status: 200 });
}

export const POST = withAuth<LikeRouteParams>(null, (_req: NextRequest, { session, params }) =>
  handle(true, session, params?.id),
);

export const DELETE = withAuth<LikeRouteParams>(null, (_req: NextRequest, { session, params }) =>
  handle(false, session, params?.id),
);
