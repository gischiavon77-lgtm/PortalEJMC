/**
 * Testes de exemplo do organograma (Fase 5) e da regra de cargo do
 * MEMBRO (Trainee ou Assessor(a)).
 */

import { describe, expect, it } from 'vitest';

import {
  AREA_SLUGS,
  ORG_AREAS,
  areaFromSlug,
  buildAreaChart,
  computeStructureOverview,
} from '@/lib/org-chart';
import {
  ASSESSOR_LABEL,
  TRAINEE_LABEL,
  effectivePosition,
  resolveOwnPositionUpdate,
} from '@/lib/position';

const people = [
  { id: '1', name: 'Zé', role: 'MEMBRO' as const, area: 'VENDAS' as const },
  { id: '2', name: 'Ana', role: 'DIRETOR' as const, area: 'VENDAS' as const },
  { id: '3', name: 'Bruno', role: 'GERENTE' as const, area: 'VENDAS' as const },
  { id: '4', name: 'Ávila', role: 'MEMBRO' as const, area: 'VENDAS' as const },
  { id: '5', name: 'Caio', role: 'COORDENADOR' as const, area: 'MARKETING' as const },
  { id: '6', name: 'Admin', role: 'ADMIN' as const, area: null },
  { id: '7', name: 'Duda', role: 'ADMIN' as const, area: 'VENDAS' as const },
];

describe('organograma', () => {
  it('monta as camadas de Vendas de cima para baixo, sem camada vazia', () => {
    const layers = buildAreaChart(people, 'VENDAS');
    expect(layers.map((l) => l.label)).toEqual(['Diretoria', 'Gerência', 'Membros']);
    expect(layers[0].people.map((p) => p.name)).toEqual(['Ana', 'Duda']);
    expect(layers[2].people.map((p) => p.name)).toEqual(['Ávila', 'Zé']);
  });

  it('quem não tem área não entra em nenhuma área nem na contagem', () => {
    const overview = computeStructureOverview(people);
    expect(overview.totalMembers).toBe(6);
    expect(overview.areas.find((a) => a.area === 'VENDAS')?.count).toBe(5);
    expect(overview.areas.find((a) => a.area === 'PROJETOS')?.count).toBe(0);
  });

  it('slug de cada área volta para a área; slug desconhecido dá null', () => {
    for (const area of ORG_AREAS) expect(areaFromSlug(AREA_SLUGS[area])).toBe(area);
    expect(areaFromSlug('financeiro')).toBeNull();
  });
});

describe('cargo do MEMBRO', () => {
  it('exibe Trainee ou Assessor(a); qualquer outro valor vira Trainee', () => {
    expect(effectivePosition('MEMBRO', ASSESSOR_LABEL)).toBe(ASSESSOR_LABEL);
    expect(effectivePosition('MEMBRO', null)).toBe(TRAINEE_LABEL);
    expect(effectivePosition('MEMBRO', 'Gerente de Vendas')).toBe(TRAINEE_LABEL);
    expect(effectivePosition('GERENTE', 'Gerente de Vendas')).toBe('Gerente de Vendas');
  });

  it('MEMBRO só grava cargo da lista; demais papéis gravam texto livre', () => {
    expect(resolveOwnPositionUpdate('MEMBRO', ASSESSOR_LABEL)).toEqual({
      ok: true,
      value: ASSESSOR_LABEL,
    });
    expect(resolveOwnPositionUpdate('MEMBRO', 'Presidente')).toEqual({ ok: false });
    expect(resolveOwnPositionUpdate('MEMBRO', undefined)).toEqual({ ok: true, value: undefined });
    expect(resolveOwnPositionUpdate('COORDENADOR', 'Coord. de Eventos')).toEqual({
      ok: true,
      value: 'Coord. de Eventos',
    });
  });
});
