/**
 * Testes do catálogo de categorias de evento (Fase 4 da reforma) e da
 * validação da categoria nos schemas do calendário.
 */

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_NEW_EVENT_CATEGORY,
  EVENT_CATEGORIES,
  EVENT_CATEGORY_VALUES,
  filterByCategory,
  getEventCategory,
} from '@/lib/event-categories';
import { createEventSchema, updateEventSchema } from '@/lib/validators/calendar';

const base = {
  title: 'Reunião',
  startsAt: '2026-11-25T12:00:00.000Z',
  endsAt: '2026-11-25T13:00:00.000Z',
};

describe('catálogo de categorias', () => {
  it('tem as oito categorias, cada uma com nome, ponto e fundo', () => {
    expect(EVENT_CATEGORY_VALUES).toEqual([
      'INSTITUCIONAL',
      'REUNIAO_AREA',
      'PROJETOS_CLIENTES',
      'COMERCIAL',
      'CAPACITACAO',
      'PROCESSO_SELETIVO',
      'EVENTOS_INTEGRACAO',
      'OUTROS',
    ]);
    for (const c of EVENT_CATEGORIES) {
      expect(c.label).not.toBe('');
      expect(c.dot).toMatch(/^bg-cat-/);
      expect(c.chip).toMatch(/bg-cat-.*\/15/);
    }
  });

  it('nenhuma categoria usa o vermelho da marca', () => {
    for (const c of EVENT_CATEGORIES) {
      expect(`${c.dot} ${c.chip}`).not.toMatch(/brand/);
    }
  });

  it('categoria desconhecida cai em "Outros"; novos eventos sugerem "Institucional"', () => {
    expect(getEventCategory('INEXISTENTE').value).toBe('OUTROS');
    expect(getEventCategory(null).value).toBe('OUTROS');
    expect(getEventCategory('COMERCIAL').label).toBe('Comercial');
    expect(DEFAULT_NEW_EVENT_CATEGORY).toBe('INSTITUCIONAL');
  });

  it('filterByCategory: null mostra tudo; uma categoria mostra só ela', () => {
    const events = [
      { id: 'a', category: 'COMERCIAL' },
      { id: 'b', category: 'CAPACITACAO' },
      { id: 'c', category: 'COMERCIAL' },
    ];
    expect(filterByCategory(events, null)).toHaveLength(3);
    expect(filterByCategory(events, 'COMERCIAL').map((e) => e.id)).toEqual(['a', 'c']);
    expect(filterByCategory(events, 'OUTROS')).toEqual([]);
  });
});

describe('validação da categoria', () => {
  it('criação aceita categoria válida ou nenhuma; recusa inválida', () => {
    expect(createEventSchema.safeParse({ ...base, category: 'PROCESSO_SELETIVO' }).success).toBe(
      true,
    );
    expect(createEventSchema.safeParse(base).success).toBe(true);
    expect(createEventSchema.safeParse({ ...base, category: 'festa' }).success).toBe(false);
  });

  it('edição aceita só a categoria', () => {
    const parsed = updateEventSchema.safeParse({ category: 'COMERCIAL' });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.category).toBe('COMERCIAL');
  });
});
