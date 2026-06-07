/**
 * API Routes — /api/users/me (Task 11.1 / Req 12.1, 12.2)
 *
 * GET  /api/users/me  → Retorna dados do usuário autenticado
 * PATCH /api/users/me → Atualiza campos editáveis (name, email, phone, cpf)
 *
 * Campos readonly (area, position, role, status) são ignorados mesmo
 * se enviados no body. A API nunca os altera.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { updateProfileSchema } from '@/lib/validators/profile';

export const runtime = 'nodejs';

// ─── GET /api/users/me ────────────────────────────────────────────────────────

export const GET = withAuth(null, async (_req, { session }) => {
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      area: true,
      position: true,
      phone: true,
      cpf: true,
      avatarUrl: true,
      status: true,
      createdAt: true,
    },
  });

  if (!user) {
    return NextResponse.json(
      { error: true, code: 'NOT_FOUND', message: 'Usuário não encontrado.' },
      { status: 404 },
    );
  }

  return NextResponse.json({ user }, { status: 200 });
});

// ─── PATCH /api/users/me ──────────────────────────────────────────────────────

export const PATCH = withAuth(null, async (req: NextRequest, { session }) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: true, code: 'INVALID_JSON', message: 'Body inválido.' },
      { status: 400 },
    );
  }

  let parsed: ReturnType<typeof updateProfileSchema.parse>;
  try {
    parsed = updateProfileSchema.parse(body);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Dados inválidos.',
          fields: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 422 },
      );
    }
    throw err;
  }

  // Remove campos undefined do objeto de update
  const data: Record<string, unknown> = {};
  if (parsed.name !== undefined) data.name = parsed.name;
  if (parsed.email !== undefined) data.email = parsed.email;
  if (parsed.phone !== undefined) data.phone = parsed.phone;
  if (parsed.cpf !== undefined) data.cpf = parsed.cpf;

  if (Object.keys(data).length === 0) {
    return NextResponse.json(
      { error: true, code: 'NO_CHANGES', message: 'Nenhum campo para atualizar.' },
      { status: 400 },
    );
  }

  // Verificar email duplicado se estiver sendo alterado
  if (data.email && data.email !== session.user.email) {
    const existing = await prisma.user.findUnique({
      where: { email: data.email as string },
      select: { id: true },
    });
    if (existing && existing.id !== session.user.id) {
      return NextResponse.json(
        {
          error: true,
          code: 'EMAIL_TAKEN',
          fields: [{ path: 'email', message: 'Este email já está em uso.' }],
        },
        { status: 409 },
      );
    }
  }

  // Verificar CPF duplicado se estiver sendo alterado
  if (data.cpf) {
    const existingCpf = await prisma.user.findFirst({
      where: {
        cpf: data.cpf as string,
        NOT: { id: session.user.id },
      },
      select: { id: true },
    });
    if (existingCpf) {
      return NextResponse.json(
        {
          error: true,
          code: 'CPF_TAKEN',
          fields: [{ path: 'cpf', message: 'Este CPF já está cadastrado.' }],
        },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      area: true,
      position: true,
      phone: true,
      cpf: true,
      avatarUrl: true,
      status: true,
    },
  });

  return NextResponse.json({ user: updated }, { status: 200 });
});
