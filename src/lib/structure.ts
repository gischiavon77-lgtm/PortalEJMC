/**
 * Dados da tela "Estrutura" (Fase 5 da reforma).
 *
 * Lê os usuários ATIVOS com área — conta aprovada aparece sozinha, conta
 * desativada some. Entrega só o que o card mostra: nome, papel, área,
 * cargo já resolvido (`effectivePosition`) e URL do avatar (a rota de
 * download; o caminho do bucket nunca vai ao cliente).
 *
 * A montagem das camadas é pura e fica em `src/lib/org-chart.ts`.
 */

import type { Area, UserRole } from '@prisma/client';

import { avatarUrlFor } from '@/lib/file-urls';
import { effectivePosition } from '@/lib/position';
import { prisma } from '@/lib/prisma';

export interface StructurePerson {
  id: string;
  name: string;
  role: UserRole;
  area: Area;
  position: string;
  avatarUrl: string | null;
}

export async function getStructurePeople(area?: Area): Promise<StructurePerson[]> {
  const rows = await prisma.user.findMany({
    where: { status: 'ACTIVE', area: area ?? { not: null } },
    select: { id: true, name: true, role: true, area: true, position: true, avatarPath: true },
  });
  return rows
    .filter((r): r is typeof r & { area: Area } => r.area !== null)
    .map((r) => ({
      id: r.id,
      name: r.name,
      role: r.role,
      area: r.area,
      position: effectivePosition(r.role, r.position),
      avatarUrl: avatarUrlFor(r.id, r.avatarPath),
    }));
}
