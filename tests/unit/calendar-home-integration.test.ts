// @vitest-environment node
/**
 * Integração (Fase 4 da reforma): um evento FUTURO criado no calendário
 * aparece em "Próximos Eventos" da página inicial.
 *
 * Usa um banco falso EM MEMÓRIA, compartilhado pela rota que cria o
 * evento (`POST /api/calendar/events`) e pela função que monta a coluna
 * da página inicial (`getHomeSidebar`). Assim o teste pega erro de nome
 * de campo, de filtro de data, de ordenação, de limite e de fuso entre
 * as duas pontas — sem precisar de Postgres.
 *
 * O Google Calendar fica em modo no-op (sem variáveis de ambiente).
 * O caminho completo, com banco real e navegador, está em
 * `tests/e2e/calendar.spec.ts`.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import type { Session } from 'next-auth';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => authMock(...args) }));

// ─── Banco falso em memória (só o que as duas pontas usam) ───────────

type Row = Record<string, unknown> & { id: string; startsAt: Date };

const { store } = vi.hoisted(() => ({ store: { events: [] as Row[], seq: 0 } }));

function pick(row: Row, select?: Record<string, boolean>) {
  if (!select) return { ...row };
  return Object.fromEntries(
    Object.keys(select)
      .filter((k) => select[k])
      .map((k) => [k, row[k]]),
  );
}

vi.mock('@/lib/prisma', () => ({
  prisma: {
    event: {
      create: async ({ data }: { data: Record<string, unknown> }) => {
        const now = new Date();
        const row: Row = {
          id: `evt-${++store.seq}`,
          category: 'OUTROS', // padrão do banco
          googleEventId: null,
          syncRetries: 0,
          createdAt: now,
          updatedAt: now,
          ...data,
        } as unknown as Row;
        store.events.push(row);
        return { ...row };
      },
      findUnique: async ({ where }: { where: { id: string } }) =>
        store.events.find((e) => e.id === where.id) ?? null,
      findUniqueOrThrow: async ({ where }: { where: { id: string } }) => {
        const row = store.events.find((e) => e.id === where.id);
        if (!row) throw new Error('não encontrado');
        return { ...row };
      },
      update: async ({ where, data }: { where: { id: string }; data: Record<string, unknown> }) => {
        const row = store.events.find((e) => e.id === where.id);
        if (!row) throw new Error('não encontrado');
        Object.assign(row, data);
        return { ...row };
      },
      findMany: async (args: {
        where?: { startsAt?: { gte?: Date } };
        orderBy?: { startsAt?: 'asc' | 'desc' };
        take?: number;
        select?: Record<string, boolean>;
      }) => {
        let rows = [...store.events];
        const gte = args.where?.startsAt?.gte;
        if (gte) rows = rows.filter((e) => e.startsAt.getTime() >= gte.getTime());
        if (args.orderBy?.startsAt) {
          const dir = args.orderBy.startsAt === 'asc' ? 1 : -1;
          rows.sort((a, b) => dir * (a.startsAt.getTime() - b.startsAt.getTime()));
        }
        if (args.take !== undefined) rows = rows.slice(0, args.take);
        return rows.map((r) => pick(r, args.select));
      },
    },
    // A coluna lateral também lê avisos e destaques; aqui ficam vazios.
    announcement: { findMany: async () => [] },
    highlight: { findMany: async () => [] },
  },
}));

import { POST } from '@/app/api/calendar/events/route';
import { __resetGoogleCalendarClientForTests } from '@/lib/google-calendar';
import { getHomeSidebar } from '@/lib/home';

const ORIGINAL_ENV = { ...process.env };

function coordinator(): Session {
  return {
    expires: new Date(Date.now() + 3_600_000).toISOString(),
    user: { id: 'coord-1', role: 'COORDENADOR', area: null, status: 'ACTIVE' },
  } as Session;
}

async function createEvent(body: Record<string, string>) {
  authMock.mockResolvedValueOnce(coordinator());
  const res = await POST(
    new NextRequest('http://localhost/api/calendar/events', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    }),
  );
  expect(res.status).toBe(201);
  return (await res.json()).event as { id: string };
}

beforeEach(() => {
  store.events = [];
  store.seq = 0;
  authMock.mockReset();
  delete process.env.GOOGLE_CALENDAR_ID;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  delete process.env.GOOGLE_SERVICE_ACCOUNT_KEY_FILE;
  __resetGoogleCalendarClientForTests();
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe('evento criado no calendário → "Próximos Eventos" na página inicial', () => {
  const now = new Date('2026-11-20T15:00:00Z');

  it('o evento futuro aparece, com dia, mês, horário de São Paulo e categoria; o passado não', async () => {
    await createEvent({
      title: 'Reunião que já passou',
      category: 'INSTITUCIONAL',
      startsAt: '2026-11-19T21:00:00.000Z',
      endsAt: '2026-11-19T22:00:00.000Z',
    });
    const future = await createEvent({
      title: 'Workshop de Power BI',
      category: 'CAPACITACAO',
      // 13:30 UTC = 10:30 em São Paulo
      startsAt: '2026-11-25T13:30:00.000Z',
      endsAt: '2026-11-25T15:00:00.000Z',
    });

    const { events } = await getHomeSidebar(now);

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: future.id,
      title: 'Workshop de Power BI',
      category: 'CAPACITACAO',
      day: '25',
      month: 'nov',
      time: '10:30',
    });
  });

  it('vários eventos futuros aparecem em ordem de data, no máximo 5', async () => {
    const titles = ['F', 'B', 'D', 'A', 'C', 'E'];
    const days = [26, 22, 24, 21, 23, 25];
    for (let i = 0; i < titles.length; i++) {
      await createEvent({
        title: `Evento ${titles[i]}`,
        startsAt: `2026-11-${days[i]}T12:00:00.000Z`,
        endsAt: `2026-11-${days[i]}T13:00:00.000Z`,
      });
    }

    const { events } = await getHomeSidebar(now);

    expect(events.map((e) => e.title)).toEqual([
      'Evento A',
      'Evento B',
      'Evento C',
      'Evento D',
      'Evento E',
    ]);
    // Sem categoria no formulário, vale o padrão do banco.
    expect(events.every((e) => e.category === 'OUTROS')).toBe(true);
  });

  it('evento que começa mais tarde no mesmo dia ainda aparece', async () => {
    await createEvent({
      title: 'Hoje à noite',
      category: 'EVENTOS_INTEGRACAO',
      startsAt: '2026-11-20T22:00:00.000Z',
      endsAt: '2026-11-20T23:30:00.000Z',
    });

    const { events } = await getHomeSidebar(now);

    expect(events.map((e) => e.title)).toEqual(['Hoje à noite']);
    expect(events[0]).toMatchObject({ day: '20', time: '19:00' });
  });
});
