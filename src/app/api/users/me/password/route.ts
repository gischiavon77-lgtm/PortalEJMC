/**
 * PATCH /api/users/me/password — Alteração de senha do usuário autenticado.
 *
 * Tasks 18.1, 18.2 / Módulo Configurações:
 *   - Valida a senha atual contra o hash armazenado.
 *   - Valida a nova senha: 8-128 chars, maiúscula/minúscula/número.
 *   - Hash da nova senha com bcryptjs antes de atualizar.
 *   - Retorna 400 se senha atual incorreta ou nova senha inválida.
 *   - Retorna 200 em sucesso.
 *
 * Task 18.5: mensagens de sucesso/erro em pt-BR.
 */

import { NextResponse, type NextRequest } from 'next/server';
import bcrypt from 'bcryptjs';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { changePasswordSchema } from '@/lib/validators/settings';

export const runtime = 'nodejs';

const BCRYPT_COST = 10;

export const PATCH = withAuth(null, async (req: NextRequest, { session }) => {
  // ─── 1. Parse do body ─────────────────────────────────────────────
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: true, code: 'INVALID_JSON', message: 'Body inválido.' },
      { status: 400 },
    );
  }

  // ─── 2. Validação Zod ─────────────────────────────────────────────
  let parsed: ReturnType<typeof changePasswordSchema.parse>;
  try {
    parsed = changePasswordSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message:
            'A nova senha deve ter entre 8 e 128 caracteres, com pelo menos uma maiúscula, uma minúscula e um número.',
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

  const { currentPassword, newPassword } = parsed;

  // ─── 3. Buscar usuário e verificar se tem senha (não é só Google) ──
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, passwordHash: true },
  });

  if (!user || !user.passwordHash) {
    return NextResponse.json(
      {
        error: true,
        code: 'NO_PASSWORD',
        message: 'Conta vinculada apenas ao Google. Não é possível alterar a senha.',
      },
      { status: 400 },
    );
  }

  // ─── 4. Verificar senha atual ─────────────────────────────────────
  const currentPasswordMatches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!currentPasswordMatches) {
    return NextResponse.json(
      {
        error: true,
        code: 'WRONG_PASSWORD',
        message: 'Senha atual incorreta.',
      },
      { status: 400 },
    );
  }

  // ─── 5. Hash e atualiza nova senha ─────────────────────────────────
  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_COST);

  await prisma.user.update({
    where: { id: session.user.id },
    data: { passwordHash: newPasswordHash },
  });

  return NextResponse.json({ message: 'Senha alterada com sucesso!' }, { status: 200 });
});
