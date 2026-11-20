/**
 * `/estrutura` — visão geral da estrutura da EJMC (Fase 5 da reforma).
 *
 * Substitui a antiga tela de membros/álbum. Server Component sem estado:
 * números no topo (membros e áreas) e um card por área com a contagem.
 * O card leva ao organograma da área (`/estrutura/<slug>`).
 *
 * Fonte: usuários ativos com área (`getStructurePeople`).
 */

import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { PageHeader, StatCard } from '@/components/ui';
import { getAreaTheme } from '@/lib/area-theme';
import { auth } from '@/lib/auth';
import { computeStructureOverview, type StructureOverview } from '@/lib/org-chart';
import { getStructurePeople } from '@/lib/structure';

export const metadata: Metadata = {
  title: 'Estrutura',
  description: 'Áreas e pessoas da EJMC.',
};

export const dynamic = 'force-dynamic';

export default async function EstruturaPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login');
  }

  let overview: StructureOverview = computeStructureOverview([]);
  try {
    overview = computeStructureOverview(await getStructurePeople());
  } catch (err) {
    console.error('[estrutura] DB error:', err);
  }

  return (
    <section aria-labelledby="estrutura-heading">
      <PageHeader
        titleId="estrutura-heading"
        title="Estrutura"
        subtitle="Áreas e pessoas da EJMC."
      />

      <div className="mb-6 grid grid-cols-2 gap-4 tablet:max-w-xl">
        <StatCard value={overview.totalMembers} label="Membros" />
        <StatCard value={overview.totalAreas} label="Áreas" />
      </div>

      <ul className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
        {overview.areas.map(({ area, slug, count }) => {
          const theme = getAreaTheme(area);
          return (
            <li key={area}>
              <Link
                href={`/estrutura/${slug}`}
                data-testid={`area-card-${area}`}
                className="hover-card group relative flex items-center gap-4 overflow-hidden rounded-lg border border-border bg-surface p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-y-0 left-0 w-1 ${theme.accent}`}
                />
                <span
                  aria-hidden="true"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-border bg-surface-raised text-2xl"
                >
                  {theme.emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words font-heading text-xl font-bold leading-tight text-text">
                    {theme.label}
                  </span>
                  <span className="text-sm text-text-soft">
                    {count === 1 ? '1 membro' : `${count} membros`}
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="text-text-faint transition-colors group-hover:text-text"
                >
                  →
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
