/**
 * `GET /api/dashboard/activities` — Atividades do mês corrente
 * (Task 6.2 / Req 7.7, 7.8).
 *
 * Resposta: até 10 itens em ordem cronológica decrescente (mais
 * recente primeiro), unindo eventos do cronograma, comunicados,
 * mudanças de status de projetos e atualizações de progresso de
 * metas — ver `getDashboardActivities` em `@/lib/dashboard`.
 *
 * Cada item tem o shape:
 *
 *   { id, type, title, detail, timestamp }
 *
 * Quando o helper falha ou não há dados, devolvemos uma lista vazia
 * com status 200 — Req 7.8 ("lista vazia para atividades quando os
 * dados estiverem indisponíveis") + Task 6.5.
 *
 * ─── Autorização ────────────────────────────────────────────────────
 * `withAuth(null, ...)` — qualquer usuário autenticado pode ler.
 *
 * ─── Runtime ────────────────────────────────────────────────────────
 * Node.js (Prisma).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { getDashboardActivities, type DashboardActivity } from '@/lib/dashboard';

export const runtime = 'nodejs';

async function handler(_req: NextRequest): Promise<Response> {
  try {
    const activities = await getDashboardActivities();
    return NextResponse.json<DashboardActivity[]>(activities, { status: 200 });
  } catch (err) {
    console.error('[api/dashboard/activities] Falha ao carregar atividades:', err);
    return NextResponse.json<DashboardActivity[]>([], { status: 200 });
  }
}

export const GET = withAuth(null, handler);
