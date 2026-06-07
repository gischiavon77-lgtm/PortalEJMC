/**
 * API Routes — /api/users (Tasks 19.1, 19.2, 19.4, 19.9)
 *
 * GET  /api/users?status=PENDING|ACTIVE|INACTIVE  → Lista usuários por status (Admin)
 * POST /api/users                                  → Cria conta (Admin)
 *
 * Ambos os endpoints exigem permissão `user:manage` (Admin-only).
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { AccountStatus } from '@prisma/client';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { listUsersQuerySchema, createUserSchema } from '@/lib/validators/admin';

export const runtime = 'nodejs';

// ─── GET /api/users?status= ─────────────────────────────────────────────────

const handleGet = withAuth('user:manage', async (req: NextRequest) => {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  let parsed: { status?: AccountStatus };
  try {
    parsed = listUsersQuerySchema.parse(queryParams);
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

  const where: { status?: AccountStatus } = {};
  if (parsed.status) {
    where.status = parsed.status;
  }

  const users = await prisma.user.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      area: true,
      createdAt: true,
    },
  });

  const serialized = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return NextResponse.json({ users: serialized }, { status: 200 });
});

export { handleGet as GET };

// ─── POST /api/users (Task 19.4 + 19.9) ─────────────────────────────────────

const handlePost = withAuth('user:create', async (req: NextRequest) => {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: true, code: 'INVALID_JSON', message: 'Body inválido.' },
      { status: 400 },
    );
  }

  let parsed: ReturnType<typeof createUserSchema.parse>;
  try {
    parsed = createUserSchema.parse(body);
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

  // Task 19.9: Verificar email duplicado
  const existingUser = await prisma.user.findUnique({
    where: { email: parsed.email },
    select: { id: true },
  });

  if (existingUser) {
    return NextResponse.json(
      {
        error: true,
        code: 'EMAIL_TAKEN',
        message: 'Este email já está cadastrado no sistema.',
        fields: [{ path: 'email', message: 'Este email já está em uso.' }],
      },
      { status: 409 },
    );
  }

  // Cria o usuário diretamente como ACTIVE (admin cria, não precisa aprovação)
  const user = await prisma.user.create({
    data: {
      name: parsed.name,
      email: parsed.email,
      role: parsed.role,
      status: 'ACTIVE',
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      status: true,
      area: true,
      createdAt: true,
    },
  });

  return NextResponse.json(
    { user: { ...user, createdAt: user.createdAt.toISOString() } },
    { status: 201 },
  );
});

export { handlePost as POST };
