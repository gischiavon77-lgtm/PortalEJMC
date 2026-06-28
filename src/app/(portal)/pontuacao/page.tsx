import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission, type PermissionUser } from '@/lib/permissions';
import { getCurrentSemester } from '@/lib/validators/score';
import { PontuacaoShell } from '@/components/pontuacao/PontuacaoShell';

/**
 * `/pontuacao` — Página de Pontuação / Infrações (Task 16.4).
 *
 * Server Component que carrega as infrações do usuário logado (ou de
 * todos os membros, se GP/Diretor) para o semestre vigente.
 */

export const metadata: Metadata = {
  title: 'Pontuação',
  description: 'Controle de pontuação e infrações do Portal Interno EJMC.',
};

export const dynamic = 'force-dynamic';

export interface InfractionItem {
  id: string;
  type: 'ATRASO' | 'FALTA' | 'DRESS_CODE';
  date: string;
  points: number;
  target: { id: string; name: string };
  createdBy: { id: string; name: string };
  createdAt: string;
}

export interface MemberScore {
  id: string;
  name: string;
  area: string | null;
  totalPoints: number;
}

export default async function PontuacaoPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  // Lê role + área ATUAIS do banco (não da sessão, que pode estar
  // desatualizada se a área foi alterada após o login). Garante que
  // membros recém-movidos para Gestão de Pessoas vejam/registrem pontos
  // sem precisar relogar.
  const dbUser = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { role: true, area: true },
  });

  const permUser: PermissionUser = {
    role: dbUser?.role ?? session.user.role,
    area: dbUser?.area ?? session.user.area,
  };

  const canViewAll = hasPermission(permUser, 'infraction:delete');
  const canCreate = hasPermission(permUser, 'infraction:create');

  const semester = getCurrentSemester();

  let ownSerialized: InfractionItem[] = [];
  let ownTotalPoints = 0;
  let allMembers: MemberScore[] = [];
  let activeUsers: { id: string; name: string }[] = [];

  try {
    // Load own infractions (all users see their own)
    const ownInfractions = await prisma.infraction.findMany({
      where: {
        userId: session.user.id,
        semester,
      },
      orderBy: { occurredAt: 'desc' },
      include: {
        createdBy: { select: { id: true, name: true } },
        target: { select: { id: true, name: true } },
      },
    });

    ownSerialized = ownInfractions.map((inf) => ({
      id: inf.id,
      type: inf.type,
      date: inf.occurredAt.toISOString(),
      points: inf.points,
      target: { id: inf.target.id, name: inf.target.name },
      createdBy: { id: inf.createdBy.id, name: inf.createdBy.name },
      createdAt: inf.createdAt.toISOString(),
    }));

    ownTotalPoints = ownInfractions.reduce((sum, inf) => sum + inf.points, 0);

    // Load all members' scores if GP/Diretor
    if (canViewAll) {
      const users = await prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          area: true,
          infractions: {
            where: { semester },
            select: { points: true },
          },
        },
        orderBy: { name: 'asc' },
      });

      allMembers = users.map((user) => ({
        id: user.id,
        name: user.name,
        area: user.area,
        totalPoints: user.infractions.reduce(
          (sum: number, inf: { points: number }) => sum + inf.points,
          0,
        ),
      }));
    }

    // Load active users for infraction form (GP only)
    if (canCreate) {
      activeUsers = await prisma.user.findMany({
        where: { status: 'ACTIVE' },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      });
    }
  } catch (err) {
    console.error('[pontuacao] DB error:', err);
    ownSerialized = [];
    ownTotalPoints = 0;
    allMembers = [];
    activeUsers = [];
  }

  return (
    <PontuacaoShell
      ownInfractions={ownSerialized}
      ownTotalPoints={ownTotalPoints}
      semester={semester}
      canViewAll={canViewAll}
      canCreate={canCreate}
      canDelete={canViewAll}
      allMembers={allMembers}
      activeUsers={activeUsers}
    />
  );
}
