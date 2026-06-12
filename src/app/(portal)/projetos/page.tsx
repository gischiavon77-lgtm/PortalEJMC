import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProjectsShell } from '@/components/projetos/ProjectsShell';

/**
 * `/projetos` — Listagem de projetos (redesenhada).
 *
 * Server Component que carrega os projetos diretamente do Prisma,
 * ordenados por nome, e entrega ao `ProjectsShell` client-side.
 */

export const metadata: Metadata = {
  title: 'Projetos',
  description: 'Listagem de projetos do Portal Interno EJMC.',
};

export const dynamic = 'force-dynamic';

export interface ProjectItem {
  id: string;
  name: string;
  ferramenta: string;
  progress: number;
  team: string;
  price: number;
  proposalUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export default async function ProjetosPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  let projects: ProjectItem[] = [];
  try {
    const raw = await prisma.project.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        ferramenta: true,
        progress: true,
        team: true,
        price: true,
        proposalUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    projects = raw.map((p) => ({
      id: p.id,
      name: p.name,
      ferramenta: p.ferramenta,
      progress: p.progress,
      team: p.team,
      price: Number(p.price),
      proposalUrl: p.proposalUrl,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    }));
  } catch (err) {
    console.error('[projetos] DB error:', err);
    projects = [];
  }

  return <ProjectsShell projects={projects} />;
}
