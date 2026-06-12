/**
 * `DELETE /api/highlights/:slot` — Remove um destaque por slot.
 *
 * Apenas Admin/Diretor (via `album:manage`).
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

interface SlotRouteParams {
  slot: string;
}

// ─── DELETE ──────────────────────────────────────────────────────────

async function deleteHandler(
  _req: NextRequest,
  ctx: { session: import('next-auth').Session; params?: SlotRouteParams },
): Promise<Response> {
  const slot = ctx.params?.slot;

  if (!slot || !VALID_SLOTS.includes(slot as Slot)) {
    return NextResponse.json(
      { error: true, code: 'VALIDATION_ERROR', message: 'Slot inválido.' },
      { status: 400 },
    );
  }

  const existing = await prisma.highlight.findUnique({ where: { slot } });
  if (!existing) {
    return NextResponse.json(
      { error: true, code: 'NOT_FOUND', message: 'Destaque não encontrado.' },
      { status: 404 },
    );
  }

  await prisma.highlight.delete({ where: { slot } });

  return NextResponse.json({ success: true }, { status: 200 });
}

export const DELETE = withAuth<SlotRouteParams>('album:manage', deleteHandler);
