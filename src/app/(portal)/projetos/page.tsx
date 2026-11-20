/**
 * `/projetos` — projetos no estilo "Radar" (Fase 3 da reforma).
 *
 * Server Component: carrega todos os projetos e os números do topo
 * (`listProjects`) e entrega ao `ProjectsShell`. A listagem nunca traz
 * preço nem proposta; isso só aparece nos detalhes, para a gestão.
 */

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ProjectsShell } from '@/components/projetos/ProjectsShell';
import { auth } from '@/lib/auth';
import { listProjects, type ProjectItem, type ProjectStats } from '@/lib/projects';

export const metadata: Metadata = {
  title: 'Projetos',
  description: 'Projetos da EJMC.',
};

export const dynamic = 'force-dynamic';

export default async function ProjetosPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  let projects: ProjectItem[] = [];
  let stats: ProjectStats = { inProgress: 0, completed: 0, peopleInvolved: 0 };
  try {
    ({ projects, stats } = await listProjects());
  } catch (err) {
    console.error('[projetos] DB error:', err);
  }

  return <ProjectsShell projects={projects} stats={stats} />;
}
