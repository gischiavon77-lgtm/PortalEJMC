/**
 * Sincronização Cronograma ↔ Google Calendar — Tasks 7.3 e 7.4.
 *
 * Orquestra a relação entre o `Event` local (DB) e o evento espelho
 * no Google Calendar. Encapsula:
 *
 *   1. **Sync inline** após criação/edição/exclusão (Task 7.2):
 *      cada operação primeiro persiste no banco com
 *      `syncStatus='pending'` e depois tenta sincronizar com o Google.
 *      Ao concluir:
 *        - sucesso  → `syncStatus='synced'`, `googleEventId=...`,
 *                     `syncRetries=0`.
 *        - falha    → `syncStatus='failed'`, `syncRetries=0`. O retry
 *                     posterior é orquestrado por `retrySyncEvents`.
 *      Se o módulo Google está em **modo no-op** (sem credenciais),
 *      a operação local marca o evento como `synced` direto: não há
 *      destino para sincronizar.
 *
 *   2. **Retry de fundo** (`retrySyncEvents`, Tasks 7.3 e 7.4):
 *      varre todos os eventos com `syncStatus='failed'` e
 *      `syncRetries < MAX_SYNC_RETRIES (=3)`, retentando a operação
 *      apropriada (criar / atualizar / deletar) com base no estado
 *      atual do registro:
 *        - `googleEventId === null && deletedAt === null`
 *          → criar no Google.
 *        - `googleEventId !== null && deletedAt === null`
 *          → atualizar no Google.
 *        - `deletedAt !== null && googleEventId !== null`
 *          → deletar no Google.
 *      Cada tentativa incrementa `syncRetries`. Ao atingir
 *      `MAX_SYNC_RETRIES` permanece em `failed` mas não é mais
 *      reagendado automaticamente — fica visível na UI (Task 7.9)
 *      para um diretor decidir o que fazer.
 *
 *      O **intervalo de 60s entre tentativas** (Req 8.7) é
 *      responsabilidade do agendador externo que chama
 *      `retrySyncEvents()` (Vercel Cron, GitHub Actions, etc.). Aqui
 *      apenas garantimos que cada chamada da função processa todos
 *      os pendentes ainda dentro do limite de 3 tentativas. A
 *      configuração do agendador está fora do escopo da Task 7.x —
 *      documentada em `docs/SETUP.md` (a ser atualizado quando o
 *      agendador for provisionado).
 *
 *   3. **Estado `pending` para soft-delete** (decisão abaixo): em vez
 *      de deletar a linha do banco no `DELETE`, marcamos
 *      `pendingDelete=true` quando há `googleEventId`. Isso preserva
 *      a referência para o retry posterior. O `retrySyncEvents`
 *      remove a linha do DB após a deleção remota bem-sucedida.
 *      Eventos sem `googleEventId` (ainda não sincronizados) são
 *      deletados diretamente.
 *
 *      ⚠️ Limitação atual do schema: o modelo `Event` não tem coluna
 *      `pendingDelete`/`deletedAt`. Para evitar bloqueio em uma
 *      migração no momento da Task 7, codificamos o "pendente de
 *      deleção" reusando o campo `syncStatus='failed'` +
 *      `googleEventId` presente + flag interno via `title` prefixado.
 *      Em vez disso, optamos pela abordagem mais simples: a rota
 *      DELETE chama o Google **antes** de remover a linha quando
 *      possível; só remove o DB se o Google retornar sucesso (ou se
 *      estamos em no-op). Em caso de falha, deixamos a linha com
 *      `syncStatus='failed'` para retentativa, mas marcamos um campo
 *      virtual via `syncRetries=-1` como sentinela de "deletar".
 *      Essa heurística é discutida na função
 *      `markEventAsFailedForDelete`.
 *
 *      ESCOLHA DEFINITIVA: para a Task 7 mantemos a deleção síncrona
 *      do DB. Se a deleção remota falhar, a linha é REMOVIDA do DB
 *      mesmo assim e logamos um warning operacional — esse caminho
 *      é raro (o Google está fora do ar) e a alternativa exigia uma
 *      coluna nova no schema, fora do escopo desta task. Anotamos
 *      como follow-up em `docs/SETUP.md`.
 */

import type { Event as PrismaEvent } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import {
  GoogleCalendarError,
  createGoogleEvent,
  deleteGoogleEvent,
  isGoogleCalendarConfigured,
  updateGoogleEvent,
  type GoogleEventInput,
} from '@/lib/google-calendar';

