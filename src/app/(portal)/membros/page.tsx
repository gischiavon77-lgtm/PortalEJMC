import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { MembrosView } from '@/components/membros/MembrosView';

/**
 * `/membros` — Álbum de Figurinhas (membros por gestão e área).
 *
 * Server Component que carrega as gestões disponíveis e os membros
 * da gestão mais recente (ou selecionada via searchParams), passando
 * ao AlbumShell client-side para interatividade.
 */

export const metadata: Metadata = {
  title: 'Membros — Álbum de Figurinhas',
  description:
    'Álbum de figurinhas dos membros do Portal Interno EJMC, organizado por gestão e área.',
};

export const dynamic = 'force-dynamic';

interface MembrosPageProps {
  searchParams?: Promise<{ gestao?: string | string[] }> | { gestao?: string | string[] };
}

export default async function MembrosPage(props: MembrosPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const search = (await Promise.resolve(props.searchParams)) ?? {};
  const rawGestao = Array.isArray(search.gestao) ? search.gestao[0] : search.gestao;

  // Buscar todas as gestões distintas
  const gestoesResult = await prisma.albumMember.findMany({
    select: { gestao: true },
    distinct: ['gestao'],
    orderBy: { gestao: 'desc' },
  });

  const gestoes = gestoesResult.map((r) => r.gestao);
  const currentGestao = rawGestao && gestoes.includes(rawGestao) ? rawGestao : gestoes[0] || null;

  return <MembrosView gestoes={gestoes} initialGestao={currentGestao} />;
}
