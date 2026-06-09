import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import type { AccountStatus, UserRole, Area } from '@prisma/client';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/permissions';
import { AdminShell, type StatusTab } from '@/components/admin/AdminShell';

/**
 * `/admin` — Gerenciamento de contas (Tasks 19.1–19.8).
 *
 * Server Component que:
 *   1. Verifica se o usuário é Admin (proteção em profundidade).
 *   2. Lê o parâmetro ?status= para determinar a aba ativa.
 *   3. Busca os usuários filtrados por status no Prisma.
 *   4. Entrega ao `AdminShell` (client) para interatividade.
 */

export const metadata: Metadata = {
  title: 'Admin — Gerenciar Contas',
  description: 'Gerenciamento de contas de usuários do Portal Interno EJMC.',
};

export const dynamic = 'force-dynamic';

interface AdminPageProps {
  searchParams?: Promise<{ status?: string | string[] }> | { status?: string | string[] };
}

const VALID_TABS: StatusTab[] = ['PENDING', 'ACTIVE', 'INACTIVE'];

function parseStatusParam(raw: string | string[] | undefined): StatusTab {
  if (!raw) return 'PENDING';
  const str = Array.isArray(raw) ? raw[0] : raw;
  const upper = str.toUpperCase() as StatusTab;
  if (VALID_TABS.includes(upper)) return upper;
  return 'PENDING';
}

export default async function AdminPage(props: AdminPageProps) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // Proteção de permissão no server-side
  if (!hasPermission(session.user, 'admin:access')) {
    redirect('/403');
  }

  const search = (await Promise.resolve(props.searchParams)) ?? {};
  const currentTab = parseStatusParam(search.status);

  let serialized: {
    id: string;
    name: string;
    email: string;
    role: UserRole;
    status: string;
    area: Area | null;
    createdAt: string;
  }[] = [];
  try {
    // Buscar usuários filtrados por status
    const users = await prisma.user.findMany({
      where: { status: currentTab as AccountStatus },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        area: true,
        createdAt: true,
      },
    });

    serialized = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      status: u.status,
      area: u.area,
      createdAt: u.createdAt.toISOString(),
    }));
  } catch (err) {
    console.error('[admin] DB error:', err);
    serialized = [];
  }

  return <AdminShell users={serialized} currentTab={currentTab} />;
}
