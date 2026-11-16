/**
 * PATCH /api/users/me/avatar — Upload de foto de perfil.
 *
 * Tasks 18.1, 18.3 / Módulo Configurações:
 *   - Aceita multipart/form-data com campo "avatar" (File).
 *   - Valida o tipo pelo CONTEÚDO do arquivo (assinatura): só PNG e JPG.
 *   - Valida tamanho: máximo 4 MB (ver `@/lib/validators/upload`).
 *   - Envia o arquivo ao bucket de imagens do Storage e grava no banco
 *     apenas o caminho (`User.avatarPath`). A foto anterior é removida.
 *   - Retorna 400 se formato inválido ou tamanho excedido; 503 se o
 *     Storage não estiver configurado.
 *   - Retorna 200 com a URL do avatar (rota `/api/files/avatar/:id`).
 *
 * Task 18.5: mensagens de sucesso/erro em pt-BR.
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { avatarUrlFor } from '@/lib/file-urls';
import { deleteFile } from '@/lib/storage';
import { storeUpload } from '@/lib/upload-handler';
import { AVATAR_MIMES } from '@/lib/validators/upload';

export const runtime = 'nodejs';

/** Tempo máximo da função: cobre o envio do arquivo ao Storage. */
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

  // ─── 2. Validar (tipo pelo conteúdo + tamanho) e enviar ao Storage ─
  const stored = await storeUpload(file, {
    bucket: 'images',
    folder: 'avatars',
    allowed: AVATAR_MIMES,
    formatsLabel: 'PNG ou JPG',
  });
  if (!stored.ok) {
    return stored.response;
  }

  // ─── 3. Gravar o caminho no banco ─────────────────────────────────
  const userId = session.user.id;
  const previous = await prisma.user.findUnique({
    where: { id: userId },
    select: { avatarPath: true },
  });

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { avatarPath: stored.path },
    });
  } catch (err) {
    // O banco não aceitou: remove o arquivo recém-enviado para não ficar órfão.
    await deleteFile('images', stored.path);
    throw err;
  }

  // ─── 4. Remover a foto anterior do Storage ────────────────────────
  await deleteFile('images', previous?.avatarPath);

  return NextResponse.json(
    {
      message: 'Foto de perfil atualizada!',
      avatarUrl: avatarUrlFor(userId, stored.path),
    },
    { status: 200 },
  );
});
