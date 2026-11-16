import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PROJECT_PUBLIC_SELECT, serializeProject, type ProjectItem } from '@/lib/projects';
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

export default async function ProjetosPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  let projects: ProjectItem[] = [];
  try {
    const raw = await prisma.project.findMany({
      orderBy: { name: 'asc' },
      select: PROJECT_PUBLIC_SELECT,
    });

    // Só `hasProposal` vai para o cliente; o PDF é baixado sob demanda.
    projects = raw.map(serializeProject);
  } catch (err) {
    console.error('[projetos] DB error:', err);
    projects = [];
  }

  return <ProjectsShell projects={projects} />;
}
