/**
 * `GET /api/files/:kind/:id` — Download de imagens guardadas no Storage.
 *
 *   - `/api/files/avatar/:userId`    → avatar de um usuário
 *   - `/api/files/album/:memberId`   → foto de um membro do álbum
 *   - `/api/files/destaque/:slot`    → foto de um destaque do dashboard
 *   - `/api/files/post/:postId`      → imagem de uma publicação do feed
 *   - `/api/files/projeto/:projectId` → banner de um projeto
 *
 * Exige apenas sessão válida (`withAuth(null, ...)`): são as mesmas
 * imagens que qualquer membro logado já vê no portal. Sem login, 401.
 *
 * O cliente informa só o TIPO e o IDENTIFICADOR do registro. O caminho
 * do arquivo no bucket é lido do banco aqui no servidor — o cliente não
 * consegue pedir um caminho arbitrário do Storage.
 *
 * Cache: `private` (nunca em cache compartilhado/CDN) por 1 hora. A URL
 * gerada por `@/lib/file-urls` leva um `?v=` que muda a cada upload,
 * então uma foto trocada aparece na hora.
 */

import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { fileNotFoundResponse, fileResponse } from '@/lib/file-response';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

interface FileRouteParams {
  kind: string;
  id: string;
}

const IMAGE_CACHE_CONTROL = 'private, max-age=3600';

/** Lê do banco o caminho do arquivo para o tipo/identificador pedidos. */
async function resolveImagePath(kind: string, id: string): Promise<string | null> {
  switch (kind) {
    case 'avatar': {
      const user = await prisma.user.findUnique({ where: { id }, select: { avatarPath: true } });
      return user?.avatarPath ?? null;
    }
    case 'album': {
      const member = await prisma.albumMember.findUnique({
        where: { id },
        select: { photoPath: true },
      });
      return member?.photoPath ?? null;
    }
    case 'destaque': {
      const highlight = await prisma.highlight.findUnique({
        where: { slot: id },
        select: { photoPath: true },
      });
      return highlight?.photoPath ?? null;
    }
    case 'post': {
      const post = await prisma.post.findUnique({ where: { id }, select: { imagePath: true } });
      return post?.imagePath ?? null;
    }
    case 'projeto': {
      const project = await prisma.project.findUnique({
        where: { id },
        select: { bannerPath: true },
      });
      return project?.bannerPath ?? null;
    }
    default:
      return null;
  }
}

export const GET = withAuth<FileRouteParams>(null, async (_req: NextRequest, { params }) => {
  const kind = params?.kind;
  const id = params?.id;
  if (!kind || !id) {
    return fileNotFoundResponse();
  }

  const path = await resolveImagePath(kind, id);
  return fileResponse('images', path, { cacheControl: IMAGE_CACHE_CONTROL });
});
