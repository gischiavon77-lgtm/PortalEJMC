/**
 * `/destaques` — carrossel completo de destaques (Destaques, Referências
 * e Prêmio Cultura), com a edição para quem tem permissão.
 *
 * Era a página inicial até a Fase 2 da reforma; a página inicial agora
 * mostra só os cinco destaques principais no card "Destaque do Mês", com
 * link para cá. Sem item no menu.
 */

import type { Metadata } from 'next';

import { HighlightsCarousel } from '@/components/dashboard/HighlightsCarousel';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Destaques',
  description: 'Destaques, referências e prêmios da EJMC.',
};

export const dynamic = 'force-dynamic';

export default function DestaquesPage() {
  return (
    <div className="mx-auto w-full max-w-6xl">
      <PageHeader title="Destaques" subtitle="Quem fez a diferença na EJMC." />
      <HighlightsCarousel />
    </div>
  );
}
