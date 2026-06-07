/**
 * API Routes — /api/users/:id (Tasks 19.1, 19.3, 19.5, 19.6, 19.7)
 *
 * PATCH  /api/users/:id → Aprovar, rejeitar, ou alterar papel
 * DELETE /api/users/:id → Desativar conta (soft-delete: status→INACTIVE)
 *
 * Ambos exigem permissão `user:manage` (Admin-only).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { ZodError } from 'zod';

import { withAuth, type AuthHandlerContext } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { updateUserActionSchema } from '@/lib/validators/admin';
import { sendAccountApprovedEmail, sendAccountRejectedEmail } from '@/lib/email';

export const runtime = 'nodejs';

interface RouteParams {
  id: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Task 19.7: Verifica se o usuário-alvo é o último admin ativo.
 * Retorna `true` se a operação deve ser bloqueada.
 */
async function isLastActiveAdmin(userId: string): Promise<boolean> {
  const activeAdminCount = await prisma.user.count({
    where: {
      role: 'ADMIN',
      status: 'ACTIVE',
    },
  });
  if (activeAdminCount <= 1) {
    // Verificar se o alvo é um dos admins ativos
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, status: true },
    });
    if (targetUser?.role === 'ADMIN' && targetUser?.status === 'ACTIVE') {
      return true;
    }
  }
  return false;
}

// ─── PATCH /api/users/:id (Tasks 19.3, 19.5, 19.7) ──────────────────────────

const handlePatch = withAuth(
  'user:manage',
  async (req: NextRequest, { params }: AuthHandlerContext<Promise<RouteParams>>) => {
    const resolvedParams = await params;
    const userId = resolvedParams?.id;

    if (!userId) {
      return NextResponse.json(
        { error: true, code: 'BAD_REQUEST', message: 'ID do usuário é obrigatório.' },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: true, code: 'INVALID_JSON', message: 'Body inválido.' },
        { status: 400 },
      );
    }

    let parsed: ReturnType<typeof updateUserActionSchema.parse>;
    try {
      parsed = updateUserActionSchema.parse(body);
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

    // Buscar o usuário alvo
    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, email: true, role: true, status: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: true, code: 'NOT_FOUND', message: 'Usuário não encontrado.' },
        { status: 404 },
      );
    }

    // ─── Action: approve ────────────────────────────────────────────────
    if (parsed.action === 'approve') {
      if (targetUser.status !== 'PENDING') {
        return NextResponse.json(
          {
            error: true,
            code: 'INVALID_STATE',
            message: 'Apenas contas pendentes podem ser aprovadas.',
          },
          { status: 400 },
        );
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { status: 'ACTIVE' },
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

      // Task 19.3: Enviar email de aprovação (fire-and-forget)
      sendAccountApprovedEmail({ to: targetUser.email, name: targetUser.name }).catch((err) => {
        console.error('[admin] Falha ao enviar email de aprovação:', err);
      });

      return NextResponse.json(
        { user: { ...updated, createdAt: updated.createdAt.toISOString() } },
        { status: 200 },
      );
    }

    // ─── Action: reject ─────────────────────────────────────────────────
    if (parsed.action === 'reject') {
      if (targetUser.status !== 'PENDING') {
        return NextResponse.json(
          {
            error: true,
            code: 'INVALID_STATE',
            message: 'Apenas contas pendentes podem ser rejeitadas.',
          },
          { status: 400 },
        );
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { status: 'REJECTED' },
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

      // Task 19.3: Enviar email de rejeição (fire-and-forget)
      sendAccountRejectedEmail({ to: targetUser.email, name: targetUser.name }).catch((err) => {
        console.error('[admin] Falha ao enviar email de rejeição:', err);
      });

      return NextResponse.json(
        { user: { ...updated, createdAt: updated.createdAt.toISOString() } },
        { status: 200 },
      );
    }

    // ─── Action: changeRole (Task 19.5) ────────────────────────────────
    if (parsed.action === 'changeRole') {
      if (!parsed.role) {
        return NextResponse.json(
          {
            error: true,
            code: 'VALIDATION_ERROR',
            message: 'O campo "role" é obrigatório para a ação changeRole.',
          },
          { status: 422 },
        );
      }

      // Task 19.7: Proteger último administrador
      if (targetUser.role === 'ADMIN' && parsed.role !== 'ADMIN') {
        const blocked = await isLastActiveAdmin(userId);
        if (blocked) {
          return NextResponse.json(
            {
              error: true,
              code: 'LAST_ADMIN',
              message: 'O sistema requer ao menos um administrador ativo.',
            },
            { status: 403 },
          );
        }
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: { role: parsed.role },
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
        { user: { ...updated, createdAt: updated.createdAt.toISOString() } },
        { status: 200 },
      );
    }

    return NextResponse.json(
      { error: true, code: 'BAD_REQUEST', message: 'Ação desconhecida.' },
      { status: 400 },
    );
  },
);

export { handlePatch as PATCH };

// ─── DELETE /api/users/:id (Tasks 19.6, 19.7) ────────────────────────────────

const handleDelete = withAuth(
  'user:manage',
  async (req: NextRequest, { params }: AuthHandlerContext<Promise<RouteParams>>) => {
    const resolvedParams = await params;
    const userId = resolvedParams?.id;

    if (!userId) {
      return NextResponse.json(
        { error: true, code: 'BAD_REQUEST', message: 'ID do usuário é obrigatório.' },
        { status: 400 },
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, status: true },
    });

    if (!targetUser) {
      return NextResponse.json(
        { error: true, code: 'NOT_FOUND', message: 'Usuário não encontrado.' },
        { status: 404 },
      );
    }

    if (targetUser.status === 'INACTIVE') {
      return NextResponse.json(
        { error: true, code: 'ALREADY_INACTIVE', message: 'Esta conta já está inativa.' },
        { status: 400 },
      );
    }

    // Task 19.7: Proteger último administrador
    if (targetUser.role === 'ADMIN') {
      const blocked = await isLastActiveAdmin(userId);
      if (blocked) {
        return NextResponse.json(
          {
            error: true,
            code: 'LAST_ADMIN',
            message: 'O sistema requer ao menos um administrador ativo.',
          },
          { status: 403 },
        );
      }
    }

    // Task 19.6: Desativar conta (soft-delete)
    const updated = await prisma.user.update({
      where: { id: userId },
      data: { status: 'INACTIVE' },
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
      { user: { ...updated, createdAt: updated.createdAt.toISOString() } },
      { status: 200 },
    );
  },
);

export { handleDelete as DELETE };
