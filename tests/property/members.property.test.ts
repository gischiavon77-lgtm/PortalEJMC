/**
 * Property-Based Tests — Members (Property 13)
 *
 * Valida: Requisitos 11.1, 11.2
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const NUM_RUNS = 100;

type Area = 'VENDAS' | 'PRESIDENCIA' | 'PROJETOS' | 'MARKETING' | 'GESTAO_PESSOAS' | 'ADM_FIN';
const ALL_AREAS: Area[] = [
  'VENDAS',
  'PRESIDENCIA',
  'PROJETOS',
  'MARKETING',
  'GESTAO_PESSOAS',
  'ADM_FIN',
];

// ─── Property 13: Ordenação e filtragem de membros ───────────────────
// **Validates: Requirements 11.1, 11.2**

describe('Property 13: Ordenação e filtragem de membros', () => {
  interface Member {
    id: string;
    name: string;
    area: Area;
    status: 'ACTIVE';
  }

  /**
   * Pure sort function: alphabetical by name (case-insensitive).
   */
  function sortMembersAlphabetically(members: Member[]): Member[] {
    return [...members].sort((a, b) =>
      a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }),
    );
  }

  /**
   * Pure filter function: filter by area.
   */
  function filterByArea(members: Member[], area: Area): Member[] {
    return members.filter((m) => m.area === area);
  }

  const memberArb = fc.record({
    id: fc.uuid(),
    name: fc.string({ minLength: 3, maxLength: 50 }).filter((s) => s.trim().length >= 3),
    area: fc.constantFrom(...ALL_AREAS),
    status: fc.constant('ACTIVE' as const),
  });

  it('members are sorted alphabetically', () => {
    fc.assert(
      fc.property(fc.array(memberArb, { minLength: 2, maxLength: 30 }), (members) => {
        const sorted = sortMembersAlphabetically(members);

        // Verify sorted order
        for (let i = 0; i < sorted.length - 1; i++) {
          const comparison = sorted[i]!.name.localeCompare(sorted[i + 1]!.name, 'pt-BR', {
            sensitivity: 'base',
          });
          expect(comparison).toBeLessThanOrEqual(0);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('sorting preserves all members (no additions or removals)', () => {
    fc.assert(
      fc.property(fc.array(memberArb, { minLength: 0, maxLength: 30 }), (members) => {
        const sorted = sortMembersAlphabetically(members);
        expect(sorted.length).toBe(members.length);

        // Every member in the original list is in the sorted list
        for (const m of members) {
          expect(sorted.some((s) => s.id === m.id)).toBe(true);
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('area filter returns only members of that area', () => {
    fc.assert(
      fc.property(
        fc.array(memberArb, { minLength: 1, maxLength: 30 }),
        fc.constantFrom(...ALL_AREAS),
        (members, area) => {
          const filtered = filterByArea(members, area);

          // All filtered members belong to the selected area
          for (const m of filtered) {
            expect(m.area).toBe(area);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('area filter does not exclude any member of that area', () => {
    fc.assert(
      fc.property(
        fc.array(memberArb, { minLength: 1, maxLength: 30 }),
        fc.constantFrom(...ALL_AREAS),
        (members, area) => {
          const filtered = filterByArea(members, area);
          const expectedCount = members.filter((m) => m.area === area).length;
          expect(filtered.length).toBe(expectedCount);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('filtering then sorting preserves all properties', () => {
    fc.assert(
      fc.property(
        fc.array(memberArb, { minLength: 1, maxLength: 30 }),
        fc.constantFrom(...ALL_AREAS),
        (members, area) => {
          const filtered = filterByArea(members, area);
          const sorted = sortMembersAlphabetically(filtered);

          // All items are from the correct area
          for (const m of sorted) {
            expect(m.area).toBe(area);
          }

          // Items are sorted
          for (let i = 0; i < sorted.length - 1; i++) {
            const comparison = sorted[i]!.name.localeCompare(sorted[i + 1]!.name, 'pt-BR', {
              sensitivity: 'base',
            });
            expect(comparison).toBeLessThanOrEqual(0);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
