/**
 * `GET /api/posts` e `POST /api/posts` — feed da página inicial (Fase 2).
 *
 * GET — qualquer usuário logado. Paginação por cursor:
 *   `?cursor=<id da última publicação exibida>&limit=10`.
 *   200 { posts, nextCursor }
 *
 * POST — permissão `post:create` (Coordenador+). multipart/form-data:
 *   - `content` (texto, 1 a 2000 caracteres, obrigatório)
 *   - `image`   (arquivo opcional: PNG, JPG ou WEBP, até 4 MB, validado
 *                pelo conteúdo e gravado no bucket de imagens, em posts/)
 *   201 { post }
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { Session } from 'next-auth';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { getPost, listPosts, type PostViewer } from '@/lib/posts';
import { prisma } from '@/lib/prisma';
import { deleteFile } from '@/lib/storage';
import { storeUpload } from '@/lib/upload-handler';
import { createPostSchema, listPostsQuerySchema } from '@/lib/validators/post';
import { IMAGE_MIMES } from '@/lib/validators/upload';

export const runtime = 'nodejs';

function viewerOf(session: Session): PostViewer {
  return { id: session.user.id, role: session.user.role, area: session.user.area };
}

function validationError(message: string, err: ZodError): Response {
  return NextResponse.json(
    {
      error: true,
      code: 'VALIDATION_ERROR',
      message,
      fields: err.issues.map((issue) => ({ path: issue.path.join('.'), message: issue.message })),
    },
    { status: 400 },
  );
}

// ─── GET ─────────────────────────────────────────────────────────────

export const GET = withAuth(null, async (req: NextRequest, { session }) => {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = listPostsQuerySchema.safeParse(params);
  if (!parsed.success) {
    return validationError('Parâmetros de consulta inválidos.', parsed.error);
  }

  const { cursor, limit } = parsed.data;

  // Cursor de uma publicação que não existe mais (apagada): o Prisma
  // devolveria lista vazia; respondemos 400 para o cliente recomeçar.
  if (cursor) {
    const exists = await prisma.post.findUnique({ where: { id: cursor }, select: { id: true } });
    if (!exists) {
      return NextResponse.json(
        { error: true, code: 'INVALID_CURSOR', message: 'Recarregue o feed.' },
        { status: 400 },
      );
    }
  }

  const page = await listPosts(viewerOf(session), { cursor, limit });
  return NextResponse.json(page, { status: 200 });
});

// ─── POST ────────────────────────────────────────────────────────────

export const POST = withAuth('post:create', async (req: NextRequest, { session }) => {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: true, code: 'INVALID_FORM', message: 'Envie os dados como multipart/form-data.' },
      { status: 400 },
    );
  }

  const parsed = createPostSchema.safeParse({ content: formData.get('content') ?? undefined });
  if (!parsed.success) {
    return validationError('Dados da publicação inválidos.', parsed.error);
  }

  // A imagem só vai ao Storage depois que o texto passou na validação.
  const image = formData.get('image');
  let imagePath: string | null = null;
  if (image instanceof File && image.size > 0) {
    const stored = await storeUpload(image, {
      bucket: 'images',
      folder: 'posts',
      allowed: IMAGE_MIMES,
      formatsLabel: 'PNG, JPG ou WEBP',
    });
    if (!stored.ok) {
      return stored.response;
    }
    imagePath = stored.path;
  }

  let postId: string;
  try {
    const created = await prisma.post.create({
      data: { content: parsed.data.content, imagePath, authorId: session.user.id },
      select: { id: true },
    });
    postId = created.id;
  } catch (err) {
    // O banco não aceitou: remove a imagem recém-enviada para não ficar órfã.
    await deleteFile('images', imagePath);
    throw err;
  }

  const post = await getPost(postId, viewerOf(session));
  return NextResponse.json({ post }, { status: 201 });
});