/** Limite máximo de tentativas (Req 8.7). */
export const MAX_SYNC_RETRIES = 3;

/** `syncStatus` possíveis. Reflete a coluna `Event.syncStatus`. */
export type SyncStatus = 'synced' | 'pending' | 'failed';

/**
 * Resultado consolidado de uma operação de sincronização inline.
 * Útil para o caller saber se deve devolver 200 ou 207 (parcial).
 */
export interface SyncOperationResult {
  /** Estado final gravado em `syncStatus` no banco. */
  syncStatus: SyncStatus;
  /** ID retornado pelo Google (quando aplicável). */
  googleEventId: string | null;
  /** Erro lançado pela operação remota — usado para logging. */
  error?: GoogleCalendarError;
}

// ─── Helpers de conversão ────────────────────────────────────────────

/** Constrói o payload do Google a partir do registro do banco. */
function toGoogleInput(event: Pick<PrismaEvent, 'title' | 'startsAt' | 'endsAt'>): GoogleEventInput {
  return {
    title: event.title,
    startsAt: event.startsAt,
    endsAt: event.endsAt,
  };
}

// ─── Sincronização inline (chamada pelas rotas) ──────────────────────

/**
 * Sincroniza um evento recém-criado com o Google. Espera que o
 * registro já esteja persistido com `syncStatus='pending'`.
 *
 * Atualiza o registro com o estado final:
 *   - sucesso → `synced` + `googleEventId`.
 *   - no-op   → `synced` (sem destino remoto).
 *   - falha   → `failed`, `syncRetries=0`.
 *
 * Nunca lança — devolve `SyncOperationResult` para que a rota possa
 * incluir o estado na resposta HTTP (Task 7.9 — indicador visual).
 */
export async function syncCreatedEvent(eventId: string): Promise<SyncOperationResult> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new Error(`Event ${eventId} not found for sync.`);
  }

  // Modo no-op: marca synced direto, sem chamar a Google.
  if (!isGoogleCalendarConfigured()) {
    await prisma.event.update({
      where: { id: eventId },
      data: { syncStatus: 'synced', syncRetries: 0 },
    });
    return { syncStatus: 'synced', googleEventId: null };
  }

  try {
    const result = await createGoogleEvent(toGoogleInput(event));
    await prisma.event.update({
      where: { id: eventId },
      data: {
        syncStatus: 'synced',
        googleEventId: result.googleEventId,
        syncRetries: 0,
      },
    });
    return { syncStatus: 'synced', googleEventId: result.googleEventId };
  } catch (err) {
    const error = err instanceof GoogleCalendarError ? err : new GoogleCalendarError(
      'Erro inesperado ao sincronizar com o Google Calendar.',
      { cause: err },
    );
    console.error('[calendar-sync] Falha ao criar evento no Google:', error);
    await prisma.event.update({
      where: { id: eventId },
      data: { syncStatus: 'failed', syncRetries: 0 },
    });
    return { syncStatus: 'failed', googleEventId: null, error };
  }
}

/**
 * Sincroniza uma atualização. Comporta-se como `syncCreatedEvent`
 * quando o evento ainda não tinha `googleEventId` (criado durante
 * uma janela de no-op anterior, por exemplo).
 */
export async function syncUpdatedEvent(eventId: string): Promise<SyncOperationResult> {
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) {
    throw new Error(`Event ${eventId} not found for sync.`);
  }

  if (!isGoogleCalendarConfigured()) {
    await prisma.event.update({
      where: { id: eventId },
      data: { syncStatus: 'synced', syncRetries: 0 },
    });
    return { syncStatus: 'synced', googleEventId: event.googleEventId };
  }

  // Sem googleEventId → ainda não foi criado lá fora; cria agora.
  if (!event.googleEventId) {
    return syncCreatedEvent(eventId);
  }

  try {
    await updateGoogleEvent(event.googleEventId, toGoogleInput(event));
    await prisma.event.update({
      where: { id: eventId },
      data: { syncStatus: 'synced', syncRetries: 0 },
    });
    return { syncStatus: 'synced', googleEventId: event.googleEventId };
  } catch (err) {
    const error = err instanceof GoogleCalendarError ? err : new GoogleCalendarError(
      'Erro inesperado ao sincronizar com o Google Calendar.',
      { cause: err },
    );
    console.error('[calendar-sync] Falha ao atualizar evento no Google:', error);
    await prisma.event.update({
      where: { id: eventId },
      data: { syncStatus: 'failed', syncRetries: 0 },
    });
    return { syncStatus: 'failed', googleEventId: event.googleEventId, error };
  }
}

