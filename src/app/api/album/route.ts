/**
 * `GET /api/album?gestao=2026.1` e `POST /api/album` — Álbum de Figurinhas.
 *
 * GET — lista todos os membros do álbum para uma gestão, agrupados por área.
 * POST — adiciona um novo membro ao álbum (Admin/Diretor via `album:manage`).
 *
 * A foto (PNG, JPG ou WEBP, máx. 4 MB, validada pelo conteúdo) vai para o
 * bucket de imagens do Storage; o banco guarda só o caminho. As respostas
 * trazem `photoUrl` apontando para `/api/files/album/:id`.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { albumPhotoUrlFor } from '@/lib/file-urls';
import { deleteFile } from '@/lib/storage';
import { storeUpload } from '@/lib/upload-handler';
import { IMAGE_MIMES } from '@/lib/validators/upload';
import type { AlbumMember, Area } from '@prisma/client';

export const runtime = 'nodejs';

const VALID_AREAS: Area[] = [
  'VENDAS',
  'PRESIDENCIA',
  'PROJETOS',
  'MARKETING',
  'GESTAO_PESSOAS',
  'ADM_FIN',
];

/**
 * Formato enviado ao cliente: o caminho do bucket (`photoPath`) não sai
 * do servidor; no lugar vai `photoUrl`, a URL da rota de download.
 */
function serializeMember(member: AlbumMember) {
  const { photoPath, ...rest } = member;
  return { ...rest, photoUrl: albumPhotoUrlFor(member.id, photoPath) };
}

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
  const grouped: Record<string, ReturnType<typeof serializeMember>[]> = {};
  for (const area of VALID_AREAS) {
    grouped[area] = [];
  }
  for (const member of members) {
    if (grouped[member.area]) {
      grouped[member.area].push(serializeMember(member));
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
  let photoPath: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    const stored = await storeUpload(photo, {
      bucket: 'images',
      folder: 'album',
      allowed: IMAGE_MIMES,
      formatsLabel: 'PNG, JPG ou WEBP',
    });
    if (!stored.ok) {
      return stored.response;
    }
    photoPath = stored.path;
  }

  let created: AlbumMember;
  try {
    created = await prisma.albumMember.create({
      data: {
        name: name!.trim(),
        position: position!.trim(),
        area: area as Area,
        gestao: gestao!,
        photoPath,
      },
    });
  } catch (err) {
    // O banco não aceitou: remove a foto recém-enviada para não ficar órfã.
    await deleteFile('images', photoPath);
    throw err;
  }

  return NextResponse.json({ member: serializeMember(created) }, { status: 201 });
}

export const POST = withAuth('album:manage', createHandler);
