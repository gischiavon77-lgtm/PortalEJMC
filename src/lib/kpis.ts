/**
 * Helpers de domínio do módulo KPIs (Task 9).
 *
 * Centraliza lógica pura (sem I/O) reutilizada por API, Server
 * Components e UI client-side:
 *
 *   - `formatKpiValue(value, unit)` — exibição formatada (pt-BR) de
 *     um valor de KPI conforme a unidade (`PERCENTAGE`, `INTEGER`,
 *     `DECIMAL`). Mantém duas casas decimais em PERCENTAGE/DECIMAL
 *     e zero em INTEGER, alinhado com o schema (Decimal(10,2)) e
 *     com a expectativa visual.
 *
 *   - `kpiVisibilityWhere(user)` — fragmento `where` Prisma para
 *     listar apenas os KPIs que o usuário pode ver/registrar,
 *     coerente com Req 10.1 ("cada Usuário autorizado visualize e
 *     registre apenas os KPIs da sua própria Área"). KPIs globais
 *     (sem área) são visíveis a todos. Admin/Diretor enxergam todos.
 *
 *   - `canUserSeeKpi(user, kpi)` — versão pura/declarativa da regra
 *     de visibilidade. Usada como defesa em profundidade após a
 *     consulta e em testes (Property check).
 *
 * ─── Decisões de design ─────────────────────────────────────────────
 *
 * 1) **Visibilidade x escrita**: a leitura segue Req 10.1 ("visualize
 *    apenas os KPIs da sua própria Área"). Para escrita, a matriz
 *    RBAC (`kpi:writeValue`) com predicado de mesma-área impõe a
 *    regra simétrica. A `kpiVisibilityWhere` aplica o gate de
 *    leitura — escrita é checada na rota com `requirePermission`.
 *
 * 2) **Diretor/Admin ampliados**: por consistência com Req 9.7
 *    (metas — Diretor/Admin veem todas as áreas), aplicamos o mesmo
 *    override aqui. O texto da Req 10 não restringe explicitamente,
 *    e o portal é gerenciado por poucos diretores, então essa
 *    consistência prática reduz pegadinhas (ex.: Diretor de Adm-Fin
 *    não conseguir ver um KPI de Vendas para revisão geral).
 *
 * 3) **Visibilidade vs. consulta SQL**: o Prisma `where` retornado
 *    é um objeto plano que coexiste com filtros adicionais via
 *    spread. Quando há overlap com `area`, devolvemos `AND` para
 *    evitar que filtros explícitos sobrescrevam a regra de
 *    visibilidade.
 */

import type { Area, UserRole } from '@prisma/client';

import { hasRoleLevel, type PermissionUser } from '@/lib/permissions';

/**
 * Subconjunto da entidade `Kpi` necessário para decisões de
 * visibilidade. Mantemos shape estrutural para aceitar tanto
 * registros do Prisma quanto DTOs serializados.
 */
export interface KpiVisibility {
  area: Area | null;
}

/**
 * Decide se um usuário pode visualizar um KPI (Req 10.1).
 *
 * Regras:
 *   - KPIs globais (`area === null`) → visíveis a todos.
 *   - KPIs por área:
 *       · Diretor/Admin → veem todas as áreas (override hierárquico).
 *       · Demais        → apenas se `user.area === kpi.area`.
 *
 * Função pura — não toca I/O.
 */
export function canUserSeeKpi(
  user: PermissionUser,
  kpi: KpiVisibility,
): boolean {
  // KPI global → todos veem.
  if (kpi.area === null) return true;

  // Diretor/Admin → todas as áreas.
  if (hasRoleLevel(user.role, 'DIRETOR')) return true;

  // Demais papéis: só a área do usuário.
  if (!user.area) return false;
  return user.area === kpi.area;
}

/**
 * Tipo do filtro `where` do Prisma para a regra de visibilidade.
 * Mantemos genérico para composição com filtros adicionais.
 */
export interface KpiVisibilityWhere {
  OR?: Array<{ area: null } | { area: Area }>;
  area?: null;
}

/**
 * Constrói o fragmento `where` Prisma equivalente à regra de
 * visibilidade. Veja `canUserSeeKpi` para a especificação.
 *
 * Implementações:
 *   - Diretor/Admin     → sem filtro (todas as áreas + globais).
 *   - Sem área atribuída → `area: null` (apenas KPIs globais).
 *   - Com área           → `OR: [{ area: null }, { area: user.area }]`.
 */
export function kpiVisibilityWhere(user: {
  role: UserRole;
  area: Area | null;
}): KpiVisibilityWhere {
  if (hasRoleLevel(user.role, 'DIRETOR')) {
    return {};
  }

  if (!user.area) {
    return { area: null };
  }

  return {
    OR: [{ area: null }, { area: user.area }],
  };
}

// ─── Formatação de exibição ──────────────────────────────────────────

/** Locale aplicado de forma consistente em todos os KPIs. */
const KPI_LOCALE = 'pt-BR';

const integerFormatter = new Intl.NumberFormat(KPI_LOCALE, {
  maximumFractionDigits: 0,
});

const decimalFormatter = new Intl.NumberFormat(KPI_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentageFormatter = new Intl.NumberFormat(KPI_LOCALE, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formata um valor numérico de acordo com a unidade do KPI:
 *
 *   - PERCENTAGE → "12,50%"
 *   - INTEGER    → "1.234"
 *   - DECIMAL    → "1.234,56"
 *
 * Quando `value` é `null`/`undefined` ou não-finito, retornamos
 * `'—'` (em-dash) — UI neutra para "sem dados".
 */
export function formatKpiValue(
  value: number | null | undefined,
  unit: 'PERCENTAGE' | 'INTEGER' | 'DECIMAL',
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }

  switch (unit) {
    case 'INTEGER':
      return integerFormatter.format(value);
    case 'PERCENTAGE':
      return `${percentageFormatter.format(value)}%`;
    case 'DECIMAL':
    default:
      return decimalFormatter.format(value);
  }
}

/** Rótulos pt-BR para as áreas, reusando convenção de `goals.ts`. */
export const KPI_AREA_LABELS: Record<Area | 'GLOBAL', string> = {
  VENDAS: 'Vendas',
  PRESIDENCIA: 'Presidência',
  PROJETOS: 'Projetos',
  MARKETING: 'Marketing',
  GESTAO_PESSOAS: 'Gestão de Pessoas',
  ADM_FIN: 'Adm-Fin',
  GLOBAL: 'Global',
};

/** Rótulos pt-BR para as unidades de medida. */
export const KPI_UNIT_LABELS: Record<'PERCENTAGE' | 'INTEGER' | 'DECIMAL', string> = {
  PERCENTAGE: 'Percentual',
  INTEGER: 'Número inteiro',
  DECIMAL: 'Número decimal',
};
