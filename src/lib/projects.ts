/**
 * Formato público de um projeto (API e página `/projetos`).
 *
 * O PDF da proposta fica no bucket privado do Storage e o banco guarda
 * só o caminho (`proposalPath`). Nem o conteúdo nem o caminho vão para
 * o cliente: a listagem informa apenas `hasProposal`, e o arquivo é
 * baixado sob demanda em `GET /api/projects/:id/proposal`, que exige a
 * permissão `project:readProposal`.
 */

import type { Prisma } from '@prisma/client';

/** Campos lidos do banco para montar o item público. */
export const PROJECT_PUBLIC_SELECT = {
  id: true,
  name: true,
  ferramenta: true,
  progress: true,
  team: true,
  price: true,
  proposalPath: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ProjectSelect;

type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof PROJECT_PUBLIC_SELECT }>;

export interface ProjectItem {
  id: string;
  name: string;
  ferramenta: string;
  progress: number;
  team: string;
  price: number;
  /** `true` quando há proposta (PDF) anexada. O arquivo não vem na listagem. */
  hasProposal: boolean;
  createdAt: string;
  updatedAt: string;
}

export function serializeProject(project: ProjectRow): ProjectItem {
  return {
    id: project.id,
    name: project.name,
    ferramenta: project.ferramenta,
    progress: project.progress,
    team: project.team,
    price: Number(project.price),
    hasProposal: Boolean(project.proposalPath),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}
