import type { Metadata } from 'next';

import { PortfolioInterativo } from '@/components/portfolio/PortfolioInterativo';

export const metadata: Metadata = {
  title: 'Portfólio',
  description: 'Serviços oferecidos pela EJMC — Mapa interativo de áreas e entregas.',
};

export default function PortfolioPage() {
  return <PortfolioInterativo />;
}
