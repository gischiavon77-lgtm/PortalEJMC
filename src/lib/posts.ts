/**
 * Feed da página inicial (Fase 2 da reforma) — leitura e formato público.
 *
 * Usado pela página `/dashboard` (primeira página, renderizada no
 * servidor) e por `GET /api/posts` (páginas seguintes), para que os dois
 * entreguem exatamente o mesmo formato.
 *
 * Paginação por cursor: ordem `createdAt desc, id desc`; o cursor é o id
 * da última publicação exibida. Assim, publicações novas não deslocam as
 * páginas seguintes (o que aconteceria com `skip` por número de página).
 *
 * O caminho da imagem no Storage nunca vai ao cliente: vira `imageUrl`,
 * apontando para `/api/files/post/:id`, que confere o login.
 */

import type { Area, UserRole } from '@prisma/client';

import { avatarUrlFor, postImageUrlFor } from '@/lib/file-urls';
import { hasPermission, type PermissionUser } from '@/lib/permissions';
import { effectivePosition } from '@/lib/position';
import { prisma } from '@/lib/prisma';
import { POSTS_PAGE_SIZE } from '@/lib/validators/post';

export interface PostAuthor {
  id: string;
  name: string;
  /** Cargo exibido (MEMBRO aparece como "Trainee"). */
  position: string;
  area: Area | null;
  avatarUrl: string | null;
}

export interface PostItem {
  id: string;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  author: PostAuthor;
  likeCount: number;
  likedByMe: boolean;
  /** Se quem está vendo pode apagar (autor, Diretor ou Admin). */
  canDelete: boolean;
}

export interface PostPage {
  posts: PostItem[];
  /** Id para pedir a próxima página, ou `null` quando não há mais. */
  nextCursor: string | null;
}

/** Quem está vendo o feed: precisa de `id` para "curti" e "posso apagar". */
export type PostViewer = PermissionUser & { id: string };

function selectFor(viewerId: string) {
  return {
    id: true,
    content: true,
    imagePath: true,
    createdAt: true,
    author: {
      select: { id: true, name: true, role: true, position: true, area: true, avatarPath: true },
    },
    _count: { select: { likes: true } },
    // Só a curtida de quem está vendo, para saber se ele já curtiu.
    likes: { where: { userId: viewerId }, select: { userId: true } },
  } as const;
}

interface PostRow {
  id: string;
  content: string;
  imagePath: string | null;
  createdAt: Date;
  author: {
    id: string;
    name: string;
    role: UserRole;
    position: string | null;
    area: Area | null;
    avatarPath: string | null;
  };
  _count: { likes: number };
  likes: { userId: string }[];
}

/** Converte a linha do banco no formato público. Função pura. */
export function serializePost(row: PostRow, viewer: PostViewer): PostItem {
  return {
    id: row.id,
    content: row.content,
    imageUrl: postImageUrlFor(row.id, row.imagePath),
    createdAt: row.createdAt.toISOString(),
    author: {
      id: row.author.id,
      name: row.author.name,
      position: effectivePosition(row.author.role, row.author.position),
      area: row.author.area,
      avatarUrl: avatarUrlFor(row.author.id, row.author.avatarPath),
    },
    likeCount: row._count.likes,
    likedByMe: row.likes.length > 0,
    canDelete: hasPermission(viewer, 'post:delete', { ownerId: row.author.id }),
  };
}

/**
 * Uma página do feed, da publicação mais recente para a mais antiga.
 * Busca `limit + 1` linhas: a sobra só indica se existe próxima página.
 */
export async function listPosts(
  viewer: PostViewer,
  options: { cursor?: string; limit?: number } = {},
): Promise<PostPage> {
  const limit = options.limit ?? POSTS_PAGE_SIZE;

  const rows = (await prisma.post.findMany({
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    ...(options.cursor ? { cursor: { id: options.cursor }, skip: 1 } : {}),
    select: selectFor(viewer.id),
  })) as PostRow[];

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return {
    posts: page.map((row) => serializePost(row, viewer)),
    nextCursor: hasMore ? page[page.length - 1].id : null,
  };
}

/** Uma publicação no formato público (após criar), ou `null`. */
export async function getPost(id: string, viewer: PostViewer): Promise<PostItem | null> {
  const row = (await prisma.post.findUnique({
    where: { id },
    select: selectFor(viewer.id),
  })) as PostRow | null;
  return row ? serializePost(row, viewer) : null;
}
