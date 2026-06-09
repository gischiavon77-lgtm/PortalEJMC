import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { canUserSeeGoal, goalVisibilityWhere } from '@/lib/goals';
import { GoalsShell } from '@/components/metas/GoalsShell';
import type { GoalCardData } from '@/components/metas/GoalCard';

/**
 * `/metas` — Listagem de metas (Tasks 8.4, 8.5, 8.6).
 *
 * Server Component que carrega as metas visíveis ao usuário direto
 * do Prisma e entrega ao `GoalsShell` client-side, responsável pelos
 * modais de criação (Task 8.7) e atualização de progresso (Task 8.8).
 *
 * ─── Por que Server Component + Prisma direto? ──────────────────────
 *
 * O layout `(portal)/layout.tsx` já garante sessão autenticada via
 * `auth()`. Daí podemos consultar o banco diretamente sem fazer um
 * roundtrip HTTP para `/api/goals`. Vantagens:
 *
 *   - Menos latência (sem fetch interno → mesmo processo).
 *   - Cache previsível: marcamos `dynamic = 'force-dynamic'` para
 *     garantir que cada navegação reflita atualizações recentes
 *     feitas por outros Diretores/Admins.
 *   - Permissões consistentes: aplicamos `goalVisibilityWhere(user)`
 *     no filtro Prisma e revalidamos com `canUserSeeGoal` em memória
 *     (defesa em profundidade).
 *
 * ─── Empty-state ────────────────────────────────────────────────────
 *
 * Quando o usuário não tem nenhuma meta visível (sem área e sem
 * metas gerais cadastradas, por exemplo), o `GoalsShell` renderiza
 * uma mensagem amigável em vez de uma lista vazia silenciosa.
 */

export const metadata: Metadata = {
  title: 'Metas',
  description: 'Metas da empresa e da minha área no Portal Interno EJMC.',
};

// Metas mudam quando outros Diretores/Admins atualizam progresso ou
// criam novas. `force-dynamic` evita que uma página cacheada mostre
// dados antigos após uma atualização.
export const dynamic = 'force-dynamic';

export default async function MetasPage() {
  const session = await auth();
  // Defesa em profundidade — o layout já garante isso, mas tipamos
  // o caso para o TS sem precisar de `!`.
  if (!session?.user) {
    redirect('/login');
  }

  let goals: GoalCardData[] = [];
  try {
    const where = goalVisibilityWhere({
      role: session.user.role,
      area: session.user.area,
    });

    const dbGoals = await prisma.goal.findMany({
      where,
      orderBy: [{ deadline: 'asc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        area: true,
        deadline: true,
        progress: true,
      },
    });

    // Filtro defensivo em memória — protege contra qualquer eventual
    // bug em `goalVisibilityWhere` retornando metas além do permitido.
    // Custo O(n) com n pequeno (até algumas dezenas de metas).
    const visible = dbGoals.filter((g) =>
      canUserSeeGoal(session.user, { type: g.type, area: g.area }),
    );

    // Serializa para passagem segura ao Client Component (datas como
    // ISO strings, descrição garantida como string).
    goals = visible.map((g) => ({
      id: g.id,
      name: g.name,
      description: g.description ?? '',
      type: g.type,
      area: g.area,
      deadline: g.deadline.toISOString(),
      progress: g.progress,
    }));
  } catch (err) {
    console.error('[metas] DB error:', err);
    goals = [];
  }

  return <GoalsShell goals={goals} />;
}
