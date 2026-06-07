import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { ProjectStatus } from '@prisma/client';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProjectsShell } from '@/components/projetos/ProjectsShell';
import type { ProjectItem } from '@/components/projetos/ProjectsList';

/**
 * `/projetos` — Listagem de projetos (Task 13.3, 13.6).
 *
 * Server Component que carrega os projetos diretamente do Prisma com
 * paginação (50 por página), filtro por status e ordenação alfabética,
 * entregando ao `ProjectsShell` client-side para interatividade.
 *
 * ─── Filtro por status (Task 13.2) ────────────────────────────────
 *
 * Aceita `?status=<ProjectStatus>` na URL. Quando ausente, traz todos.
 * Status inválidos degradam para "Todos" (sem derrubar a página).
 *
 * ─── Empty-state (Task 13.6) ──────────────────────────────────────
 *
 * O shell exibe mensagem contextual quando o filtro não retorna
 * resultados: "Nenhum projeto encontrado com o status selecionado."
 */

const PAGE_SIZE = 50;

const VALID_STATUSES = new Set<ProjectStatus>([
  'EM_ANDAMENTO',
  'CONCLUIDO',
  'CONGELADO',
  'CANCELADO',
]);

export const metadata: Metadata = {
  title: 'Projetos',
  description: 'Listagem de projetos do Portal Interno EJMC.',
};

export const dynamic = 'force-dynamic';

interface ProjetosPageProps {
  searchParams?:
    | Promise<{ status?: string | string[]; page?: string | string[] }>
    | { status?: string | string[]; page?: string | string[] };
}

function normalizeStatus(raw: string | undefined): ProjectStatus | null {
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (VALID_STATUSES.has(upper as ProjectStatus)) {
    return upper as ProjectStatus;
  }
  return null;
}

function parsePageParam(raw: string | string[] | undefined): number {
  if (!raw) return 1;
  const str = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseInt(str, 10);
  if (isNaN(parsed) || parsed < 1) return 1;
  return parsed;
}

export default async function ProjetosPage(props: ProjetosPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const search = (await Promise.resolve(props.searchParams)) ?? {};
  const rawStatus = Array.isArray(search.status) ? search.status[0] : search.status;
  const currentStatus = normalizeStatus(rawStatus);
  const page = parsePageParam(search.page);
  const skip = (page - 1) * PAGE_SIZE;

  const where: { status?: ProjectStatus } = {};
  if (currentStatus) {
    where.status = currentStatus;
  }

  const [projects, total] = await Promise.all([
    prisma.project.findMany({
      where,
      orderBy: { name: 'asc' },
      skip,
      take: PAGE_SIZE,
      select: {
        id: true,
        name: true,
        status: true,
        createdAt: true,
      },
    }),
    prisma.project.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const serialized: ProjectItem[] = projects
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
    .map((p) => ({
      id: p.id,
      name: p.name,
      status: p.status,
      createdAt: p.createdAt.toISOString(),
    }));

  return (
    <ProjectsShell
      projects={serialized}
      currentStatus={currentStatus}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
      }}
    />
  );
}
