/**
 * Testes unitários do RBAC central (`src/lib/permissions.ts`, Task 4.1).
 *
 * Cobertura:
 *   - Hierarquia de papéis (`hasRoleLevel` e `ROLE_LEVEL`).
 *   - Ações permitidas/negadas conforme a matriz (`hasPermission`).
 *   - Ações GP-exclusivas (predicado de área `GESTAO_PESSOAS`).
 *
 * Esses casos exemplificam o contrato; os testes de propriedade
 * exaustivos (todas as combinações role × area × action) ficam na
 * Task 20.8 (Property 7).
 */

import { describe, expect, it } from 'vitest';
import type { Area, UserRole } from '@prisma/client';

import {
  type Action,
  type PermissionUser,
  PERMISSION_MATRIX,
  ROLE_LEVEL,
  hasPermission,
  hasRoleLevel,
} from '@/lib/permissions';

const ROLES: UserRole[] = ['ADMIN', 'DIRETOR', 'GERENTE', 'COORDENADOR', 'MEMBRO'];

const NON_GP_AREAS: Area[] = [
  'VENDAS',
  'PRESIDENCIA',
  'PROJETOS',
  'MARKETING',
  'ADM_FIN',
];

function user(role: UserRole, area: Area | null = null): PermissionUser {
  return { role, area };
}

describe('ROLE_LEVEL — hierarquia numérica de papéis', () => {
  it('atribui valores estritamente decrescentes de ADMIN a MEMBRO', () => {
    // A ordem hierárquica é parte do contrato (Req 5.1) e a base de
    // `hasRoleLevel`. Travar a sequência aqui evita regressões silenciosas.
    expect(ROLE_LEVEL.ADMIN).toBe(5);
    expect(ROLE_LEVEL.DIRETOR).toBe(4);
    expect(ROLE_LEVEL.GERENTE).toBe(3);
    expect(ROLE_LEVEL.COORDENADOR).toBe(2);
    expect(ROLE_LEVEL.MEMBRO).toBe(1);
  });
});

describe('hasRoleLevel — comparação por nível mínimo', () => {
  it('retorna true quando o papel é igual ao mínimo exigido', () => {
    expect(hasRoleLevel('DIRETOR', 'DIRETOR')).toBe(true);
  });

  it('retorna true quando o papel é mais privilegiado que o mínimo', () => {
    expect(hasRoleLevel('ADMIN', 'DIRETOR')).toBe(true);
    expect(hasRoleLevel('DIRETOR', 'COORDENADOR')).toBe(true);
  });

  it('retorna false quando o papel é abaixo do mínimo', () => {
    expect(hasRoleLevel('MEMBRO', 'COORDENADOR')).toBe(false);
    expect(hasRoleLevel('GERENTE', 'DIRETOR')).toBe(false);
  });
});

