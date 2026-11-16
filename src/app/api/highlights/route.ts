/**
 * `GET /api/highlights` e `POST /api/highlights` — Destaques do Dashboard.
 *
 * GET — retorna todos os highlights (qualquer usuário autenticado).
 * POST — cria/atualiza um highlight por slot (Admin/Diretor via `album:manage`).
 *
 * A foto (PNG, JPG ou WEBP, máx. 4 MB, validada pelo conteúdo) vai para o
 * bucket de imagens do Storage; o banco guarda só o caminho. As respostas
 * trazem `photoUrl` apontando para `/api/files/destaque/:slot`. Ao trocar
 * a foto, a anterior é removida do Storage.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { highlightPhotoUrlFor } from '@/lib/file-urls';
import { deleteFile } from '@/lib/storage';
import { storeUpload } from '@/lib/upload-handler';
import { IMAGE_MIMES } from '@/lib/validators/upload';
import type { Highlight } from '@prisma/client';

export const runtime = 'nodejs';

const VALID_SLOTS = [
  'trainee',
  'coordenador',
  'assessor',
  'gerente',
  'equipe',
  'ref-trainee',
  'ref-coordenador',
  'ref-assessor',
  'ref-gerente',
  'ref-equipe',
  'premio-movimento',
  'premio-sangue',
  'premio-uniao',
  'premio-coracao',
  'premio-voz',
] as const;
type Slot = (typeof VALID_SLOTS)[number];

/**
 * Formato enviado ao cliente: o caminho do bucket (`photoPath`) não sai
 * do servidor; no lugar vai `photoUrl`, a URL da rota de download.
 */
function serializeHighlight(highlight: Highlight) {
  const { photoPath, ...rest } = highlight;
  return { ...rest, photoUrl: highlightPhotoUrlFor(highlight.slot, photoPath) };
}

// ─── GET ─────────────────────────────────────────────────────────────

async function listHandler(
  _req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const highlights = await prisma.highlight.findMany({
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ highlights: highlights.map(serializeHighlight) }, { status: 200 });
}

export const GET = withAuth(null, listHandler);

// ─── POST ────────────────────────────────────────────────────────────

async function upsertHandler(
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

  const slot = formData.get('slot') as string | null;
  const name = formData.get('name') as string | null;
  const photo = formData.get('photo') as File | null;

  // Validação
  const errors: string[] = [];
  if (!slot || !VALID_SLOTS.includes(slot as Slot)) {
    errors.push('Slot inválido.');
  }
  if (!name || name.trim().length === 0) errors.push('Nome é obrigatório.');
  if (name && name.trim().length > 150) errors.push('Nome deve ter no máximo 150 caracteres.');

  if (errors.length > 0) {
    return NextResponse.json(
      { error: true, code: 'VALIDATION_ERROR', message: errors.join(' ') },
      { status: 400 },
    );
  }

  // Processar foto (opcional no upsert — mantém a anterior se não enviada)
  let photoPath: string | undefined;
  if (photo instanceof File && photo.size > 0) {
    const stored = await storeUpload(photo, {
      bucket: 'images',
      folder: 'destaques',
      allowed: IMAGE_MIMES,
      formatsLabel: 'PNG, JPG ou WEBP',
    });
    if (!stored.ok) {
      return stored.response;
    }
    photoPath = stored.path;
  }

  // Guarda o caminho da foto atual para removê-la se for substituída.
  const previous = await prisma.highlight.findUnique({
    where: { slot: slot! },
    select: { photoPath: true },
  });

  let highlight: Highlight;
  try {
    highlight = await prisma.highlight.upsert({
      where: { slot: slot! },
      update: {
        name: name!.trim(),
        ...(photoPath !== undefined && { photoPath }),
      },
      create: {
        slot: slot!,
        name: name!.trim(),
        photoPath: photoPath ?? null,
      },
    });
  } catch (err) {
    // O banco não aceitou: remove a foto recém-enviada para não ficar órfã.
    await deleteFile('images', photoPath);
    throw err;
  }

  if (photoPath !== undefined) {
    await deleteFile('images', previous?.photoPath);
  }

  return NextResponse.json({ highlight: serializeHighlight(highlight) }, { status: 200 });
}

export const POST = withAuth('album:manage', upsertHandler);
