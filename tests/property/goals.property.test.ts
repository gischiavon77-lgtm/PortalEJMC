/**
 * Property-Based Tests — Goals (Properties 9–11)
 *
 * Valida: Requisitos 9.1, 9.3, 9.4, 9.5, 9.6, 9.7
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { canUserSeeGoal, isGoalOverdue } from '@/lib/goals';
import { hasRoleLevel } from '@/lib/permissions';
import {
  createGoalSchema,
  updateProgressSchema,
  GOAL_NAME_MAX_LENGTH,
  GOAL_DESCRIPTION_MAX_LENGTH,
  GOAL_PROGRESS_MIN,
  GOAL_PROGRESS_MAX,
} from '@/lib/validators/goal';

const NUM_RUNS = 100;

type UserRole = 'ADMIN' | 'DIRETOR' | 'GERENTE' | 'COORDENADOR' | 'MEMBRO';
type Area = 'VENDAS' | 'PRESIDENCIA' | 'PROJETOS' | 'MARKETING' | 'GESTAO_PESSOAS' | 'ADM_FIN';

const ALL_ROLES: UserRole[] = ['ADMIN', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'MEMBRO'];
const ALL_AREAS: Area[] = [
  'VENDAS',
  'PRESIDENCIA',
  'PROJETOS',
  'MARKETING',
  'GESTAO_PESSOAS',
  'ADM_FIN',
];

// ─── Property 9: Visibilidade de metas por área ─────────────────────
// **Validates: Requirements 9.4, 9.7**

describe('Property 9: Visibilidade de metas por área', () => {
  it('general goals are visible to all users', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_ROLES),
        fc.option(fc.constantFrom(...ALL_AREAS), { nil: null }),
        (role, area) => {
          const user = { role, area };
          const goal = { type: 'GENERAL' as const, area: null };
          expect(canUserSeeGoal(user, goal)).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('area goals visible only to users of same area or DIRETOR/ADMIN', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_ROLES),
        fc.constantFrom(...ALL_AREAS),
        fc.constantFrom(...ALL_AREAS),
        (role, userArea, goalArea) => {
          const user = { role, area: userArea };
          const goal = { type: 'AREA' as const, area: goalArea };
          const result = canUserSeeGoal(user, goal);

          if (hasRoleLevel(role, 'DIRETOR')) {
            // DIRETOR and ADMIN can see all area goals
            expect(result).toBe(true);
          } else if (userArea === goalArea) {
            // Same area can see
            expect(result).toBe(true);
          } else {
            // Different area, non-DIRETOR/ADMIN cannot see
            expect(result).toBe(false);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('users without area can only see general goals', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<UserRole>('GERENTE', 'COORDENADOR', 'MEMBRO'),
        fc.constantFrom(...ALL_AREAS),
        (role, goalArea) => {
          const user = { role, area: null };
          const generalGoal = { type: 'GENERAL' as const, area: null };
          const areaGoal = { type: 'AREA' as const, area: goalArea };

          expect(canUserSeeGoal(user, generalGoal)).toBe(true);
          expect(canUserSeeGoal(user, areaGoal)).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ─── Property 10: Meta vencida ───────────────────────────────────────
// **Validates: Requirements 9.5**

describe('Property 10: Meta vencida', () => {
  it('overdue iff deadline < now AND progress < 100', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        fc.integer({ min: 0, max: 100 }),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }),
        (deadline, progress, now) => {
          const goal = { deadline, progress };
          const result = isGoalOverdue(goal, now);

          const isPastDeadline = now.getTime() > deadline.getTime();
          const isIncomplete = progress < 100;
          const expectedOverdue = isPastDeadline && isIncomplete;

          expect(result).toBe(expectedOverdue);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('completed goals (100%) are never overdue', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2025-01-01') }),
        fc.date({ min: new Date('2025-01-02'), max: new Date('2030-12-31') }),
        (deadline, now) => {
          // deadline is in the past relative to now
          const goal = { deadline, progress: 100 };
          expect(isGoalOverdue(goal, now)).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('goals with future deadline are never overdue', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2025-06-01'), max: new Date('2030-12-31') }),
        fc.integer({ min: 0, max: 99 }),
        (deadline, progress) => {
          // now is before the deadline
          const now = new Date('2025-01-01');
          const goal = { deadline, progress };
          expect(isGoalOverdue(goal, now)).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ─── Property 11: Validação de metas ─────────────────────────────────
// **Validates: Requirements 9.1, 9.3, 9.6**

describe('Property 11: Validação de metas', () => {
  it('valid goal data is accepted', () => {
    fc.assert(
      fc.property(
        fc
          .string({ minLength: 1, maxLength: GOAL_NAME_MAX_LENGTH })
          .filter((s) => s.trim().length >= 1),
        fc.string({ minLength: 0, maxLength: GOAL_DESCRIPTION_MAX_LENGTH }),
        (name, description) => {
          // Use a deadline that's definitely in the future
          const futureDeadline = new Date(Date.now() + 86400000 * 30).toISOString();
          const result = createGoalSchema.safeParse({
            name,
            description,
            type: 'GENERAL',
            deadline: futureDeadline,
          });
          expect(result.success).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('name exceeding 100 chars is rejected', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 101, maxLength: 200 }), (name) => {
        const futureDeadline = new Date(Date.now() + 86400000 * 30).toISOString();
        const result = createGoalSchema.safeParse({
          name,
          description: 'Valid description',
          type: 'GENERAL',
          deadline: futureDeadline,
        });
        expect(result.success).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('description exceeding 500 chars is rejected', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 501, maxLength: 600 }), (description) => {
        const futureDeadline = new Date(Date.now() + 86400000 * 30).toISOString();
        const result = createGoalSchema.safeParse({
          name: 'Valid name',
          description,
          type: 'GENERAL',
          deadline: futureDeadline,
        });
        expect(result.success).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('past deadline is rejected', () => {
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2020-01-01'), max: new Date('2024-01-01') }),
        (pastDate) => {
          const result = createGoalSchema.safeParse({
            name: 'Valid name',
            description: 'Valid description',
            type: 'GENERAL',
            deadline: pastDate.toISOString(),
          });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('progress must be integer between 0-100', () => {
    fc.assert(
      fc.property(fc.integer({ min: GOAL_PROGRESS_MIN, max: GOAL_PROGRESS_MAX }), (progress) => {
        const result = updateProgressSchema.safeParse({ progress });
        expect(result.success).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('progress outside 0-100 is rejected', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.integer({ min: -1000, max: -1 }), fc.integer({ min: 101, max: 1000 })),
        (progress) => {
          const result = updateProgressSchema.safeParse({ progress });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('non-integer progress is rejected', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0.01, max: 99.99, noNaN: true }).filter((n) => !Number.isInteger(n)),
        (progress) => {
          const result = updateProgressSchema.safeParse({ progress });
          expect(result.success).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
