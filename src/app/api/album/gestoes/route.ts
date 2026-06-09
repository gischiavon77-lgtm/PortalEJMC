/**
 * `GET /api/album/gestoes` — lista todas as gestões distintas do álbum.
 *
 * Retorna um array de strings ordenado decrescente (mais recente primeiro).
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';

async function handler(
  _req: NextRequest,
  _ctx: { session: import('next-auth').Session },
): Promise<Response> {
  const results = await prisma.albumMember.findMany({
    select: { gestao: true },
    distinct: ['gestao'],
    orderBy: { gestao: 'desc' },
  });

  const gestoes = results.map((r) => r.gestao);

  return NextResponse.json({ gestoes }, { status: 200 });
}

export const GET = withAuth(null, handler);
