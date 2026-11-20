/**
 * `/estrutura/<slug>` — organograma de uma área (Fase 5 da reforma).
 *
 * Camadas de cima para baixo (Diretoria > Gerência > Coordenação >
 * Membros), montadas por `buildAreaChart`. Slug desconhecido → 404.
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { OrgChart } from '@/components/estrutura/OrgChart';
import { EmptyState, PageHeader } from '@/components/ui';
import { getAreaTheme } from '@/lib/area-theme';
import { auth } from '@/lib/auth';
import { areaFromSlug, buildAreaChart } from '@/lib/org-chart';
import { getStructurePeople, type StructurePerson } from '@/lib/structure';

export const dynamic = 'force-dynamic';

interface AreaPageProps {
  params: Promise<{ area: string }> | { area: string };
}

export async function generateMetadata(props: AreaPageProps): Promise<Metadata> {
  const { area: slug } = await Promise.resolve(props.params);
  const area = areaFromSlug(slug);
  return { title: area ? `Estrutura — ${getAreaTheme(area).label}` : 'Estrutura' };
}

export default async function EstruturaAreaPage(props: AreaPageProps) {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  const { area: slug } = await Promise.resolve(props.params);
  const area = areaFromSlug(slug);
  if (!area) notFound();

  let people: StructurePerson[] = [];
  try {
    people = await getStructurePeople(area);
  } catch (err) {
    console.error('[estrutura] DB error:', err);
  }

  const theme = getAreaTheme(area);
  const layers = buildAreaChart(people, area);

  return (
    <section aria-labelledby="estrutura-area-heading">
      <Link
        href="/estrutura"
        className="mb-4 inline-flex min-h-[44px] items-center rounded text-sm font-medium text-text-soft transition-colors hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 tablet:min-h-0"
      >
        ← Estrutura
      </Link>

      <PageHeader
        titleId="estrutura-area-heading"
        title={theme.label}
        subtitle={people.length === 1 ? '1 membro' : `${people.length} membros`}
      />

      {layers.length === 0 ? (
        <EmptyState message="Nenhum membro ativo nesta área." bordered />
      ) : (
        <OrgChart layers={layers} accent={theme.accent} />
      )}
    </section>
  );
}
