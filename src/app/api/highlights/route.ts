/**
 * `GET /api/highlights` e `POST /api/highlights` — Destaques do Dashboard.
 *
 * GET — retorna todos os highlights (qualquer usuário autenticado).
 * POST — cria/atualiza um highlight por slot (Admin/Diretor via `album:manage`).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

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

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5MB
const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];

// ─── GET ─────────────────────────────────────────────────────────────

async function listHandler(
  _req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const highlights = await prisma.highlight.findMany({
    orderBy: { createdAt: 'asc' },
  });

  return NextResponse.json({ highlights }, { status: 200 });
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
  let photoUrl: string | undefined;
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

  const highlight = await prisma.highlight.upsert({
    where: { slot: slot! },
    update: {
      name: name!.trim(),
      ...(photoUrl !== undefined && { photoUrl }),
    },
    create: {
      slot: slot!,
      name: name!.trim(),
      photoUrl: photoUrl ?? null,
    },
  });

  return NextResponse.json({ highlight }, { status: 200 });
}

export const POST = withAuth('album:manage', upsertHandler);
