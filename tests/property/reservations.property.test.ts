/**
 * Property-Based Tests — Reservations (Property 17)
 *
 * Valida: Requisitos 19.2, 19.3, 19.4, 19.5, 19.6, 19.7
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  isDateFuture,
  isDateWithin7Days,
  isNotThreeConsecutive,
  MIN_COMPUTER_ID,
  MAX_COMPUTER_ID,
  MAX_ADVANCE_DAYS,
} from '@/lib/validators/reservation';

const NUM_RUNS = 100;

// ─── Property 17: Regras de reserva ─────────────────────────────────
// **Validates: Requirements 19.2, 19.3, 19.4, 19.5, 19.6, 19.7**

describe('Property 17: Regras de reserva', () => {
  const ONE_DAY_MS = 24 * 60 * 60 * 1000;

  // Helper to create UTC midnight dates
  function utcMidnight(year: number, month: number, day: number): Date {
    return new Date(Date.UTC(year, month - 1, day));
  }

  // ─── Rule 1: Date must be strictly future (> today) ─────────────────

  describe('Rule 1: Date is strictly future', () => {
    it('dates after today pass the future check', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 7 }), (daysAhead) => {
          const today = utcMidnight(2025, 6, 15);
          const futureDate = new Date(today.getTime() + daysAhead * ONE_DAY_MS);
          expect(isDateFuture(futureDate, today)).toBe(true);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    it('today or past dates fail the future check', () => {
      fc.assert(
        fc.property(fc.integer({ min: 0, max: 30 }), (daysBack) => {
          const today = utcMidnight(2025, 6, 15);
          const pastOrTodayDate = new Date(today.getTime() - daysBack * ONE_DAY_MS);
          expect(isDateFuture(pastOrTodayDate, today)).toBe(false);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // ─── Rule 2: Date within 7 days ────────────────────────────────────

  describe('Rule 2: Date within 7 days', () => {
    it('dates 1-7 days ahead pass the 7-day check', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: MAX_ADVANCE_DAYS }), (daysAhead) => {
          const today = utcMidnight(2025, 6, 15);
          const date = new Date(today.getTime() + daysAhead * ONE_DAY_MS);
          expect(isDateWithin7Days(date, today)).toBe(true);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    it('dates more than 7 days ahead fail the 7-day check', () => {
      fc.assert(
        fc.property(fc.integer({ min: MAX_ADVANCE_DAYS + 1, max: 60 }), (daysAhead) => {
          const today = utcMidnight(2025, 6, 15);
          const date = new Date(today.getTime() + daysAhead * ONE_DAY_MS);
          expect(isDateWithin7Days(date, today)).toBe(false);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // ─── Rule 3: Max 1 reservation per day per user ─────────────────────

  describe('Rule 3: Max 1 reservation per day per user', () => {
    interface Reservation {
      userId: string;
      computerId: number;
      date: Date;
    }

    function hasReservationOnDay(
      userId: string,
      date: Date,
      existingReservations: Reservation[],
    ): boolean {
      return existingReservations.some(
        (r) => r.userId === userId && r.date.getTime() === date.getTime(),
      );
    }

    it('user with existing reservation on same day is blocked', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1, max: 7 }),
          fc.integer({ min: MIN_COMPUTER_ID, max: MAX_COMPUTER_ID }),
          (userId, day, computerId) => {
            const date = utcMidnight(2025, 6, day);
            const existingReservations: Reservation[] = [{ userId, computerId, date }];

            expect(hasReservationOnDay(userId, date, existingReservations)).toBe(true);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('user without reservation on that day is allowed', () => {
      fc.assert(
        fc.property(
          fc.uuid(),
          fc.integer({ min: 1, max: 7 }),
          fc.integer({ min: 8, max: 14 }),
          fc.integer({ min: MIN_COMPUTER_ID, max: MAX_COMPUTER_ID }),
          (userId, existingDay, newDay, computerId) => {
            const existingDate = utcMidnight(2025, 6, existingDay);
            const newDate = utcMidnight(2025, 6, newDay);
            const existingReservations: Reservation[] = [
              { userId, computerId, date: existingDate },
            ];

            expect(hasReservationOnDay(userId, newDate, existingReservations)).toBe(false);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // ─── Rule 4: No 3 consecutive days ─────────────────────────────────

  describe('Rule 4: No 3 consecutive days', () => {
    it('adding a date that would create 3 consecutive is rejected', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 25 }), (startDay) => {
          const day1 = utcMidnight(2025, 6, startDay);
          const day2 = new Date(day1.getTime() + ONE_DAY_MS);
          const day3 = new Date(day1.getTime() + 2 * ONE_DAY_MS);

          // User already has day1 and day2
          const existing = [day1, day2];
          // Adding day3 would create 3 consecutive
          expect(isNotThreeConsecutive(existing, day3)).toBe(false);
        }),
        { numRuns: NUM_RUNS },
      );
    });

    it('non-consecutive dates are always allowed', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 1, max: 10 }),
          fc.integer({ min: 3, max: 10 }),
          (startDay, gap) => {
            const day1 = utcMidnight(2025, 6, startDay);
            // day with gap (not consecutive to day1)
            const dayWithGap = new Date(day1.getTime() + gap * ONE_DAY_MS);
            fc.pre(gap >= 3); // ensure gap is big enough

            expect(isNotThreeConsecutive([day1], dayWithGap)).toBe(true);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('2 consecutive days is allowed (max 2 ok, 3 not)', () => {
      fc.assert(
        fc.property(fc.integer({ min: 1, max: 25 }), (startDay) => {
          const day1 = utcMidnight(2025, 6, startDay);
          const day2 = new Date(day1.getTime() + ONE_DAY_MS);

          // Adding day2 to [day1] creates 2 consecutive — allowed
          expect(isNotThreeConsecutive([day1], day2)).toBe(true);
        }),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // ─── Rule 5: Computer availability ─────────────────────────────────

  describe('Rule 5: Computer availability', () => {
    interface Reservation {
      computerId: number;
      date: Date;
      userId: string;
    }

    function isComputerAvailable(
      computerId: number,
      date: Date,
      reservations: Reservation[],
      requestingUserId: string,
    ): boolean {
      return !reservations.some(
        (r) =>
          r.computerId === computerId &&
          r.date.getTime() === date.getTime() &&
          r.userId !== requestingUserId,
      );
    }

    it('computer already reserved by another user is unavailable', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: MIN_COMPUTER_ID, max: MAX_COMPUTER_ID }),
          fc.integer({ min: 1, max: 7 }),
          fc.uuid(),
          fc.uuid(),
          (computerId, day, otherUserId, requestingUserId) => {
            fc.pre(otherUserId !== requestingUserId);

            const date = utcMidnight(2025, 6, day);
            const reservations: Reservation[] = [{ computerId, date, userId: otherUserId }];

            expect(isComputerAvailable(computerId, date, reservations, requestingUserId)).toBe(
              false,
            );
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('computer not reserved on that date is available', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: MIN_COMPUTER_ID, max: MAX_COMPUTER_ID }),
          fc.integer({ min: 1, max: 7 }),
          fc.uuid(),
          (computerId, day, requestingUserId) => {
            const date = utcMidnight(2025, 6, day);
            // No reservations for this computer on this date
            const reservations: Reservation[] = [];

            expect(isComputerAvailable(computerId, date, reservations, requestingUserId)).toBe(
              true,
            );
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('computer reserved on different date is available', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: MIN_COMPUTER_ID, max: MAX_COMPUTER_ID }),
          fc.integer({ min: 1, max: 7 }),
          fc.integer({ min: 8, max: 14 }),
          fc.uuid(),
          fc.uuid(),
          (computerId, reservedDay, requestedDay, otherUserId, requestingUserId) => {
            fc.pre(otherUserId !== requestingUserId);

            const reservedDate = utcMidnight(2025, 6, reservedDay);
            const requestedDate = utcMidnight(2025, 6, requestedDay);
            const reservations: Reservation[] = [
              { computerId, date: reservedDate, userId: otherUserId },
            ];

            expect(
              isComputerAvailable(computerId, requestedDate, reservations, requestingUserId),
            ).toBe(true);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });

  // ─── Combined: All 5 rules together ────────────────────────────────

  describe('Combined: Full reservation validation', () => {
    interface ExistingReservation {
      computerId: number;
      date: Date;
      userId: string;
    }

    function validateReservation(
      computerId: number,
      date: Date,
      userId: string,
      today: Date,
      userExistingDates: Date[],
      allReservations: ExistingReservation[],
    ): { valid: boolean; error?: string } {
      // Rule 1: future date
      if (!isDateFuture(date, today)) {
        return { valid: false, error: 'Date must be in the future' };
      }

      // Rule 2: within 7 days
      if (!isDateWithin7Days(date, today)) {
        return { valid: false, error: 'Date must be within 7 days' };
      }

      // Rule 3: max 1 per day per user
      const hasReservationToday = userExistingDates.some((d) => d.getTime() === date.getTime());
      if (hasReservationToday) {
        return { valid: false, error: 'Already have reservation on this day' };
      }

      // Rule 4: no 3 consecutive
      if (!isNotThreeConsecutive(userExistingDates, date)) {
        return { valid: false, error: 'Would create 3 consecutive days' };
      }

      // Rule 5: computer available
      const computerTaken = allReservations.some(
        (r) =>
          r.computerId === computerId && r.date.getTime() === date.getTime() && r.userId !== userId,
      );
      if (computerTaken) {
        return { valid: false, error: 'Computer already reserved' };
      }

      return { valid: true };
    }

    it('valid reservation satisfies all 5 rules', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: MIN_COMPUTER_ID, max: MAX_COMPUTER_ID }),
          fc.integer({ min: 1, max: MAX_ADVANCE_DAYS }),
          fc.uuid(),
          (computerId, daysAhead, userId) => {
            const today = utcMidnight(2025, 6, 15);
            const date = new Date(today.getTime() + daysAhead * ONE_DAY_MS);

            // No existing reservations — all rules pass
            const result = validateReservation(computerId, date, userId, today, [], []);
            expect(result.valid).toBe(true);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('reservation on today is always rejected', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: MIN_COMPUTER_ID, max: MAX_COMPUTER_ID }),
          fc.uuid(),
          (computerId, userId) => {
            const today = utcMidnight(2025, 6, 15);

            const result = validateReservation(computerId, today, userId, today, [], []);
            expect(result.valid).toBe(false);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });

    it('cancellation frees the slot for other users', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: MIN_COMPUTER_ID, max: MAX_COMPUTER_ID }),
          fc.integer({ min: 1, max: MAX_ADVANCE_DAYS }),
          fc.uuid(),
          fc.uuid(),
          (computerId, daysAhead, originalUserId, newUserId) => {
            fc.pre(originalUserId !== newUserId);

            const today = utcMidnight(2025, 6, 15);
            const date = new Date(today.getTime() + daysAhead * ONE_DAY_MS);

            // Initially, computer is reserved by original user
            const reservations: ExistingReservation[] = [
              { computerId, date, userId: originalUserId },
            ];

            // New user can't book (Rule 5)
            const beforeCancel = validateReservation(
              computerId,
              date,
              newUserId,
              today,
              [],
              reservations,
            );
            expect(beforeCancel.valid).toBe(false);

            // After cancellation (remove from reservations)
            const afterCancel = validateReservation(computerId, date, newUserId, today, [], []);
            expect(afterCancel.valid).toBe(true);
          },
        ),
        { numRuns: NUM_RUNS },
      );
    });
  });
});
