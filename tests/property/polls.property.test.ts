/**
 * Property-Based Tests — Polls (Properties 14–15)
 *
 * Valida: Requisitos 16.4, 16.6
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const NUM_RUNS = 100;

// ─── Property 14: Unicidade de voto ──────────────────────────────────
// **Validates: Requirements 16.4**

describe('Property 14: Unicidade de voto', () => {
  interface Vote {
    userId: string;
    pollId: string;
    optionId: string;
  }

  /**
   * Pure logic: checks if a user can vote on a poll given existing votes.
   * Returns true if the vote is allowed (user hasn't voted yet).
   */
  function canUserVote(userId: string, pollId: string, existingVotes: Vote[]): boolean {
    return !existingVotes.some((v) => v.userId === userId && v.pollId === pollId);
  }

  it('user who already voted on a poll is rejected', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.array(fc.record({ userId: fc.uuid(), pollId: fc.uuid(), optionId: fc.uuid() }), {
          minLength: 0,
          maxLength: 10,
        }),
        (userId, pollId, optionId, otherVotes) => {
          // Add the user's vote to existing votes
          const existingVote: Vote = { userId, pollId, optionId };
          const allVotes = [...otherVotes, existingVote];

          // Attempting to vote again should be rejected
          expect(canUserVote(userId, pollId, allVotes)).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('user who has not voted on a poll is accepted', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.array(fc.record({ userId: fc.uuid(), pollId: fc.uuid(), optionId: fc.uuid() }), {
          minLength: 0,
          maxLength: 10,
        }),
        (userId, pollId, otherVotes) => {
          // Remove any votes by this user on this poll
          const filteredVotes = otherVotes.filter(
            (v) => !(v.userId === userId && v.pollId === pollId),
          );

          expect(canUserVote(userId, pollId, filteredVotes)).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('voting on different polls is independent', () => {
    fc.assert(
      fc.property(
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        fc.uuid(),
        (userId, pollId1, pollId2, optionId) => {
          fc.pre(pollId1 !== pollId2); // ensure different polls

          const existingVotes: Vote[] = [{ userId, pollId: pollId1, optionId }];

          // User voted on poll 1, but should be able to vote on poll 2
          expect(canUserVote(userId, pollId1, existingVotes)).toBe(false);
          expect(canUserVote(userId, pollId2, existingVotes)).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});

// ─── Property 15: Enquete encerrada rejeita votos ────────────────────
// **Validates: Requirements 16.6**

describe('Property 15: Enquete encerrada rejeita votos', () => {
  type PollStatus = 'ACTIVE' | 'CLOSED';

  interface Poll {
    id: string;
    status: PollStatus;
  }

  /**
   * Pure logic: checks if a vote can be submitted to a poll.
   * Returns true if voting is allowed.
   */
  function canSubmitVote(poll: Poll): boolean {
    return poll.status === 'ACTIVE';
  }

  it('closed polls always reject votes', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (pollId, _userId) => {
        const closedPoll: Poll = { id: pollId, status: 'CLOSED' };
        expect(canSubmitVote(closedPoll)).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('active polls accept votes', () => {
    fc.assert(
      fc.property(fc.uuid(), fc.uuid(), (pollId, _userId) => {
        const activePoll: Poll = { id: pollId, status: 'ACTIVE' };
        expect(canSubmitVote(activePoll)).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('poll status is the sole determinant for vote acceptance', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<PollStatus>('ACTIVE', 'CLOSED'),
        fc.uuid(),
        fc.uuid(),
        (status, pollId, userId) => {
          const poll: Poll = { id: pollId, status };
          const result = canSubmitVote(poll);

          if (status === 'ACTIVE') {
            expect(result).toBe(true);
          } else {
            expect(result).toBe(false);
          }
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