describe('hasPermission — matriz de papéis', () => {
  it('admin tem acesso a todas as ações cadastradas', () => {
    // Override administrativo (Req 5.1): Admin sempre passa pela matriz.
    for (const action of Object.keys(PERMISSION_MATRIX) as Action[]) {
      expect(hasPermission(user('ADMIN'), action)).toBe(true);
    }
  });

  it('membro comum só passa em ações listadas para MEMBRO na matriz', () => {
    // Hoje nenhuma ação cadastrada na Task 4.1 lista MEMBRO → todas
    // devem ser negadas para um membro fora da equipe GP.
    for (const action of Object.keys(PERMISSION_MATRIX) as Action[]) {
      expect(hasPermission(user('MEMBRO'), action)).toBe(false);
    }
  });

  it('coordenador pode publicar comunicados e gerenciar eventos', () => {
    // Req 8.2 / 15.2 — Coordenador faz parte da escala que pode operar
    // eventos no cronograma e publicar comunicados.
    expect(hasPermission(user('COORDENADOR'), 'announcement:create')).toBe(true);
    expect(hasPermission(user('COORDENADOR'), 'calendar:create')).toBe(true);
    expect(hasPermission(user('COORDENADOR'), 'calendar:update')).toBe(true);
    expect(hasPermission(user('COORDENADOR'), 'calendar:delete')).toBe(true);
  });

  it('coordenador NÃO pode criar/encerrar enquetes (regra não-monotônica)', () => {
    // Req 16.1 / 16.5: enquetes são exclusivas de Diretor e Gerente.
    // Coordenador, embora opere comunicados, fica de fora — checagem
    // explícita para travar essa exceção da hierarquia.
    expect(hasPermission(user('COORDENADOR'), 'poll:create')).toBe(false);
    expect(hasPermission(user('COORDENADOR'), 'poll:close')).toBe(false);
  });

  it('gerente pode criar/encerrar enquetes mas não cria metas', () => {
    // Diretor e Gerente operam enquetes (Req 16.1), mas só Diretor cria
    // metas (Req 9.1). Esta checagem cobre a fronteira clássica entre
    // "gestão tática" (Gerente) e "gestão estratégica" (Diretor).
    expect(hasPermission(user('GERENTE'), 'poll:create')).toBe(true);
    expect(hasPermission(user('GERENTE'), 'poll:close')).toBe(true);
    expect(hasPermission(user('GERENTE'), 'goal:create')).toBe(false);
    expect(hasPermission(user('GERENTE'), 'goal:updateProgress')).toBe(false);
  });

  it('diretor cria metas, atualiza progresso e mantém o portfólio', () => {
    expect(hasPermission(user('DIRETOR'), 'goal:create')).toBe(true);
    expect(hasPermission(user('DIRETOR'), 'goal:updateProgress')).toBe(true);
    expect(hasPermission(user('DIRETOR'), 'service:write')).toBe(true);
  });

  it('apenas admin altera status de projetos, configura KPIs e gerencia usuários', () => {
    // Conjunto de ações estritamente administrativas (Req 4.1, 10.5,
    // 14.4). Verificamos que TODOS os papéis abaixo de Admin são
    // negados — defesa contra alguém ampliar a matriz acidentalmente.
    const adminOnly: Action[] = [
      'project:updateStatus',
      'kpi:write',
      'user:manage',
      'user:approve',
      'user:create',
      'member:manage',
      'admin:access',
    ];
    for (const action of adminOnly) {
      expect(hasPermission(user('ADMIN'), action)).toBe(true);
      for (const role of ROLES.filter((r) => r !== 'ADMIN')) {
        expect(hasPermission(user(role), action)).toBe(false);
      }
    }
  });
});

describe('hasPermission — predicados de área (Gestão de Pessoas)', () => {
  it('infraction:create é permitido a qualquer membro de GP, mesmo MEMBRO', () => {
    // Req 18.1: registro de infrações é responsabilidade da equipe GP,
    // independentemente do papel hierárquico. Um Membro de GP precisa
    // conseguir registrar.
    for (const role of ROLES) {
      expect(
        hasPermission(user(role, 'GESTAO_PESSOAS'), 'infraction:create'),
      ).toBe(true);
    }
  });

  it('infraction:create é negado a usuários fora da área GP, exceto ADMIN', () => {
    // Diretor sem GP não pode registrar (a permissão aqui é por área,
    // não por hierarquia). Apenas Admin passa pelo override.
    for (const area of [...NON_GP_AREAS, null]) {
      expect(hasPermission(user('ADMIN', area), 'infraction:create')).toBe(true);
      for (const role of ROLES.filter((r) => r !== 'ADMIN')) {
        expect(hasPermission(user(role, area), 'infraction:create')).toBe(false);
      }
    }
  });

  it('infraction:delete é permitido a Diretor+ via matriz e a membros de GP via predicado', () => {
    // Req 18.7: exclusão de infrações é OU(Diretor+, GP). A matriz cobre
    // Diretor/Admin; o predicado cobre todos os membros de GP.
    expect(hasPermission(user('DIRETOR', 'VENDAS'), 'infraction:delete')).toBe(true);
    expect(hasPermission(user('ADMIN', null), 'infraction:delete')).toBe(true);
    expect(
      hasPermission(user('MEMBRO', 'GESTAO_PESSOAS'), 'infraction:delete'),
    ).toBe(true);
    expect(
      hasPermission(user('COORDENADOR', 'GESTAO_PESSOAS'), 'infraction:delete'),
    ).toBe(true);

    // Membro fora de GP não passa por nenhum dos dois caminhos.
    expect(
      hasPermission(user('MEMBRO', 'VENDAS'), 'infraction:delete'),
    ).toBe(false);
    expect(
      hasPermission(user('GERENTE', 'MARKETING'), 'infraction:delete'),
    ).toBe(false);
  });
});
