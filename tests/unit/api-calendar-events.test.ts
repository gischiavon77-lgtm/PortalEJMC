/**
 * Testes do handler `POST /api/calendar/events` — Task 7.2.
 *
 * Foco do contrato pedido pela Task:
 *   1. POST cria uma linha no DB e chama o Google Calendar UMA vez
 *      em caminho feliz; resposta inclui `sync.status='synced'`.
 *   2. Quando o Google falha, a linha continua no DB com
 *      `syncStatus='failed'` e `sync.status='failed'`.
 *   3. RBAC: somente Coordenador+ pode criar (Membro recebe 403).
 *   4. Validação Zod: payload inválido → 400 VALIDATION_ERROR.
 *
 * Estratégia:
 *   - Mockamos `auth()` para controlar a sessão.
 *   - Mockamos `@/lib/prisma` para verificar criação no banco sem
 *     subir Postgres.
 *   - Mockamos `googleapis` no nível do `google-calendar.ts` real
 *     — ou seja, deixamos o pipeline completo (validators →
 *     calendar-sync → google-calendar) rodar, mas substituímos a
 *     chamada `events.insert` final.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Session } from 'next-auth';

// ─── Mock do `googleapis` ────────────────────────────────────────────
const { insertMock, calendarFactoryMock } = vi.hoisted(() => ({
  insertMock: vi.fn(),
  calendarFactoryMock: vi.fn(),
}));

vi.mock('googleapis', () => {
  calendarFactoryMock.mockImplementation(() => ({
    events: {
      insert: insertMock,
      update: vi.fn(),
      delete: vi.fn(),
      list: vi.fn(),
    },
  }));
  return {
    google: {
      calendar: calendarFactoryMock,
      auth: {
        GoogleAuth: class {
          constructor(_opts: unknown) {}
        },
      },
    },
  };
});

// ─── Mock do `@/lib/auth` ────────────────────────────────────────────
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

// ─── Mock do prisma ──────────────────────────────────────────────────
const { eventCreateMock, eventFindUniqueOrThrowMock, eventFindUniqueMock, eventUpdateMock } =
  vi.hoisted(() => ({
    eventCreateMock: vi.fn(),
    eventFindUniqueOrThrowMock: vi.fn(),
    eventFindUniqueMock: vi.fn(),
    eventUpdateMock: vi.fn(),
  }));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: {
      create: (...args: unknown[]) => eventCreateMock(...args),
      findUniqueOrThrow: (...args: unknown[]) => eventFindUniqueOrThrowMock(...args),
      findUnique: (...args: unknown[]) => eventFindUniqueMock(...args),
      update: (...args: unknown[]) => eventUpdateMock(...args),
    },
  },
}));

// Imports após mocks.
import { POST } from '@/app/api/calendar/events/route';
import { __resetGoogleCalendarClientForTests } from '@/lib/google-calendar';

const ORIGINAL_ENV = { ...process.env };

function buildSession(role: Session['user']['role'] = 'COORDENADOR'): Session {
  return {
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: {
      id: 'user-1',
      name: 'Coord',
      email: 'coord@ejmc.com.br',
      image: null,
      role,
      area: null,
      status: 'ACTIVE',
    },
  };
}

function buildRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/calendar/events', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

const validBody = {
  title: 'Reunião geral',
  startsAt: '2025-06-10T14:00:00.000Z',
  endsAt: '2025-06-10T15:00:00.000Z',
};

const persistedEvent = {
  id: 'evt-1',
  title: 'Reunião geral',
  startsAt: new Date('2025-06-10T14:00:00.000Z'),
  endsAt: new Date('2025-06-10T15:00:00.000Z'),
  googleEventId: null as string | null,
  syncStatus: 'pending',
  syncRetries: 0,
  createdById: 'user-1',
  createdAt: new Date('2025-06-01T00:00:00.000Z'),
  updatedAt: new Date('2025-06-01T00:00:00.000Z'),
};

beforeEach(() => {
  authMock.mockReset();
  insertMock.mockReset();
  calendarFactoryMock.mockClear();
  eventCreateMock.mockReset();
  eventFindUniqueOrThrowMock.mockReset();
  eventFindUniqueMock.mockReset();
  eventUpdateMock.mockReset();

  __resetGoogleCalendarClientForTests();

  // Configura modo live por padrão para esses testes.
  process.env.GOOGLE_CALENDAR_ID = 'cal-test';
  process.env.GOOGLE_SERVICE_ACCOUNT_KEY = JSON.stringify({
    client_email: 'svc@x.iam.gserviceaccount.com',
    private_key: 'fake',
  });

  // Acelera backoff inline.
  vi.spyOn(global, 'setTimeout').mockImplementation(((cb: () => void) => {
    cb();
    return 0 as unknown as ReturnType<typeof setTimeout>;
  }) as unknown as typeof global.setTimeout);
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.restoreAllMocks();
});

// ─── Testes ──────────────────────────────────────────────────────────

describe('POST /api/calendar/events', () => {
  it('cria evento no DB e chama o Google Calendar uma única vez no caminho feliz', async () => {
    authMock.mockResolvedValueOnce(buildSession('COORDENADOR'));

    eventCreateMock.mockResolvedValueOnce(persistedEvent);
    // syncCreatedEvent → findUnique para ler o registro recém-criado
    eventFindUniqueMock.mockResolvedValueOnce(persistedEvent);
    // syncCreatedEvent.update → marca synced
    eventUpdateMock.mockResolvedValueOnce({});
    // route → findUniqueOrThrow para retornar estado final
    eventFindUniqueOrThrowMock.mockResolvedValueOnce({
      ...persistedEvent,
      syncStatus: 'synced',
      googleEventId: 'gcal-evt-1',
    });

    insertMock.mockResolvedValueOnce({ data: { id: 'gcal-evt-1' } });

    const response = await POST(buildRequest(validBody));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(eventCreateMock).toHaveBeenCalledTimes(1);
    expect(eventCreateMock.mock.calls[0]?.[0]).toMatchObject({
      data: expect.objectContaining({
        title: 'Reunião geral',
        syncStatus: 'pending',
        syncRetries: 0,
        createdById: 'user-1',
      }),
    });
    expect(payload.event).toMatchObject({
      id: 'evt-1',
      title: 'Reunião geral',
      syncStatus: 'synced',
      googleEventId: 'gcal-evt-1',
    });
    expect(payload.sync).toEqual({
      status: 'synced',
      googleEventId: 'gcal-evt-1',
    });
  });

  it('persiste o evento mesmo quando o Google falha; syncStatus="failed"', async () => {
    authMock.mockResolvedValueOnce(buildSession('COORDENADOR'));

    eventCreateMock.mockResolvedValueOnce(persistedEvent);
    eventFindUniqueMock.mockResolvedValueOnce(persistedEvent);
    eventUpdateMock.mockResolvedValueOnce({});
    eventFindUniqueOrThrowMock.mockResolvedValueOnce({
      ...persistedEvent,
      syncStatus: 'failed',
      googleEventId: null,
    });

    // Todas as tentativas inline falham com 503.
    insertMock.mockRejectedValue(Object.assign(new Error('upstream'), { code: 503 }));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const response = await POST(buildRequest(validBody));
    const payload = await response.json();

    // O evento foi criado com sucesso no banco, então a resposta é 201.
    expect(response.status).toBe(201);
    // O DB foi atualizado para 'failed' (chamada do calendar-sync).
    expect(eventUpdateMock).toHaveBeenCalledWith({
      where: { id: 'evt-1' },
      data: { syncStatus: 'failed', syncRetries: 0 },
    });
    expect(payload.event.syncStatus).toBe('failed');
    expect(payload.sync.status).toBe('failed');
    expect(payload.sync.error).toMatchObject({
      code: 'GOOGLE_CALENDAR_ERROR',
    });
  });

  it('retorna 403 quando o usuário é Membro (RBAC calendar:create)', async () => {
    authMock.mockResolvedValueOnce(buildSession('MEMBRO'));

    const response = await POST(buildRequest(validBody));
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.code).toBe('FORBIDDEN');
    expect(eventCreateMock).not.toHaveBeenCalled();
    expect(insertMock).not.toHaveBeenCalled();
  });

  it('retorna 401 quando não há sessão', async () => {
    authMock.mockResolvedValueOnce(null);

    const response = await POST(buildRequest(validBody));

    expect(response.status).toBe(401);
    expect(eventCreateMock).not.toHaveBeenCalled();
  });

  it('retorna 400 VALIDATION_ERROR quando o título é vazio', async () => {
    authMock.mockResolvedValueOnce(buildSession('COORDENADOR'));

    const response = await POST(
      buildRequest({ ...validBody, title: '' }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe('VALIDATION_ERROR');
    expect(payload.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'title' }),
      ]),
    );
    expect(eventCreateMock).not.toHaveBeenCalled();
  });

  it('retorna 400 VALIDATION_ERROR quando endsAt <= startsAt', async () => {
    authMock.mockResolvedValueOnce(buildSession('COORDENADOR'));

    const response = await POST(
      buildRequest({
        ...validBody,
        endsAt: validBody.startsAt, // mesma hora
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.code).toBe('VALIDATION_ERROR');
    expect(payload.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: 'endsAt' }),
      ]),
    );
  });

  it('em modo no-op (sem GOOGLE_CALENDAR_ID) cria com syncStatus=synced e não chama Google', async () => {
    delete process.env.GOOGLE_CALENDAR_ID;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
    __resetGoogleCalendarClientForTests();

    authMock.mockResolvedValueOnce(buildSession('COORDENADOR'));
    eventCreateMock.mockResolvedValueOnce(persistedEvent);
    eventFindUniqueMock.mockResolvedValueOnce(persistedEvent);
    eventUpdateMock.mockResolvedValueOnce({});
    eventFindUniqueOrThrowMock.mockResolvedValueOnce({
      ...persistedEvent,
      syncStatus: 'synced',
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const response = await POST(buildRequest(validBody));
    const payload = await response.json();

    expect(response.status).toBe(201);
    expect(insertMock).not.toHaveBeenCalled();
    expect(payload.sync).toEqual({
      status: 'synced',
      googleEventId: null,
    });
  });
});
