/**
 * Testes do módulo `src/lib/google-calendar.ts` — Task 7.1.
 *
 * Foco:
 *   - Modo no-op quando `GOOGLE_CALENDAR_ID` está ausente: as
 *     operações resolvem sem chamar a Google.
 *   - Em modo configurado, cada operação delega ao client real
 *     (`google.calendar('v3').events.{insert,update,delete,list}`).
 *   - Retry inline: erros transitórios (5xx) são retentados; erros
 *     4xx não-retriáveis (404/403/400) param imediatamente; o caller
 *     recebe `GoogleCalendarError`.
 *
 * Estratégia:
 *   - Mockamos o pacote `googleapis` substituindo `google.calendar` e
 *     `google.auth.GoogleAuth` para evitar qualquer chamada de rede.
 *   - Mockamos `setTimeout` via `vi.useFakeTimers()` para que o
 *     backoff inline (200ms / 1s) não bloqueie o teste.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ─── Mock do pacote googleapis ───────────────────────────────────────
const { insertMock, updateMock, deleteMock, listMock, calendarFactoryMock, googleAuthMock } =
  vi.hoisted(() => ({
    insertMock: vi.fn(),
    updateMock: vi.fn(),
    deleteMock: vi.fn(),
    listMock: vi.fn(),
    calendarFactoryMock: vi.fn(),
    googleAuthMock: vi.fn(),
  }));

vi.mock('googleapis', () => {
  // Cada `google.calendar()` retorna o mesmo objeto com nossos mocks.
  calendarFactoryMock.mockImplementation(() => ({
    events: {
      insert: insertMock,
      update: updateMock,
      delete: deleteMock,
      list: listMock,
    },
  }));

  return {
    google: {
      calendar: calendarFactoryMock,
      auth: {
        GoogleAuth: class FakeGoogleAuth {
          constructor(opts: unknown) {
            googleAuthMock(opts);
          }
        },
      },
    },
  };
});

// Imports após os mocks.
import {
  GoogleCalendarError,
  __resetGoogleCalendarClientForTests,
  createGoogleEvent,
  deleteGoogleEvent,
  isGoogleCalendarConfigured,
  listGoogleEvents,
  updateGoogleEvent,
} from '@/lib/google-calendar';

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  insertMock.mockReset();
  updateMock.mockReset();
  deleteMock.mockReset();
  listMock.mockReset();
  calendarFactoryMock.mockClear();
  googleAuthMock.mockReset();

  __resetGoogleCalendarClientForTests();
  delete process.env.GOOGLE_CALENDAR_ID;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;

  // Acelera o backoff inline: substituímos `setTimeout` por execução
  // imediata. Isso mantém os testes rápidos mas ainda exercita a
  // estrutura do retry. Não usamos `vi.useFakeTimers()` porque os
  // mocks da Google API são `await`able e os fake timers podem
  // interagir mal com microtasks aninhados.
  vi.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
    cb();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof global.setTimeout);
});

afterEach(() => {
  vi.restoreAllMocks();
  process.env = { ...ORIGINAL_ENV };
});

const validInput = {
  title: 'Reunião geral',
  startsAt: new Date('2025-06-10T14:00:00.000Z'),
  endsAt: new Date('2025-06-10T15:30:00.000Z'),
};

// ─── Modo no-op ──────────────────────────────────────────────────────

describe('modo no-op (sem credenciais)', () => {
  it('isGoogleCalendarConfigured retorna false quando faltam variáveis', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(isGoogleCalendarConfigured()).toBe(false);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it('createGoogleEvent retorna { mode: "noop", googleEventId: null } sem chamar a Google', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await createGoogleEvent(validInput);

    expect(result).toEqual({ mode: 'noop', googleEventId: null });
    expect(insertMock).not.toHaveBeenCalled();
    expect(calendarFactoryMock).not.toHaveBeenCalled();
  });

  it('updateGoogleEvent / deleteGoogleEvent são no-op silenciosos', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(updateGoogleEvent('abc', validInput)).resolves.toBeUndefined();
    await expect(deleteGoogleEvent('abc')).resolves.toBeUndefined();

    expect(updateMock).not.toHaveBeenCalled();
    expect(deleteMock).not.toHaveBeenCalled();
  });

  it('listGoogleEvents retorna [] sem chamar a Google', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    await expect(
      listGoogleEvents(new Date('2025-01-01'), new Date('2025-02-01')),
    ).resolves.toEqual([]);
    expect(listMock).not.toHaveBeenCalled();
  });
});

// ─── Modo live ───────────────────────────────────────────────────────

describe('modo live (com credenciais)', () => {
  beforeEach(() => {
    process.env.GOOGLE_CALENDAR_ID = 'cal-123';
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      client_email: 'svc@x.iam.gserviceaccount.com',
      private_key: 'fake-key',
    });
    __resetGoogleCalendarClientForTests();
  });

  it('createGoogleEvent delega para events.insert e devolve o id retornado', async () => {
    insertMock.mockResolvedValueOnce({ data: { id: 'gcal-evt-1' } });

    const result = await createGoogleEvent(validInput);

    expect(result).toEqual({ mode: 'live', googleEventId: 'gcal-evt-1' });
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(insertMock).toHaveBeenCalledWith({
      calendarId: 'cal-123',
      requestBody: {
        summary: 'Reunião geral',
        description: undefined,
        start: { dateTime: '2025-06-10T14:00:00.000Z' },
        end: { dateTime: '2025-06-10T15:30:00.000Z' },
      },
    });
  });

  it('updateGoogleEvent delega para events.update', async () => {
    updateMock.mockResolvedValueOnce({ data: { id: 'gcal-evt-1' } });

    await updateGoogleEvent('gcal-evt-1', {
      ...validInput,
      title: 'Reunião geral (editada)',
    });

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith({
      calendarId: 'cal-123',
      eventId: 'gcal-evt-1',
      requestBody: expect.objectContaining({
        summary: 'Reunião geral (editada)',
      }),
    });
  });

  it('deleteGoogleEvent delega para events.delete', async () => {
    deleteMock.mockResolvedValueOnce({});

    await deleteGoogleEvent('gcal-evt-1');

    expect(deleteMock).toHaveBeenCalledTimes(1);
    expect(deleteMock).toHaveBeenCalledWith({
      calendarId: 'cal-123',
      eventId: 'gcal-evt-1',
    });
  });

  it('deleteGoogleEvent absorve 404 (idempotente)', async () => {
    // Simula 3 chamadas que falham com 404 (fora do range retriável,
    // mas tratado como sucesso no delete).
    const notFoundErr = Object.assign(new Error('not found'), { code: 404 });
    deleteMock.mockRejectedValueOnce(notFoundErr);

    await expect(deleteGoogleEvent('gcal-evt-missing')).resolves.toBeUndefined();
  });

  it('listGoogleEvents normaliza os items para o shape interno', async () => {
    listMock.mockResolvedValueOnce({
      data: {
        items: [
          {
            id: 'gcal-1',
            summary: 'Treinamento',
            description: 'Equipe Vendas',
            start: { dateTime: '2025-06-10T14:00:00.000Z' },
            end: { dateTime: '2025-06-10T16:00:00.000Z' },
          },
          // All-day event sem dateTime — deve ser descartado.
          {
            id: 'gcal-2',
            summary: 'All day',
            start: { date: '2025-06-11' },
            end: { date: '2025-06-12' },
          },
          // Item sem id — descartado.
          {
            summary: 'Sem id',
            start: { dateTime: '2025-06-12T10:00:00.000Z' },
            end: { dateTime: '2025-06-12T11:00:00.000Z' },
          },
        ],
      },
    });

    const events = await listGoogleEvents(
      new Date('2025-06-01T00:00:00.000Z'),
      new Date('2025-07-01T00:00:00.000Z'),
    );

    expect(events).toEqual([
      {
        googleEventId: 'gcal-1',
        title: 'Treinamento',
        description: 'Equipe Vendas',
        startsAt: new Date('2025-06-10T14:00:00.000Z'),
        endsAt: new Date('2025-06-10T16:00:00.000Z'),
      },
    ]);
  });
});

// ─── Retry inline ────────────────────────────────────────────────────

describe('retry inline (backoff curto)', () => {
  beforeEach(() => {
    process.env.GOOGLE_CALENDAR_ID = 'cal-123';
    process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
      client_email: 'svc@x.iam.gserviceaccount.com',
      private_key: 'fake-key',
    });
    __resetGoogleCalendarClientForTests();
  });

  it('retenta erros transitórios (5xx) e tem sucesso na 2ª tentativa', async () => {
    insertMock
      .mockRejectedValueOnce(Object.assign(new Error('upstream'), { code: 503 }))
      .mockResolvedValueOnce({ data: { id: 'gcal-evt-2' } });

    const result = await createGoogleEvent(validInput);

    expect(result.googleEventId).toBe('gcal-evt-2');
    expect(insertMock).toHaveBeenCalledTimes(2);
  });

  it('retenta até esgotar (3 tentativas no total) e lança GoogleCalendarError', async () => {
    insertMock.mockRejectedValue(Object.assign(new Error('boom'), { code: 503 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createGoogleEvent(validInput)).rejects.toBeInstanceOf(
      GoogleCalendarError,
    );

    // 1ª chamada + 2 retries = 3 tentativas no total.
    expect(insertMock).toHaveBeenCalledTimes(3);
  });

  it('NÃO retenta erros 4xx não-retriáveis (ex.: 403)', async () => {
    insertMock.mockRejectedValueOnce(Object.assign(new Error('forbidden'), { code: 403 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(createGoogleEvent(validInput)).rejects.toBeInstanceOf(
      GoogleCalendarError,
    );

    expect(insertMock).toHaveBeenCalledTimes(1);
  });

  it('retenta 429 (rate limit) — equiparado a transitório', async () => {
    insertMock
      .mockRejectedValueOnce(Object.assign(new Error('rate'), { code: 429 }))
      .mockResolvedValueOnce({ data: { id: 'gcal-evt-3' } });

    const result = await createGoogleEvent(validInput);

    expect(result.googleEventId).toBe('gcal-evt-3');
    expect(insertMock).toHaveBeenCalledTimes(2);
  });
});
