/**
 * Testes do módulo `src/lib/calendar-sync.ts` — Tasks 7.3 / 7.4.
 *
 * Cobre o orquestrador entre a tabela `Event` e o Google Calendar:
 *   - `syncCreatedEvent` em modo no-op → marca synced sem chamar Google.
 *   - `syncCreatedEvent` em modo live com sucesso → grava googleEventId
 *     e syncStatus='synced'.
 *   - `syncCreatedEvent` em modo live com falha → mantém syncStatus='failed',
 *     syncRetries=0, devolve erro.
 *   - `retrySyncEvents` → busca candidatos failed, incrementa
 *     syncRetries, marca synced em sucesso e ignora candidatos com
 *     retries esgotados.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mocks ───────────────────────────────────────────────────────────

const {
  createGoogleEventMock,
  updateGoogleEventMock,
  deleteGoogleEventMock,
  isGoogleCalendarConfiguredMock,
  GoogleCalendarErrorClass,
} = vi.hoisted(() => {
  class GoogleCalendarErrorClass extends Error {
    readonly code = 'GOOGLE_CALENDAR_ERROR' as const;
    status: number | undefined;
    constructor(message: string, opts?: { cause?: unknown; status?: number }) {
      super(message);
      this.name = 'GoogleCalendarError';
      this.status = opts?.status;
    }
  }
  return {
    createGoogleEventMock: vi.fn(),
    updateGoogleEventMock: vi.fn(),
    deleteGoogleEventMock: vi.fn(),
    isGoogleCalendarConfiguredMock: vi.fn(),
    GoogleCalendarErrorClass,
  };
});

vi.mock('@/lib/google-calendar', () => ({
  GoogleCalendarError: GoogleCalendarErrorClass,
  createGoogleEvent: (...args: unknown[]) => createGoogleEventMock(...args),
  updateGoogleEvent: (...args: unknown[]) => updateGoogleEventMock(...args),
  deleteGoogleEvent: (...args: unknown[]) => deleteGoogleEventMock(...args),
  isGoogleCalendarConfigured: () => isGoogleCalendarConfiguredMock(),
}));

const {
  findUniqueMock,
  findUniqueOrThrowMock,
  findManyMock,
  countMock,
  updateMock,
} = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  findUniqueOrThrowMock: vi.fn(),
  findManyMock: vi.fn(),
  countMock: vi.fn(),
  updateMock: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      findUniqueOrThrow: (...args: unknown[]) => findUniqueOrThrowMock(...args),
      findMany: (...args: unknown[]) => findManyMock(...args),
      count: (...args: unknown[]) => countMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

import {
  MAX_SYNC_RETRIES,
  retrySyncEvents,
  syncCreatedEvent,
  syncDeletedEvent,
  syncUpdatedEvent,
} from '@/lib/calendar-sync';

const dbEvent = {
  id: 'evt-1',
  title: 'Reunião',
  startsAt: new Date('2025-06-10T14:00:00.000Z'),
  endsAt: new Date('2025-06-10T15:00:00.000Z'),
  googleEventId: null as string | null,
  syncStatus: 'pending',
  syncRetries: 0,
  createdById: 'u-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => {
  createGoogleEventMock.mockReset();
  updateGoogleEventMock.mockReset();
  deleteGoogleEventMock.mockReset();
  isGoogleCalendarConfiguredMock.mockReset();
  findUniqueMock.mockReset();
  findUniqueOrThrowMock.mockReset();
  findManyMock.mockReset();
  countMock.mockReset();
  updateMock.mockReset();
});

// ─── syncCreatedEvent ────────────────────────────────────────────────

describe('syncCreatedEvent', () => {
  it('em modo no-op marca synced sem chamar Google', async () => {
    isGoogleCalendarConfiguredMock.mockReturnValue(false);
    findUniqueMock.mockResolvedValueOnce({ ...dbEvent });

    const result = await syncCreatedEvent('evt-1');

    expect(result).toEqual({ syncStatus: 'synced', googleEventId: null });
    expect(createGoogleEventMock).not.toHaveBeenCalled();
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: { syncStatus: 'synced', syncRetries: 0 },
    });
  });

  it('em modo live com sucesso grava googleEventId e marca synced', async () => {
    isGoogleCalendarConfiguredMock.mockReturnValue(true);
    findUniqueMock.mockResolvedValueOnce({ ...dbEvent });
    createGoogleEventMock.mockResolvedValueOnce({
      googleEventId: 'gcal-1',
      mode: 'live',
    });

    const result = await syncCreatedEvent('evt-1');

    expect(result).toEqual({ syncStatus: 'synced', googleEventId: 'gcal-1' });
    expect(createGoogleEventMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: {
        syncStatus: 'synced',
        googleEventId: 'gcal-1',
        syncRetries: 0,
      },
    });
  });

  it('em modo live com falha marca syncStatus=failed e devolve erro', async () => {
    isGoogleCalendarConfiguredMock.mockReturnValue(true);
    findUniqueMock.mockResolvedValueOnce({ ...dbEvent });
    const err = new GoogleCalendarErrorClass('boom');
    createGoogleEventMock.mockRejectedValueOnce(err);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await syncCreatedEvent('evt-1');

    expect(result.syncStatus).toBe('failed');
    expect(result.googleEventId).toBeNull();
    expect(result.error).toBe(err);
    expect(updateMock).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: { syncStatus: 'failed', syncRetries: 0 },
    });
  });
});

// ─── syncUpdatedEvent ────────────────────────────────────────────────

describe('syncUpdatedEvent', () => {
  it('quando o evento ainda não tem googleEventId, delega para create', async () => {
    isGoogleCalendarConfiguredMock.mockReturnValue(true);
    findUniqueMock
      .mockResolvedValueOnce({ ...dbEvent, googleEventId: null }) // primeira chamada (sync update)
      .mockResolvedValueOnce({ ...dbEvent, googleEventId: null }); // chamada interna do syncCreatedEvent
    createGoogleEventMock.mockResolvedValueOnce({
      googleEventId: 'gcal-new',
      mode: 'live',
    });

    const result = await syncUpdatedEvent('evt-1');

    expect(createGoogleEventMock).toHaveBeenCalledTimes(1);
    expect(updateGoogleEventMock).not.toHaveBeenCalled();
    expect(result.googleEventId).toBe('gcal-new');
  });

  it('com googleEventId existente delega para update', async () => {
    isGoogleCalendarConfiguredMock.mockReturnValue(true);
    findUniqueMock.mockResolvedValueOnce({ ...dbEvent, googleEventId: 'gcal-1' });

    const result = await syncUpdatedEvent('evt-1');

    expect(updateGoogleEventMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ syncStatus: 'synced', googleEventId: 'gcal-1' });
  });
});

// ─── syncDeletedEvent ────────────────────────────────────────────────

describe('syncDeletedEvent', () => {
  it('em modo no-op resolve synced sem chamar Google', async () => {
    isGoogleCalendarConfiguredMock.mockReturnValue(false);
    const result = await syncDeletedEvent('gcal-1');
    expect(result).toEqual({ syncStatus: 'synced', googleEventId: null });
    expect(deleteGoogleEventMock).not.toHaveBeenCalled();
  });

  it('sem googleEventId resolve synced sem chamar Google', async () => {
    isGoogleCalendarConfiguredMock.mockReturnValue(true);
    const result = await syncDeletedEvent(null);
    expect(result).toEqual({ syncStatus: 'synced', googleEventId: null });
    expect(deleteGoogleEventMock).not.toHaveBeenCalled();
  });

  it('em modo live delega para deleteGoogleEvent', async () => {
    isGoogleCalendarConfiguredMock.mockReturnValue(true);
    deleteGoogleEventMock.mockResolvedValueOnce(undefined);

    const result = await syncDeletedEvent('gcal-1');

    expect(deleteGoogleEventMock).toHaveBeenCalledWith('gcal-1');
    expect(result).toEqual({ syncStatus: 'synced', googleEventId: 'gcal-1' });
  });

  it('falha de delete devolve syncStatus=failed sem lançar', async () => {
    isGoogleCalendarConfiguredMock.mockReturnValue(true);
    const err = new GoogleCalendarErrorClass('boom');
    deleteGoogleEventMock.mockRejectedValueOnce(err);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await syncDeletedEvent('gcal-1');

    expect(result.syncStatus).toBe('failed');
    expect(result.error).toBe(err);
  });
});

// ─── retrySyncEvents ─────────────────────────────────────────────────

describe('retrySyncEvents', () => {
  it('processa candidatos failed: incrementa syncRetries e marca synced em sucesso', async () => {
    isGoogleCalendarConfiguredMock.mockReturnValue(true);

    const candidate = {
      ...dbEvent,
      id: 'evt-2',
      googleEventId: null,
      syncStatus: 'failed' as const,
      syncRetries: 0,
    };

    findManyMock.mockResolvedValueOnce([candidate]);
    countMock.mockResolvedValueOnce(0);
    // primeira update: increment syncRetries (retorna campos selecionados).
    updateMock
      .mockResolvedValueOnce({
        syncRetries: 1,
        googleEventId: null,
        title: candidate.title,
        startsAt: candidate.startsAt,
        endsAt: candidate.endsAt,
      })
      // segunda update: marca synced + googleEventId.
      .mockResolvedValueOnce({});

    createGoogleEventMock.mockResolvedValueOnce({
      googleEventId: 'gcal-final',
      mode: 'live',
    });

    const result = await retrySyncEvents();

    expect(result).toEqual({
      examined: 1,
      succeeded: 1,
      stillFailed: 0,
      exhausted: 0,
    });
    expect(createGoogleEventMock).toHaveBeenCalledTimes(1);

    // Confirmação do incremento.
    expect(updateMock.mock.calls[0]?.[0]).toMatchObject({
      where: { id: 'evt-2' },
      data: { syncRetries: { increment: 1 } },
    });
    // Confirmação do mark synced.
    expect(updateMock.mock.calls[1]?.[0]).toMatchObject({
      where: { id: 'evt-2' },
      data: {
        syncStatus: 'synced',
        googleEventId: 'gcal-final',
      },
    });
  });

  it('mantém failed quando a chamada Google falha de novo', async () => {
    isGoogleCalendarConfiguredMock.mockReturnValue(true);

    const candidate = {
      ...dbEvent,
      id: 'evt-3',
      googleEventId: 'gcal-existing',
      syncStatus: 'failed' as const,
      syncRetries: 1,
    };

    findManyMock.mockResolvedValueOnce([candidate]);
    countMock.mockResolvedValueOnce(0);
    updateMock.mockResolvedValueOnce({
      syncRetries: 2,
      googleEventId: 'gcal-existing',
      title: candidate.title,
      startsAt: candidate.startsAt,
      endsAt: candidate.endsAt,
    });
    updateGoogleEventMock.mockRejectedValueOnce(new GoogleCalendarErrorClass('still down'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await retrySyncEvents();

    expect(result).toEqual({
      examined: 1,
      succeeded: 0,
      stillFailed: 1,
      exhausted: 0,
    });
    // Apenas o increment foi chamado; o "mark synced" não foi.
    expect(updateMock).toHaveBeenCalledTimes(1);
  });

  it('reporta `exhausted` para candidatos com syncRetries >= MAX_SYNC_RETRIES', async () => {
    isGoogleCalendarConfiguredMock.mockReturnValue(true);
    findManyMock.mockResolvedValueOnce([]);
    countMock.mockResolvedValueOnce(2);

    const result = await retrySyncEvents();

    expect(result).toEqual({
      examined: 0,
      succeeded: 0,
      stillFailed: 0,
      exhausted: 2,
    });
    // Nenhuma chamada Google é feita quando não há candidatos.
    expect(createGoogleEventMock).not.toHaveBeenCalled();
    expect(updateGoogleEventMock).not.toHaveBeenCalled();
  });

  it('expõe MAX_SYNC_RETRIES = 3 (Req 8.7)', () => {
    expect(MAX_SYNC_RETRIES).toBe(3);
  });
});
