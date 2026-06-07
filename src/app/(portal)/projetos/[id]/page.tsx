import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ProjectDetail, type ProjectDetailData } from '@/components/projetos/ProjectDetail';

/**
 * `/projetos/[id]` — Detalhes do projeto (Task 13.4, 13.5).
 *
 * Server Component que carrega o projeto completo (nome, descrição,
 * equipe, status, histórico) e entrega ao `ProjectDetail` client-side
 * que adiciona a funcionalidade de alteração de status para admins.
 */

export const metadata: Metadata = {
  title: 'Detalhes do Projeto',
  description: 'Detalhes completos de um projeto no Portal Interno EJMC.',
};

export const dynamic = 'force-dynamic';

interface ProjetoDetailPageProps {
  params?: Promise<{ id: string }> | { id: string };
}

export default async function ProjetoDetailPage(props: ProjetoDetailPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const resolvedParams = await Promise.resolve(props.params);
  const id = resolvedParams?.id;

  if (!id) {
    notFound();
  }

  const project = await prisma.project.findUnique({
    where: { id },
    include: {
      members: {
        include: {
          user: {
            select: {
              id: true,
              name: true,
              area: true,
              position: true,
            },
          },
        },
      },
      statusHistory: {
        orderBy: { changedAt: 'desc' },
        select: {
          id: true,
          oldStatus: true,
          newStatus: true,
          changedById: true,
          changedAt: true,
        },
      },
    },
  });

  if (!project) {
    notFound();
  }

  // Resolve changedBy names for status history
  const changedByIdSet = new Set(project.statusHistory.map((h) => h.changedById));
  const changedByIds = Array.from(changedByIdSet);
  const changedByUsers = await prisma.user.findMany({
    where: { id: { in: changedByIds } },
    select: { id: true, name: true },
  });
  const changedByMap = new Map(changedByUsers.map((u) => [u.id, u.name]));

  const serialized: ProjectDetailData = {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    members: project.members.map((m) => ({
      id: m.user.id,
      name: m.user.name,
      area: m.user.area,
      position: m.user.position,
    })),
    statusHistory: project.statusHistory.map((h) => ({
      id: h.id,
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      changedBy: changedByMap.get(h.changedById) ?? 'Desconhecido',
      changedAt: h.changedAt.toISOString(),
    })),
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };

  return <ProjectDetail project={serialized} />;
}
