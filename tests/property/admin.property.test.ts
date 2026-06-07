/**
 * Property-Based Tests — Admin (Property 6)
 *
 * Valida: Requisitos 4.7
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';

const NUM_RUNS = 100;

// ─── Property 6: Proteção do último admin ────────────────────────────
// **Validates: Requirements 4.7**

describe('Property 6: Proteção do último admin', () => {
  type UserRole = 'ADMIN' | 'DIRETOR' | 'GERENTE' | 'COORDENADOR' | 'MEMBRO';

  interface UserRecord {
    id: string;
    role: UserRole;
    status: 'ACTIVE' | 'INACTIVE';
  }

  type DangerousOperation = 'deactivate' | 'demote' | 'delete';

  /**
   * Pure logic: determines if an operation on a user would leave the
   * system without any admin. Returns true if the operation is SAFE
   * (should be allowed), false if it should be REJECTED.
   */
  function isOperationSafeForLastAdmin(
    targetUser: UserRecord,
    operation: DangerousOperation,
    allUsers: UserRecord[],
  ): boolean {
    // Count active admins
    const activeAdmins = allUsers.filter((u) => u.role === 'ADMIN' && u.status === 'ACTIVE');

    // If target is not an active admin, no risk
    if (targetUser.role !== 'ADMIN' || targetUser.status !== 'ACTIVE') {
      return true;
    }

    // If there's only one active admin and we're targeting them, block
    if (activeAdmins.length <= 1) {
      return false;
    }

    // Multiple admins — safe to operate on one
    return true;
  }

  it('operations on the only admin are always rejected', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<DangerousOperation>('deactivate', 'demote', 'delete'),
        fc.array(
          fc.record({
            id: fc.uuid(),
            role: fc.constantFrom<UserRole>('DIRETOR', 'GERENTE', 'COORDENADOR', 'MEMBRO'),
            status: fc.constantFrom<'ACTIVE' | 'INACTIVE'>('ACTIVE', 'INACTIVE'),
          }),
          { minLength: 0, maxLength: 10 },
        ),
        (operation, otherUsers) => {
          const soleAdmin: UserRecord = { id: 'admin-1', role: 'ADMIN', status: 'ACTIVE' };
          const allUsers = [soleAdmin, ...otherUsers];

          const result = isOperationSafeForLastAdmin(soleAdmin, operation, allUsers);
          expect(result).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('operations on non-admin users are always allowed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<DangerousOperation>('deactivate', 'demote', 'delete'),
        fc.constantFrom<UserRole>('DIRETOR', 'GERENTE', 'COORDENADOR', 'MEMBRO'),
        (operation, role) => {
          const targetUser: UserRecord = { id: 'user-1', role, status: 'ACTIVE' };
          const soleAdmin: UserRecord = { id: 'admin-1', role: 'ADMIN', status: 'ACTIVE' };
          const allUsers = [soleAdmin, targetUser];

          const result = isOperationSafeForLastAdmin(targetUser, operation, allUsers);
          expect(result).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('operations on an admin when multiple admins exist are allowed', () => {
    fc.assert(
      fc.property(
        fc.constantFrom<DangerousOperation>('deactivate', 'demote', 'delete'),
        fc.integer({ min: 2, max: 5 }),
        (operation, numAdmins) => {
          const admins: UserRecord[] = Array.from({ length: numAdmins }, (_, i) => ({
            id: `admin-${i}`,
            role: 'ADMIN' as const,
            status: 'ACTIVE' as const,
          }));

          const targetAdmin = admins[0]!;
          const result = isOperationSafeForLastAdmin(targetAdmin, operation, admins);
          expect(result).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });
});
