/**
 * Projetos no estilo "Radar" (Fase 3 da reforma) — leitura e formato público.
 *
 * Dois formatos:
 *   - `ProjectItem`   → listagem e cards. NUNCA traz preço nem informação
 *                       de proposta, para ninguém.
 *   - `ProjectDetail` → "Ver detalhes". Inclui `management` (preço e se há
 *                       proposta) só quando quem vê tem `project:write`.
 *
 * Os caminhos no Storage (banner, proposta) nunca vão ao cliente: o
 * banner vira `bannerUrl` (`/api/files/projeto/:id`) e a proposta é
 * baixada em `/api/projects/:id/proposal`, que confere a permissão.
 *
 * A equipe é o vínculo `ProjectMember` com usuários. Só membros ATIVOS
 * aparecem (quem foi desativado continua ligado, mas some da tela).
 */

import type { Area, Prisma, ProjectStatus, UserRole } from '@prisma/client';

import { avatarUrlFor, projectBannerUrlFor } from '@/lib/file-urls';
import { hasPermission, type PermissionUser } from '@/lib/permissions';
import { effectivePosition } from '@/lib/position';
import { prisma } from '@/lib/prisma';

export interface ProjectMemberItem {
  id: string;
  name: string;
  /** Cargo exibido (MEMBRO aparece como "Trainee"). */
  position: string;
  area: Area | null;
  avatarUrl: string | null;
}

export interface ProjectItem {
  id: string;
  name: string;
  ferramenta: string;
  description: string;
  status: ProjectStatus;
  bannerUrl: string | null;
  members: ProjectMemberItem[];
  createdAt: string;
  updatedAt: string;
}

export interface ProjectManagementInfo {
  price: number;
  hasProposal: boolean;
}

export interface ProjectDetail extends ProjectItem {
  /** Só para quem tem `project:write`; `null` para os demais. */
  management: ProjectManagementInfo | null;
}

export interface ProjectStats {
  inProgress: number;
  completed: number;
  /** Pessoas distintas (ativas) nos projetos em andamento. */
  peopleInvolved: number;
}

/** Campos lidos do banco para montar o formato público. */
export const PROJECT_SELECT = {
  id: true,
  name: true,
  ferramenta: true,
  description: true,
  status: true,
  bannerPath: true,
  createdAt: true,
  updatedAt: true,
  members: {
    where: { user: { status: 'ACTIVE' } },
    orderBy: { user: { name: 'asc' } },
    select: {
      user: {
        select: { id: true, name: true, role: true, position: true, area: true, avatarPath: true },
      },
    },
  },
} as const satisfies Prisma.ProjectSelect;

/** Igual a `PROJECT_SELECT`, mais o que só a gestão pode ver. */
export const PROJECT_DETAIL_SELECT = {
  ...PROJECT_SELECT,
  price: true,
  proposalPath: true,
} as const satisfies Prisma.ProjectSelect;

type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_SELECT }>;
type ProjectDetailRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_DETAIL_SELECT }>;

function serializeMember(user: {
  id: string;
  name: string;
  role: UserRole;
  position: string | null;
  area: Area | null;
  avatarPath: string | null;
}): ProjectMemberItem {
  return {
    id: user.id,
    name: user.name,
    position: effectivePosition(user.role, user.position),
    area: user.area,
    avatarUrl: avatarUrlFor(user.id, user.avatarPath),
  };
}

/** Formato da listagem. Função pura. Não lê preço nem proposta. */
export function serializeProject(row: ProjectRow): ProjectItem {
  return {
    id: row.id,
    name: row.name,
    ferramenta: row.ferramenta,
    description: row.description,
    status: row.status,
    bannerUrl: projectBannerUrlFor(row.id, row.bannerPath),
    members: row.members.map((m) => serializeMember(m.user)),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Formato de detalhes. Preço e proposta só se `viewer` tem `project:write`. */
export function serializeProjectDetail(
  row: ProjectDetailRow,
  viewer: PermissionUser,
): ProjectDetail {
  const canManage = hasPermission(viewer, 'project:write');
  return {
    ...serializeProject(row),
    management: canManage
      ? { price: Number(row.price), hasProposal: Boolean(row.proposalPath) }
      : null,
  };
}

/**
 * Números do topo da página. Função pura: recebe status e ids de membros
 * (já filtrados para ativos) de cada projeto.
 */
export function computeProjectStats(
  projects: { status: ProjectStatus; memberIds: string[] }[],
): ProjectStats {
  const people = new Set<string>();
  let inProgress = 0;
  let completed = 0;
  for (const p of projects) {
    if (p.status === 'CONCLUIDO') {
      completed += 1;
    } else {
      inProgress += 1;
      p.memberIds.forEach((id) => people.add(id));
    }
  }
  return { inProgress, completed, peopleInvolved: people.size };
}

/** Todos os projetos (ordem alfabética) e os números do topo. */
export async function listProjects(): Promise<{ projects: ProjectItem[]; stats: ProjectStats }> {
  const rows = await prisma.project.findMany({ orderBy: { name: 'asc' }, select: PROJECT_SELECT });
  const projects = rows.map(serializeProject);
  const stats = computeProjectStats(
    projects.map((p) => ({ status: p.status, memberIds: p.members.map((m) => m.id) })),
  );
  return { projects, stats };
}

/** Detalhes de um projeto, ou `null` se não existe. */
export async function getProjectDetail(
  id: string,
  viewer: PermissionUser,
): Promise<ProjectDetail | null> {
  const row = await prisma.project.findUnique({ where: { id }, select: PROJECT_DETAIL_SELECT });
  return row ? serializeProjectDetail(row, viewer) : null;
}

/**
 * Confere que todos os ids são de usuários ATIVOS. Devolve os ids
 * inválidos (vazio quando está tudo certo).
 */
export async function findInvalidMemberIds(ids: string[]): Promise<string[]> {
  if (ids.length === 0) return [];
  const found = await prisma.user.findMany({
    where: { id: { in: ids }, status: 'ACTIVE' },
    select: { id: true },
  });
  const ok = new Set(found.map((u) => u.id));
  return ids.filter((id) => !ok.has(id));
}
