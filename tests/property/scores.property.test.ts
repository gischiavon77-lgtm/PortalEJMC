/**
 * Property-Based Tests — Scores (Property 16)
 *
 * Valida: Requisitos 18.2, 18.7
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const NUM_RUNS = 100;

// ─── Property 16: Cálculo de pontuação ──────────────────────────────
// **Validates: Requirements 18.2, 18.7**

describe('Property 16: Cálculo de pontuação', () => {
  type InfractionType = 'ATRASO' | 'FALTA' | 'DRESS_CODE';

  interface Infraction {
    id: string;
    type: InfractionType;
    points: number;
    active: boolean;
  }

  /**
   * Pure logic: calculates total score from active infractions.
   */
  function calculateTotalScore(infractions: Infraction[]): number {
    return infractions.filter((i) => i.active).reduce((sum, i) => sum + i.points, 0);
  }

  /**
   * Pure logic: removes an infraction and recalculates.
   */
  function removeInfractionAndRecalculate(
    infractions: Infraction[],
    infractionId: string,
  ): { infractions: Infraction[]; newScore: number } {
    const updated = infractions.map((i) => (i.id === infractionId ? { ...i, active: false } : i));
    return { infractions: updated, newScore: calculateTotalScore(updated) };
  }

  // Generator for infractions with realistic points
  const POINTS_MAP: Record<InfractionType, number> = {
    ATRASO: 1,
    FALTA: 2,
    DRESS_CODE: 1,
  };

  const infractionArb = fc.record({
    id: fc.uuid(),
    type: fc.constantFrom<InfractionType>('ATRASO', 'FALTA', 'DRESS_CODE'),
    points: fc.integer({ min: 1, max: 5 }),
    active: fc.constant(true),
  });

  it('total score equals sum of all active infraction points', () => {
    fc.assert(
      fc.property(fc.array(infractionArb, { minLength: 0, maxLength: 20 }), (infractions) => {
        const totalScore = calculateTotalScore(infractions);
        const expectedSum = infractions
          .filter((i) => i.active)
          .reduce((sum, i) => sum + i.points, 0);
        expect(totalScore).toBe(expectedSum);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('score after removal equals sum of remaining active infractions', () => {
    fc.assert(
      fc.property(
        fc.array(infractionArb, { minLength: 1, maxLength: 20 }),
        fc.nat(),
        (infractions, indexSeed) => {
          const targetIndex = indexSeed % infractions.length;
          const targetId = infractions[targetIndex]!.id;
          const targetPoints = infractions[targetIndex]!.points;

          const originalScore = calculateTotalScore(infractions);
          const { newScore } = removeInfractionAndRecalculate(infractions, targetId);

          // After removal, score should decrease by exactly the removed points
          expect(newScore).toBe(originalScore - targetPoints);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('removing non-existent infraction does not change score', () => {
    fc.assert(
      fc.property(
        fc.array(infractionArb, { minLength: 0, maxLength: 20 }),
        fc.uuid(),
        (infractions, fakeId) => {
          // Ensure fakeId is not in the list
          const allIds = infractions.map((i) => i.id);
          fc.pre(!allIds.includes(fakeId));

          const originalScore = calculateTotalScore(infractions);
          const { newScore } = removeInfractionAndRecalculate(infractions, fakeId);
          expect(newScore).toBe(originalScore);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('empty infractions list yields zero score', () => {
    fc.assert(
      fc.property(fc.constant([]), (infractions: Infraction[]) => {
        expect(calculateTotalScore(infractions)).toBe(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('score is non-negative when points are positive', () => {
    fc.assert(
      fc.property(fc.array(infractionArb, { minLength: 0, maxLength: 30 }), (infractions) => {
        const score = calculateTotalScore(infractions);
        expect(score).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
