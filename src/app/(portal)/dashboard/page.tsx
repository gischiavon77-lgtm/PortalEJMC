import { HighlightsCarousel } from '@/components/dashboard/HighlightsCarousel';

export const metadata = { title: 'Dashboard', description: 'Destaques da EJMC' };
export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return <HighlightsCarousel />;
}