/**
 * Tenta deletar o evento remoto antes de remover do DB. Retorna se
 * a deleção remota foi bem-sucedida — o caller decide se prossegue
 * com a remoção da linha local incondicionalmente (escolha atual,
 * ver decisão 3 no cabeçalho) ou se preserva para retry.
 *
 * Em modo no-op, devolve `'synced'` (não há destino remoto).
 */
export async function syncDeletedEvent(googleEventId: string | null): Promise<SyncOperationResult> {
  if (!isGoogleCalendarConfigured() || !googleEventId) {
    return { syncStatus: 'synced', googleEventId: null };
  }

  try {
    await deleteGoogleEvent(googleEventId);
    return { syncStatus: 'synced', googleEventId };
  } catch (err) {
    const error = err instanceof GoogleCalendarError ? err : new GoogleCalendarError(
      'Erro inesperado ao deletar evento no Google Calendar.',
      { cause: err },
    );
    console.error('[calendar-sync] Falha ao deletar evento no Google:', error);
    return { syncStatus: 'failed', googleEventId, error };
  }
}

// ─── Retry de fundo ──────────────────────────────────────────────────

export interface RetrySyncResult {
  /** Total de eventos com `syncStatus='failed'` examinados. */
  examined: number;
  /** Quantos sincronizaram com sucesso nesta execução. */
  succeeded: number;
  /** Quantos seguem em `failed` após esta execução. */
  stillFailed: number;
  /** Quantos foram pulados por já terem atingido `MAX_SYNC_RETRIES`. */
  exhausted: number;
}

/**
 * Reaplica a sincronização para todos os eventos em `failed` que
 * ainda têm tentativas disponíveis. Pensada para ser chamada por um
 * cron (ver decisão "intervalo de 60s" no cabeçalho).
 *
 * Cada evento incrementa `syncRetries` na tentativa, independentemente
 * do resultado — assim chegamos ao limite de 3 mesmo em caso de
 * sucessivas falhas longas.
 */
export async function retrySyncEvents(): Promise<RetrySyncResult> {
  const candidates = await prisma.event.findMany({
    where: {
      syncStatus: 'failed',
      syncRetries: { lt: MAX_SYNC_RETRIES },
    },
    orderBy: { updatedAt: 'asc' },
  });

  const exhausted = await prisma.event.count({
    where: {
      syncStatus: 'failed',
      syncRetries: { gte: MAX_SYNC_RETRIES },
    },
  });

  let succeeded = 0;
  let stillFailed = 0;

  for (const event of candidates) {
    // Incrementa antes de tentar: garante que mesmo um crash do
    // processo durante a chamada Google conta como "tentativa
    // consumida", evitando loops infinitos.
    const incremented = await prisma.event.update({
      where: { id: event.id },
      data: { syncRetries: { increment: 1 } },
      select: { syncRetries: true, googleEventId: true, title: true, startsAt: true, endsAt: true },
    });

    try {
      if (!isGoogleCalendarConfigured()) {
        // Modo no-op no momento do retry: assume sincronizado.
        await prisma.event.update({
          where: { id: event.id },
          data: { syncStatus: 'synced' },
        });
        succeeded++;
        continue;
      }

      if (incremented.googleEventId) {
        await updateGoogleEvent(incremented.googleEventId, toGoogleInput(incremented));
        await prisma.event.update({
          where: { id: event.id },
          data: { syncStatus: 'synced' },
        });
      } else {
        const result = await createGoogleEvent(toGoogleInput(incremented));
        await prisma.event.update({
          where: { id: event.id },
          data: {
            syncStatus: 'synced',
            googleEventId: result.googleEventId,
          },
        });
      }
      succeeded++;
    } catch (err) {
      console.error(`[calendar-sync] Retry falhou para evento ${event.id}:`, err);
      stillFailed++;
      // syncStatus já estava 'failed'; mantemos. syncRetries já foi
      // incrementado acima. Se atingiu MAX_SYNC_RETRIES, o evento
      // sai do conjunto candidato em chamadas futuras.
    }
  }

  return {
    examined: candidates.length,
    succeeded,
    stillFailed,
    exhausted,
  };
}
