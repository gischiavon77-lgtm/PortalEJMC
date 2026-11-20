/**
 * Testes das regras puras da página inicial (`src/lib/home.ts`) e das
 * permissões do feed (`post:create`, `post:delete`).
 */

import { describe, expect, it } from 'vitest';

import {
  eventDateParts,
  NOTICE_WINDOW_DAYS,
  noticeWindowStart,
  pickHomeHighlights,
} from '@/lib/home';
import { hasPermission } from '@/lib/permissions';

describe('eventDateParts (fuso de São Paulo)', () => {
  it('formata dia, mês abreviado sem ponto e horário', () => {
    // 12:00 UTC = 09:00 em São Paulo (UTC-3).
    expect(eventDateParts(new Date('2026-11-25T12:00:00Z'))).toEqual({
      day: '25',
      month: 'nov',
      time: '09:00',
    });
  });

  it('usa o dia de São Paulo, não o de UTC, perto da meia-noite', () => {
    // 01:30 UTC do dia 5 = 22:30 do dia 4 em São Paulo.
    expect(eventDateParts(new Date('2026-12-05T01:30:00Z'))).toEqual({
      day: '4',
      month: 'dez',
      time: '22:30',
    });
  });
});

describe('noticeWindowStart', () => {
  it('volta exatamente a janela de dias do Mural de Avisos', () => {
    const now = new Date('2026-11-20T12:00:00Z');
    const start = noticeWindowStart(now);
    expect((now.getTime() - start.getTime()) / 86_400_000).toBe(NOTICE_WINDOW_DAYS);
  });
});

describe('pickHomeHighlights', () => {
  it('segue a ordem do card, ignora vazios e slots que não são do card', () => {
    const result = pickHomeHighlights([
      { slot: 'equipe', name: 'Equipe Vendas', photoPath: null },
      { slot: 'trainee', name: 'Bia', photoPath: 'destaques/b.png' },
      { slot: 'gerente', name: '   ', photoPath: null },
      { slot: 'premio-uniao', name: 'Carlos', photoPath: null },
    ]);

    expect(result.map((h) => h.slot)).toEqual(['trainee', 'equipe']);
    expect(result[0]).toMatchObject({ name: 'Bia', label: 'Trainee destaque' });
    expect(result[0].photoUrl).toMatch(/^\/api\/files\/destaque\/trainee\?v=/);
    expect(result[1].photoUrl).toBeNull();
  });
});

describe('permissões do feed', () => {
  it('post:create — Coordenador, Gerente, Diretor e Admin; Membro não', () => {
    expect(hasPermission({ role: 'MEMBRO' }, 'post:create')).toBe(false);
    for (const role of ['COORDENADOR', 'GERENTE', 'DIRETOR', 'ADMIN'] as const) {
      expect(hasPermission({ role }, 'post:create')).toBe(true);
    }
  });

  it('post:delete — Diretor e Admin sempre; o autor só a própria publicação', () => {
    expect(hasPermission({ role: 'DIRETOR', id: 'x' }, 'post:delete', { ownerId: 'y' })).toBe(true);
    expect(hasPermission({ role: 'ADMIN', id: 'x' }, 'post:delete', { ownerId: 'y' })).toBe(true);

    expect(hasPermission({ role: 'MEMBRO', id: 'a' }, 'post:delete', { ownerId: 'a' })).toBe(true);
    expect(hasPermission({ role: 'GERENTE', id: 'a' }, 'post:delete', { ownerId: 'b' })).toBe(
      false,
    );

    // Sem id do usuário ou sem dono informado, o predicado nunca libera.
    expect(hasPermission({ role: 'COORDENADOR' }, 'post:delete', { ownerId: 'a' })).toBe(false);
    expect(hasPermission({ role: 'COORDENADOR', id: 'a' }, 'post:delete')).toBe(false);
  });
});
