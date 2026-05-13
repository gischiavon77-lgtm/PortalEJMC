/**
 * `POST /api/calendar/sync` — disparo manual do retry de sincronização
 * (Tasks 7.3 / 7.4).
 *
 * Endpoint utilitário para que um administrador (ou um agendador
 * externo — Vercel Cron / GitHub Actions) reaplique a sincronização
 * dos eventos com `syncStatus='failed'`. A regra "3 tentativas com
 * intervalo de 60s" do Req 8.7 é responsabilidade do agendador que
 * chama esta rota — ver decisão "intervalo de 60s" no cabeçalho de
 * `calendar-sync.ts`.
 *
 * Permissão: `calendar:update` (mesmas permissões da edição). Em vez
 * de criar uma ação RBAC nova ("calendar:sync"), reutilizamos a
 * existente — quem pode editar eventos pode disparar uma reconciliação.
 *
 * Resposta:
 *   200 { examined, succeeded, stillFailed, exhausted }
 *
 *   - `examined`    : eventos elegíveis (failed + retries < 3).
 *   - `succeeded`   : sucesso nesta passada.
 *   - `stillFailed` : continuam em failed após esta passada.
 *   - `exhausted`   : eventos que já estavam com `syncRetries >= 3`
 *                     antes desta passada (não foram retentados).
 */

import { NextResponse, type NextRequest } from 'next/server';

import { withAuth } from '@/lib/api-auth';
import { retrySyncEvents } from '@/lib/calendar-sync';

export const runtime = 'nodejs';

async function handler(_req: NextRequest): Promise<Response> {
  const result = await retrySyncEvents();
  return NextResponse.json(result, { status: 200 });
}

export const POST = withAuth('calendar:update', handler);
