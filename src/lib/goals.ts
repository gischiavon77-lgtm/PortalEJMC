/**
 * Helpers de domínio do módulo Metas (Task 8).
 *
 * Centraliza decisões puras (sem I/O) que são reutilizadas por API,
 * Server Components e UI client-side:
 *
 *   - `canUserSeeGoal(user, goal)` — implementa a regra de visibilidade
 *     da Req 9.7 / Property 9: metas gerais visíveis a todos; metas
 *     por área visíveis apenas para usuários daquela área e para
 *     Diretor/Admin (que enxergam todas as áreas).
 *
 *   - `isGoalOverdue(goal, now?)` — marca uma meta como vencida quando
 *     o prazo já passou E o progresso é inferior a 100% (Req 9.5 /
 *     Property 10).
 *
 *   - `goalVisibilityWhere(user)` — devolve um fragmento de filtro
 *     Prisma equivalente à regra de visibilidade. Permite aplicar a
 *     mesma regra direto na consulta (`prisma.goal.findMany`) sem
 *     puxar todas as metas e filtrar em memória.
 *
 * ─── Por que separar visibilidade em duas formas? ────────────────────
 *
 * `canUserSeeGoal` é a verdade pura/declarativa; serve a testes
 * (Property 9, Task 20.10) e a casos onde já temos a entidade em
 * memória (ex.: cache, pós-fetch). `goalVisibilityWhere` é a
 * tradução dessa mesma regra para o motor SQL — preserva
 * performance e evita duplicar a lógica em jeito SQL na rota.
 *
 * Para evitar drift entre as duas formas, a verdade canônica é
 * `canUserSeeGoal`. Há um teste (`tests/unit/goals.test.ts`,
 * adicionável na Task 20) que aplica `goalVisibilityWhere` em uma
 * lista in-memory e compara com o resultado de filtrar usando
 * `canUserSeeGoal`; qualquer divergência quebra o teste.
 */

import type { Area, UserRole } from '@prisma/client';

import { hasRoleLevel, type PermissionUser } from '@/lib/permissions';

/**
 * Subconjunto da entidade `Goal` necessário para decisões de
 * visibilidade/atraso. Mantemos um shape estrutural (em vez de
 * importar `Goal` do Prisma) para que callers possam passar tanto
 * registros do banco quanto DTOs já serializados (com strings ISO
 * em vez de `Date`).
 */
export interface GoalVisibility {
  type: 'GENERAL' | 'AREA';
  area: Area | null;
}

/**
 * Subconjunto necessário para `isGoalOverdue`. `deadline` aceita
 * `Date` ou string ISO — o helper normaliza internamente.
 */
export interface GoalOverdueInput {
  deadline: Date | string;
  progress: number;
}

/**
 * Decide se um usuário pode visualizar uma meta (Req 9.7 / Property 9).
 *
 * Regras:
 *   - Metas gerais (`type === 'GENERAL'`) → visíveis a qualquer
 *     usuário autenticado.
 *   - Metas por área (`type === 'AREA'`):
 *       · Diretor e Admin → veem todas as áreas (override hierárquico).
 *       · Demais usuários → veem apenas se `user.area === goal.area`.
 *
 * Usuários sem área atribuída (`user.area == null`) só conseguem
 * enxergar metas gerais — não há "área padrão" de fallback. Isso é
 * coerente com Req 9.7 ("Usuários daquela Área"): sem área, sem
 * pertencimento.
 *
 * Função pura — não toca I/O. Pode ser chamada em qualquer camada
 * (server/client/test).
 */
export function canUserSeeGoal(
  user: PermissionUser,
  goal: GoalVisibility,
): boolean {
  if (goal.type === 'GENERAL') return true;

  // A partir daqui é uma meta de área (`type === 'AREA'`).
  // Diretor/Admin veem todas as áreas (override hierárquico).
  if (hasRoleLevel(user.role, 'DIRETOR')) return true;

  // Demais papéis dependem do pertencimento à mesma área.
  if (!user.area || !goal.area) return false;
  return user.area === goal.area;
}

/**
 * Marca uma meta como vencida (Req 9.5 / Property 10).
 *
 * Definição (formal, da Property 10):
 *
 *     overdue ⇔ now > deadline ∧ progress < 100
 *
 * - `now > deadline` (estritamente). Uma meta cujo prazo é exatamente
 *   o instante atual ainda **não** está vencida — só fica vencida no
 *   próximo tick. Isso evita "flicker" no exato segundo do prazo.
 * - `progress < 100` (estritamente). Metas concluídas (100) nunca
 *   ficam marcadas como vencidas, mesmo que a entrega tenha sido
 *   atrasada — a Req 9.5 trata o indicador como "atraso pendente",
 *   não "atraso histórico".
 *
 * Aceita `now` como parâmetro para testabilidade determinística.
 */
export function isGoalOverdue(
  goal: GoalOverdueInput,
  now: Date = new Date(),
): boolean {
  const deadline =
    goal.deadline instanceof Date ? goal.deadline : new Date(goal.deadline);
  if (Number.isNaN(deadline.getTime())) return false;
  return now.getTime() > deadline.getTime() && goal.progress < 100;
}

/**
 * Tipo do filtro `where` aceito por `prisma.goal.findMany`/`count`
 * para a regra de visibilidade. Mantemos a forma genérica para que
 * a função possa ser composta com filtros adicionais do caller
 * (ex.: combinar com `?type=AREA` da query string).
 *
 * Forma final:
 *   - Diretor/Admin → sem filtro (todas as metas).
 *   - Sem área      → apenas `type === 'GENERAL'`.
 *   - Com área      → `type === 'GENERAL'` OU (`type === 'AREA'`
 *                     E `area === user.area`).
 */
export interface GoalVisibilityWhere {
  OR?: Array<
    | { type: 'GENERAL' }
    | { AND: [{ type: 'AREA' }, { area: Area }] }
  >;
  type?: 'GENERAL';
}

/**
 * Constrói o fragmento `where` Prisma equivalente à
 * regra de visibilidade. Veja documentação acima.
 */
export function goalVisibilityWhere(
  user: { role: UserRole; area: Area | null },
): GoalVisibilityWhere {
  // Diretor/Admin enxergam tudo — não impomos filtro.
  if (hasRoleLevel(user.role, 'DIRETOR')) {
    return {};
  }

  if (!user.area) {
    // Sem área atribuída: só metas gerais.
    return { type: 'GENERAL' };
  }

  return {
    OR: [
      { type: 'GENERAL' },
      { AND: [{ type: 'AREA' }, { area: user.area }] },
    ],
  };
}

// ─── Utilidades de exibição ──────────────────────────────────────────

/** Rótulos pt-BR para as áreas, usados por cards e formulários. */
export const AREA_LABELS: Record<Area, string> = {
  VENDAS: 'Vendas',
  PRESIDENCIA: 'Presidência',
  PROJETOS: 'Projetos',
  MARKETING: 'Marketing',
  GESTAO_PESSOAS: 'Gestão de Pessoas',
  ADM_FIN: 'Adm-Fin',
};

/** Rótulos pt-BR para os tipos de meta. */
export const GOAL_TYPE_LABELS: Record<'GENERAL' | 'AREA', string> = {
  GENERAL: 'Geral',
  AREA: 'Área',
};
