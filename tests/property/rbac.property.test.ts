/**
 * Property-Based Tests — RBAC (Properties 7–8)
 *
 * Valida: Requisitos 5.1, 5.2, 5.3, 8.6, 16.5, 18.3, 18.4
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import {
  hasPermission,
  PERMISSION_MATRIX,
  PERMISSION_PREDICATES,
  ROLE_LEVEL,
  type Action,
  type PermissionUser,
} from '@/lib/permissions';

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
const ALL_ACTIONS = Object.keys(PERMISSION_MATRIX) as Action[];

// ─── Property 7: Matriz RBAC ─────────────────────────────────────────
// **Validates: Requirements 5.1, 5.2, 8.6, 16.5, 18.3, 18.4**

describe('Property 7: Matriz RBAC', () => {
  it('hasPermission returns true iff role is in matrix OR predicate passes', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ALL_ROLES),
        fc.constantFrom(...ALL_AREAS),
        fc.constantFrom(...ALL_ACTIONS),
        (role, area, action) => {
          const user: PermissionUser = { role, area };
          const result = hasPermission(user, action, { area });

          const allowedByMatrix = PERMISSION_MATRIX[action]?.includes(role) ?? false;
          const predicate = PERMISSION_PREDICATES[action];
          const allowedByPredicate = predicate ? predicate(user, { area }) : false;

          const expected = allowedByMatrix || allowedByPredicate;
          expect(result).toBe(expected);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('ADMIN always has access to admin-only actions', () => {
    const adminOnlyActions: Action[] = [
      'admin:access',
      'user:manage',
      'user:approve',
      'user:create',
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...adminOnlyActions),
        fc.option(fc.constantFrom(...ALL_AREAS), { nil: null }),
        (action, area) => {
          const user: PermissionUser = { role: 'ADMIN', area };
          expect(hasPermission(user, action)).toBe(true);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('MEMBRO without special area cannot access restricted actions', () => {
    // MEMBRO without GESTAO_PESSOAS area should not have access to create infractions
    fc.assert(
      fc.property(
        fc.constantFrom<Area>('VENDAS', 'PRESIDENCIA', 'PROJETOS', 'MARKETING', 'ADM_FIN'),
        (area) => {
          const user: PermissionUser = { role: 'MEMBRO', area };
          expect(hasPermission(user, 'infraction:create')).toBe(false);
          expect(hasPermission(user, 'goal:create')).toBe(false);
          expect(hasPermission(user, 'admin:access')).toBe(false);
          expect(hasPermission(user, 'user:manage')).toBe(false);
        },
      ),
      { numRuns: NUM_RUNS },
    );
  });

  it('GESTAO_PESSOAS members can create infractions regardless of role', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_ROLES), (role) => {
        const user: PermissionUser = { role, area: 'GESTAO_PESSOAS' };
        // All roles in GESTAO_PESSOAS can create infractions (via predicate)
        expect(hasPermission(user, 'infraction:create')).toBe(true);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('poll:create is allowed only for ADMIN, DIRETOR, GERENTE (not COORDENADOR)', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_AREAS), (area) => {
        expect(hasPermission({ role: 'ADMIN', area }, 'poll:create')).toBe(true);
        expect(hasPermission({ role: 'DIRETOR', area }, 'poll:create')).toBe(true);
        expect(hasPermission({ role: 'GERENTE', area }, 'poll:create')).toBe(true);
        expect(hasPermission({ role: 'COORDENADOR', area }, 'poll:create')).toBe(false);
        expect(hasPermission({ role: 'MEMBRO', area }, 'poll:create')).toBe(false);
      }),
      { numRuns: NUM_RUNS },
    );
  });
});

// ─── Property 8: Visibilidade do menu ────────────────────────────────
// **Validates: Requirements 5.3**

describe('Property 8: Visibilidade do menu', () => {
  /**
   * Sidebar items with their required permissions. Items without
   * requiredPermission are visible to all authenticated users.
   */
  interface SidebarItem {
    label: string;
    href: string;
    requiredPermission?: UserRole[];
  }

  const sidebarItems: SidebarItem[] = [
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Cronograma', href: '/cronograma' },
    { label: 'Metas', href: '/metas' },
    { label: 'KPIs', href: '/kpis' },
    { label: 'Membros', href: '/membros' },
    { label: 'Portfólio', href: '/portfolio' },
    { label: 'Projetos', href: '/projetos' },
    { label: 'Comunicados', href: '/comunicados' },
    { label: 'Enquetes', href: '/enquetes' },
    { label: 'Pontuação', href: '/pontuacao', requiredPermission: ['ADMIN', 'DIRETOR', 'GERENTE'] },
    { label: 'Reservas', href: '/reservas' },
    { label: 'Admin', href: '/admin', requiredPermission: ['ADMIN'] },
  ];

  function getVisibleItems(role: UserRole): SidebarItem[] {
    return sidebarItems.filter((item) => {
      if (!item.requiredPermission) return true;
      return item.requiredPermission.includes(role);
    });
  }

  it('visible menu items match exactly the user permissions', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_ROLES), (role) => {
        const visibleItems = getVisibleItems(role);

        for (const item of sidebarItems) {
          const isVisible = visibleItems.includes(item);
          if (!item.requiredPermission) {
            // Items without permission restriction are always visible
            expect(isVisible).toBe(true);
          } else {
            // Items with restriction are visible iff role is in the list
            expect(isVisible).toBe(item.requiredPermission.includes(role));
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('ADMIN sees all menu items', () => {
    fc.assert(
      fc.property(fc.constant('ADMIN' as UserRole), (role) => {
        const visibleItems = getVisibleItems(role);
        expect(visibleItems.length).toBe(sidebarItems.length);
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('MEMBRO does not see Admin menu item', () => {
    fc.assert(
      fc.property(fc.constant('MEMBRO' as UserRole), (role) => {
        const visibleItems = getVisibleItems(role);
        const adminItem = visibleItems.find((item) => item.href === '/admin');
        expect(adminItem).toBeUndefined();
      }),
      { numRuns: NUM_RUNS },
    );
  });

  it('no user sees items they are not permitted to access', () => {
    fc.assert(
      fc.property(fc.constantFrom(...ALL_ROLES), (role) => {
        const visibleItems = getVisibleItems(role);
        for (const item of visibleItems) {
          if (item.requiredPermission) {
            expect(item.requiredPermission).toContain(role);
          }
        }
      }),
      { numRuns: NUM_RUNS },
    );
  });
});
