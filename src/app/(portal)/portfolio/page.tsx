import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { PortfolioShell } from '@/components/portfolio/PortfolioShell';
import type { ServiceItem } from '@/components/portfolio/ServicesList';

/**
 * `/portfolio` — Listagem de serviços do portfólio (Task 12.3).
 *
 * Server Component que carrega os serviços diretamente do Prisma
 * com paginação (50 por página) e ordenação alfabética por nome,
 * entregando ao `PortfolioShell` client-side para interatividade.
 *
 * ─── Paginação via searchParams ────────────────────────────────────
 *
 * Aceita `?page=N` na URL (1-based). Páginas inválidas (< 1 ou
 * não-numérico) degradam para página 1. Valores acima do total de
 * páginas retornam a última página válida com lista vazia.
 *
 * ─── Por que Prisma direto? ────────────────────────────────────────
 *
 * O API Route `GET /api/services` (Task 12.1) existe para clientes
 * externos. A página `/portfolio` roda no mesmo processo Node e
 * pode consultar o banco sem roundtrip HTTP, mantendo a mesma lógica
 * de ordenação e paginação que o endpoint.
 *
 * ─── Consistência com o API Route ──────────────────────────────────
 *
 * O orderBy `name: 'asc'` e o default de 50 por página refletem
 * exatamente o comportamento do `GET /api/services`. Qualquer
 * divergência será detectada em testes de propriedade.
 */

const PAGE_SIZE = 50;

export const metadata: Metadata = {
  title: 'Portfólio',
  description: 'Serviços oferecidos pela empresa no Portal Interno EJMC.',
};

// Serviços podem ser adicionados/editados por Admins/Diretores a
// qualquer momento. `force-dynamic` garante dados atualizados.
export const dynamic = 'force-dynamic';

interface PortfolioPageProps {
  searchParams?: Promise<{ page?: string | string[] }> | { page?: string | string[] };
}

function parsePageParam(raw: string | string[] | undefined): number {
  if (!raw) return 1;
  const str = Array.isArray(raw) ? raw[0] : raw;
  const parsed = parseInt(str, 10);
  if (isNaN(parsed) || parsed < 1) return 1;
  return parsed;
}

export default async function PortfolioPage(props: PortfolioPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const search = (await Promise.resolve(props.searchParams)) ?? {};
  const page = parsePageParam(search.page);
  const skip = (page - 1) * PAGE_SIZE;

  let serialized: ServiceItem[] = [];
  let total = 0;
  let totalPages = 1;
  try {
    const [services, count] = await Promise.all([
      prisma.service.findMany({
        orderBy: { name: 'asc' },
        skip,
        take: PAGE_SIZE,
        select: {
          id: true,
          name: true,
          description: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      prisma.service.count(),
    ]);

    total = count;
    totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    // Serializa datas para ISO strings (necessário para Client Components).
    serialized = services.map((s) => ({
      id: s.id,
      name: s.name,
      description: s.description,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    }));
  } catch (err) {
    console.error('[portfolio] DB error:', err);
    serialized = [];
  }

  return (
    <PortfolioShell
      services={serialized}
      pagination={{
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages,
      }}
    />
  );
}
