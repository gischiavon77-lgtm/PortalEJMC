/**
 * `GET /api/dashboard` — Indicadores principais do Dashboard Geral
 * (Task 6.1 / Req 7.1–7.6, 7.8).
 *
 * Resposta: ver `DashboardSummary` em `@/lib/dashboard`. Os 6 campos
 * retornados são:
 *
 *   - activeMembers       (Req 7.1)
 *   - projectsInProgress  (Req 7.2)
 *   - projectsFrozen      (Req 7.3)
 *   - monthlyRevenue      (Req 7.4)
 *   - revenueGoal         (Req 7.5)
 *   - monthlyLeads        (Req 7.6)
 *
 * Quando uma fonte está indisponível (KPI sem cadastro, falha pontual
 * de banco), o helper devolve 0 no campo afetado — o endpoint
 * preserva esse contrato para que o cliente sempre receba o shape
 * completo (Req 7.8 / Task 6.5). Por isso a função sempre responde
 * 200 com o shape esperado, exceto em casos de falha catastrófica
 * (ex.: o helper inteiro lançou) — nesse cenário devolvemos 200 +
 * zeros para manter o "fail-soft" da página.
 *
 * ─── Autorização ────────────────────────────────────────────────────
 * `withAuth(null, ...)` — qualquer usuário autenticado pode ler.
 * Não há ação RBAC restrita; o conteúdo do dashboard é visível a
 * todos os papéis (Req 7 não menciona restrição por papel).
 *
 * ─── Runtime ────────────────────────────────────────────────────────
 * Node.js (Prisma + adapter `pg` não rodam em Edge — mesmo padrão das
 * demais rotas do portal).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { getDashboardSummary, type DashboardSummary } from '@/lib/dashboard';

export const runtime = 'nodejs';

/**
 * Shape de fallback usado quando o helper lança uma exceção não
 * tratada — mantém o contrato de "sempre responder com o shape
 * completo" exigido pelo Req 7.8.
 */
const SUMMARY_FALLBACK: DashboardSummary = {
  activeMembers: 0,
  projectsInProgress: 0,
  projectsFrozen: 0,
  monthlyRevenue: 0,
  revenueGoal: 0,
  monthlyLeads: 0,
};

async function handler(_req: NextRequest): Promise<Response> {
  try {
    const summary = await getDashboardSummary();
    return NextResponse.json(summary, { status: 200 });
  } catch (err) {
    console.error('[api/dashboard] Falha ao carregar indicadores:', err);
    return NextResponse.json(SUMMARY_FALLBACK, { status: 200 });
  }
}

export const GET = withAuth(null, handler);
