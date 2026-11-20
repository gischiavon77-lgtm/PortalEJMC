/**
 * Organograma da tela "Estrutura" (Fase 5 da reforma) — funções puras.
 *
 * A estrutura é gerada a partir dos usuários ATIVOS com área (a consulta
 * fica em `src/lib/structure.ts`). Quem não tem área (ex.: o admin do
 * seed) não aparece em nenhuma área nem entra na contagem.
 *
 * Camadas, de cima para baixo:
 *   Diretoria (DIRETOR e ADMIN com área) > Gerência > Coordenação > Membros.
 * O nível MEMBRO cobre trainees e assessores; o card mostra o cargo.
 *
 * Sem banco e sem React, para poder ser coberto por teste de propriedade.
 */

import type { Area, UserRole } from '@prisma/client';

// ─── Áreas ──────────────────────────────────────────────────────────

/** Ordem das áreas na tela (Presidência primeiro). */
export const ORG_AREAS: readonly Area[] = [
  'PRESIDENCIA',
  'VENDAS',
  'PROJETOS',
  'MARKETING',
  'GESTAO_PESSOAS',
  'ADM_FIN',
];

/** Endereço de cada área: `/estrutura/<slug>`. */
export const AREA_SLUGS: Record<Area, string> = {
  PRESIDENCIA: 'presidencia',
  VENDAS: 'vendas',
  PROJETOS: 'projetos',
  MARKETING: 'marketing',
  GESTAO_PESSOAS: 'gestao-de-pessoas',
  ADM_FIN: 'adm-fin',
};

export function areaFromSlug(slug: string): Area | null {
  const entry = Object.entries(AREA_SLUGS).find(([, s]) => s === slug);
  return entry ? (entry[0] as Area) : null;
}

// ─── Camadas ────────────────────────────────────────────────────────

export type OrgLevel = 'DIRETORIA' | 'GERENCIA' | 'COORDENACAO' | 'MEMBROS';

export const ORG_LEVELS: readonly {
  level: OrgLevel;
  label: string;
  roles: readonly UserRole[];
}[] = [
  { level: 'DIRETORIA', label: 'Diretoria', roles: ['ADMIN', 'DIRETOR'] },
  { level: 'GERENCIA', label: 'Gerência', roles: ['GERENTE'] },
  { level: 'COORDENACAO', label: 'Coordenação', roles: ['COORDENADOR'] },
  { level: 'MEMBROS', label: 'Membros', roles: ['MEMBRO'] },
];

export function levelOf(role: UserRole): OrgLevel {
  return ORG_LEVELS.find((l) => l.roles.includes(role))?.level ?? 'MEMBROS';
}

// ─── Montagem ───────────────────────────────────────────────────────

/** O mínimo que o organograma precisa de cada pessoa. */
export interface OrgPersonInput {
  id: string;
  name: string;
  role: UserRole;
  area: Area | null;
}

export interface OrgLayer<P extends OrgPersonInput> {
  level: OrgLevel;
  label: string;
  people: P[];
}

function byName(a: { name: string }, b: { name: string }): number {
  return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
}

/**
 * Camadas do organograma de uma área, de cima para baixo, só as que têm
 * alguém. Dentro de cada camada, nomes em ordem alfabética (pt-BR).
 */
export function buildAreaChart<P extends OrgPersonInput>(
  people: readonly P[],
  area: Area,
): OrgLayer<P>[] {
  const inArea = people.filter((p) => p.area === area);
  return ORG_LEVELS.map(({ level, label }) => ({
    level,
    label,
    people: inArea.filter((p) => levelOf(p.role) === level).sort(byName),
  })).filter((layer) => layer.people.length > 0);
}

export interface StructureOverview {
  /** Pessoas com área (as que aparecem na Estrutura). */
  totalMembers: number;
  /** Número de áreas (sempre as seis, mesmo vazias). */
  totalAreas: number;
  areas: { area: Area; slug: string; count: number }[];
}

/** Números da visão geral: total e contagem por área, na ordem de `ORG_AREAS`. */
export function computeStructureOverview(people: readonly OrgPersonInput[]): StructureOverview {
  const areas = ORG_AREAS.map((area) => ({
    area,
    slug: AREA_SLUGS[area],
    count: people.filter((p) => p.area === area).length,
  }));
  return {
    totalMembers: areas.reduce((sum, a) => sum + a.count, 0),
    totalAreas: ORG_AREAS.length,
    areas,
  };
}
