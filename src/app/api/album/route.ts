/**
 * `GET /api/album?gestao=2026.1` e `POST /api/album` — Álbum de Figurinhas.
 *
 * GET — lista todos os membros do álbum para uma gestão, agrupados por área.
 * POST — adiciona um novo membro ao álbum (Admin/Diretor via `album:manage`).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import type { Area } from '@prisma/client';

export const runtime = 'nodejs';

const VALID_AREAS: Area[] = [
  'VENDAS',
  'PRESIDENCIA',
  'PROJETOS',
  'MARKETING',
  'GESTAO_PESSOAS',
  'ADM_FIN',
];

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// ─── GET ─────────────────────────────────────────────────────────────

async function listHandler(
  req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const url = new URL(req.url);
  const gestao = url.searchParams.get('gestao');

  if (!gestao) {
    return NextResponse.json(
      { error: true, code: 'VALIDATION_ERROR', message: 'Parâmetro "gestao" é obrigatório.' },
      { status: 400 },
    );
  }

  const members = await prisma.albumMember.findMany({
    where: { gestao },
    orderBy: [{ area: 'asc' }, { order: 'asc' }, { name: 'asc' }],
  });

  // Agrupar por área
  const grouped: Record<string, typeof members> = {};
  for (const area of VALID_AREAS) {
    grouped[area] = [];
  }
  for (const member of members) {
    if (grouped[member.area]) {
      grouped[member.area].push(member);
    }
  }

  return NextResponse.json({ gestao, members: grouped }, { status: 200 });
}

export const GET = withAuth(null, listHandler);

// ─── POST ────────────────────────────────────────────────────────────

async function createHandler(
  req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { error: true, code: 'INVALID_BODY', message: 'Esperado multipart/form-data.' },
      { status: 400 },
    );
  }

  const name = formData.get('name') as string | null;
  const position = formData.get('position') as string | null;
  const area = formData.get('area') as string | null;
  const gestao = formData.get('gestao') as string | null;
  const photo = formData.get('photo') as File | null;

  // Validação
  const errors: string[] = [];
  if (!name || name.trim().length === 0) errors.push('Nome é obrigatório.');
  if (name && name.trim().length > 150) errors.push('Nome deve ter no máximo 150 caracteres.');
  if (!position || position.trim().length === 0) errors.push('Cargo é obrigatório.');
  if (position && position.trim().length > 100)
    errors.push('Cargo deve ter no máximo 100 caracteres.');
  if (!area || !VALID_AREAS.includes(area as Area)) errors.push('Área inválida.');
  if (!gestao || !/^\d{4}\.\d$/.test(gestao)) errors.push('Gestão inválida (formato: YYYY.S).');

  if (errors.length > 0) {
    return NextResponse.json(
      { error: true, code: 'VALIDATION_ERROR', message: errors.join(' ') },
      { status: 400 },
    );
  }

  // Processar foto (opcional)
  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    if (!ACCEPTED_TYPES.includes(photo.type)) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Tipo de imagem não suportado. Aceitos: PNG, JPG, JPEG, WEBP.',
        },
        { status: 400 },
      );
    }
    if (photo.size > MAX_PHOTO_SIZE) {
      return NextResponse.json(
        { error: true, code: 'VALIDATION_ERROR', message: 'Foto deve ter no máximo 5MB.' },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await photo.arrayBuffer());
    const base64 = buffer.toString('base64');
    photoUrl = `data:${photo.type};base64,${base64}`;
  }

  const created = await prisma.albumMember.create({
    data: {
      name: name!.trim(),
      position: position!.trim(),
      area: area as Area,
      gestao: gestao!,
      photoUrl,
    },
  });

  return NextResponse.json({ member: created }, { status: 201 });
}

export const POST = withAuth('album:manage', createHandler);
