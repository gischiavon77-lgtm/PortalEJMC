/**
 * `GET /api/announcements` e `POST /api/announcements` — Task 14.1.
 *
 * GET — lista comunicados paginados (20 por página por padrão),
 * ordenados por data de criação descendente (mais recente primeiro).
 * Qualquer usuário autenticado pode consumir este endpoint.
 *
 * POST — cria um novo comunicado. Apenas Coordenador+ via RBAC
 * `announcement:create` (Req 15.2 / design.md).
 *
 * Resposta do GET:
 *   200 { announcements, pagination: { page, pageSize, total, totalPages } }
 *
 * Resposta do POST:
 *   201 { announcement }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import {
  createAnnouncementSchema,
  listAnnouncementsQuerySchema,
} from '@/lib/validators/announcement';

export const runtime = 'nodejs';

/**
 * Serializa um comunicado para JSON (datas como ISO string).
 */
function serializeAnnouncement(announcement: {
  id: string;
  title: string;
  content: string;
  createdAt: Date;
  author: { id: string; name: string };
}) {
  return {
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    author: {
      id: announcement.author.id,
      name: announcement.author.name,
    },
    createdAt: announcement.createdAt.toISOString(),
  };
}

// ─── GET ─────────────────────────────────────────────────────────────

async function listHandler(
  req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  let parsed: { page: number; pageSize: number };
  try {
    parsed = listAnnouncementsQuerySchema.parse(queryParams);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de consulta inválidos.',
          fields: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    throw err;
  }

  const { page, pageSize } = parsed;
  const skip = (page - 1) * pageSize;

  const [announcements, total] = await Promise.all([
    prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      skip,
      take: pageSize,
      include: {
        author: {
          select: { id: true, name: true },
        },
      },
    }),
    prisma.announcement.count(),
  ]);

  return NextResponse.json(
    {
      announcements: announcements.map(serializeAnnouncement),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    },
    { status: 200 },
  );
}

export const GET = withAuth(null, listHandler);

// ─── POST ────────────────────────────────────────────────────────────

async function createHandler(
  req: NextRequest,
  ctx: { session: import('next-auth').Session },
): Promise<Response> {
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json(
      {
        error: true,
        code: 'INVALID_JSON',
        message: 'Corpo da requisição inválido. Esperado JSON válido.',
      },
      { status: 400 },
    );
  }

  let payload: { title: string; content: string };
  try {
    payload = createAnnouncementSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Dados do comunicado inválidos.',
          fields: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    throw err;
  }

  const created = await prisma.announcement.create({
    data: {
      title: payload.title,
      content: payload.content,
      authorId: ctx.session.user.id,
    },
    include: {
      author: {
        select: { id: true, name: true },
      },
    },
  });

  return NextResponse.json({ announcement: serializeAnnouncement(created) }, { status: 201 });
}

export const POST = withAuth('announcement:create', createHandler);
