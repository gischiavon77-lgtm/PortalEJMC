/**
 * PATCH /api/users/me/avatar — Upload de foto de perfil.
 *
 * Tasks 18.1, 18.3 / Módulo Configurações:
 *   - Aceita multipart/form-data com campo "avatar" (File).
 *   - Valida tipo MIME: apenas PNG e JPG.
 *   - Valida tamanho: máximo 5 MB.
 *   - Armazena como data URL (base64) no campo `avatarUrl` do usuário.
 *   - Retorna 400 se formato inválido ou tamanho excedido.
 *   - Retorna 200 com a nova URL do avatar em sucesso.
 *
 * Task 18.5: mensagens de sucesso/erro em pt-BR.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { AVATAR_ALLOWED_MIMES, AVATAR_MAX_SIZE_BYTES } from '@/lib/validators/settings';

export const runtime = 'nodejs';

/**
 * Aumenta o limite de body para 6 MB nesta rota (avatar de até 5 MB +
 * overhead do multipart encoding).
 */
export const maxDuration = 30;

export const PATCH = withAuth(null, async (req: NextRequest, { session }) => {
  // ─── 1. Extrair o FormData ────────────────────────────────────────
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      {
        error: true,
        code: 'INVALID_FORM',
        message: 'Formato de requisição inválido. Use multipart/form-data.',
      },
      { status: 400 },
    );
  }

  const file = formData.get('avatar');

  if (!file || !(file instanceof File)) {
    return NextResponse.json(
      {
        error: true,
        code: 'NO_FILE',
        message: 'Nenhum arquivo enviado. Use o campo "avatar".',
      },
      { status: 400 },
    );
  }

  // ─── 2. Validar tipo MIME ─────────────────────────────────────────
  const mimeType = file.type;
  if (!AVATAR_ALLOWED_MIMES.includes(mimeType as (typeof AVATAR_ALLOWED_MIMES)[number])) {
    return NextResponse.json(
      {
        error: true,
        code: 'INVALID_FORMAT',
        message: 'Formato não suportado. Use PNG ou JPG.',
      },
      { status: 400 },
    );
  }

  // ─── 3. Validar tamanho ───────────────────────────────────────────
  if (file.size > AVATAR_MAX_SIZE_BYTES) {
    return NextResponse.json(
      {
        error: true,
        code: 'FILE_TOO_LARGE',
        message: 'A foto deve ter no máximo 5 MB.',
      },
      { status: 400 },
    );
  }

  // ─── 4. Converter para base64 data URL ─────────────────────────────
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString('base64');
  const dataUrl = `data:${mimeType};base64,${base64}`;

  // ─── 5. Atualizar no banco ─────────────────────────────────────────
  await prisma.user.update({
    where: { id: session.user.id },
    data: { avatarUrl: dataUrl },
  });

  return NextResponse.json(
    {
      message: 'Foto de perfil atualizada!',
      avatarUrl: dataUrl,
    },
    { status: 200 },
  );
});
