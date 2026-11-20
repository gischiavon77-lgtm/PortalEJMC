/**
 * Property-Based Tests — Organograma da Estrutura (Fase 5 da reforma).
 *
 * `buildAreaChart` e `computeStructureOverview` (src/lib/org-chart.ts):
 * ninguém some nem aparece duas vezes, cada pessoa cai na camada do seu
 * papel, as camadas seguem a hierarquia e os nomes ficam em ordem.
 */

import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Area, UserRole } from '@prisma/client';

import {
  ORG_AREAS,
  ORG_LEVELS,
  buildAreaChart,
  computeStructureOverview,
  levelOf,
  type OrgPersonInput,
} from '@/lib/org-chart';

const NUM_RUNS = 100;
const ROLES: UserRole[] = ['ADMIN', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'MEMBRO'];

const personArb = fc.record({
  name: fc.string({ minLength: 1, maxLength: 12 }),
  role: fc.constantFrom(...ROLES),
  area: fc.option(fc.constantFrom(...ORG_AREAS), { nil: null }),
});

/** Lista de pessoas com ids únicos. */
const peopleArb = fc
  .array(personArb, { maxLength: 40 })
  .map((list): OrgPersonInput[] => list.map((p, i) => ({ id: `u${i}`, ...p })));

const areaArb = fc.constantFrom<Area>(...ORG_AREAS);

describe('buildAreaChart', () => {
  it('cada pessoa da área aparece exatamente uma vez; ninguém de fora entra', () => {
    fc.assert(
      fc.property(peopleArb, areaArb, (people, area) => {
        const ids = buildAreaChart(people, area).flatMap((l) => l.people.map((p) => p.id));
        const expected = people.filter((p) => p.area === area).map((p) => p.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect([...ids].sort()).toEqual([...expected].sort());
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('cada pessoa está na camada do seu papel; camadas vazias não aparecem', () => {
    fc.assert(
      fc.property(peopleArb, areaArb, (people, area) => {
        for (const layer of buildAreaChart(people, area)) {
          expect(layer.people.length).toBeGreaterThan(0);
          for (const p of layer.people) expect(levelOf(p.role)).toBe(layer.level);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('camadas seguem a hierarquia e os nomes ficam em ordem alfabética', () => {
    const order = ORG_LEVELS.map((l) => l.level);
    fc.assert(
      fc.property(peopleArb, areaArb, (people, area) => {
        const layers = buildAreaChart(people, area);
        const positions = layers.map((l) => order.indexOf(l.level));
        expect(positions).toEqual([...positions].sort((a, b) => a - b));
        for (const layer of layers) {
          for (let i = 1; i < layer.people.length; i++) {
            const cmp = layer.people[i - 1].name.localeCompare(layer.people[i].name, 'pt-BR', {
              sensitivity: 'base',
            });
            expect(cmp).toBeLessThanOrEqual(0);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

describe('computeStructureOverview', () => {
  it('total = soma das áreas = pessoas com área; seis áreas sempre listadas', () => {
    fc.assert(
      fc.property(peopleArb, (people) => {
        const overview = computeStructureOverview(people);
        const withArea = people.filter((p) => p.area !== null).length;
        expect(overview.totalAreas).toBe(6);
        expect(overview.areas.map((a) => a.area)).toEqual([...ORG_AREAS]);
        expect(overview.totalMembers).toBe(withArea);
        expect(overview.areas.reduce((s, a) => s + a.count, 0)).toBe(withArea);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
