import type { Metadata } from 'next';

import { getDashboardActivities, getDashboardSummary } from '@/lib/dashboard';
import { auth } from '@/lib/auth';
import { ActivityList } from '@/components/dashboard/ActivityList';
import { KpiCard } from '@/components/dashboard/KpiCard';

/**
 * `/dashboard` — Dashboard Geral (Tasks 6.3, 6.5, 6.6 / Req 7).
 *
 * Server Component que reúne os 6 indicadores numéricos (Req 7.1–7.6)
 * + a feed de até 10 atividades do mês corrente (Req 7.7) numa única
 * página renderizada no servidor.
 *
 * ─── Por que Server Component + Prisma direto? ──────────────────────
 *
 * O layout `(portal)/layout.tsx` já garante sessão autenticada via
 * `auth()` (defesa em profundidade complementar ao middleware). Daí
 * em diante, qualquer Server Component descendente é executado num
 * runtime Node confiável e pode ler o banco diretamente. Para o
 * `/dashboard`, isso é especialmente vantajoso porque:
 *
 *   1. Não há round-trip HTTP interno: o Next chamaria
 *      `fetch('/api/dashboard')` localmente, que voltaria para o mesmo
 *      processo Node — uma latência adicional sem ganho real, e
 *      complicaria a auth (precisaria forwardear cookies/headers).
 *      Usar o helper `@/lib/dashboard` direto produz o mesmo dado
 *      com menos código e zero latência extra.
 *
 *   2. O helper já implementa o fallback "fail-soft" (Req 7.8): se
 *      uma fonte falhar, o campo correspondente vira `0`/`[]` e o
 *      restante do dashboard renderiza normalmente. Isso vale tanto
 *      para a API quanto para a página.
 *
 *   3. O TTFB do RSC é melhor: dados já chegam serializados ao
 *      cliente, eliminando o estado de carregamento "skeleton" que
 *      seria necessário com fetch client-side.
 *
 * ─── Layout responsivo (Task 6.6 / Req 20) ──────────────────────────
 *
 * O grid dos KPI cards usa breakpoints semânticos do design system:
 *
 *   - mobile  (<768px) → 1 coluna   (`grid-cols-1`)
 *   - tablet  (768–1024) → 2 colunas (`tablet:grid-cols-2`)
 *   - desktop (>1024) → 3 colunas   (`desktop:grid-cols-3`)
 *
 * A lista de atividades fica abaixo dos KPIs ocupando 100% da
 * largura — mantém boa legibilidade mesmo em desktop largo, evitando
 * a tentação de transformar o feed numa coluna lateral apertada que
 * cortaria títulos longos de comunicado/projeto.
 *
 * Os textos de cabeçalho (Olá, X) escalam de `text-3xl` (mobile) para
 * `sm:text-4xl` (≥480px), seguindo o padrão tipográfico do portal.
 *
 * ─── Empty-state (Task 6.5) ─────────────────────────────────────────
 *
 * Os KPI cards exibem `0` quando o dado não está disponível, com tom
 * `muted` para sinalizar visualmente que aquela métrica ainda não
 * tem dados. O `ActivityList` mostra a mensagem "Sem atividades
 * registradas neste mês." quando a feed está vazia. Ambos vêm do
 * helper `@/lib/dashboard`, que já trata exceções como zero/lista
 * vazia (Req 7.8).
 */

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Visão geral do Portal Interno EJMC.',
};

// Garante que a página sempre lê dados frescos. O dashboard mostra
// estado "agora" — não faz sentido cachear porque cada usuário pode
// criar comunicados/eventos/atualizações e esperar vê-los na próxima
// navegação. Em produção podemos avaliar `revalidate = 60` se a
// pressão for alta, mas o default `force-dynamic` é o seguro aqui.
export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  // Sessão já validada pelo layout — usamos só para personalizar a
  // saudação. Quando indisponível (cenário excepcional) caímos para
  // "Olá!" sem nome, sem quebrar a página.
  const session = await auth();
  const greetingName = session?.user?.name?.split(' ')[0] ?? null;

  // Carrega summary e activities em paralelo. Cada chamada já tem
  // tratamento de erro próprio dentro do helper.
  let summary: Awaited<ReturnType<typeof getDashboardSummary>>;
  let activities: Awaited<ReturnType<typeof getDashboardActivities>>;

  try {
    [summary, activities] = await Promise.all([getDashboardSummary(), getDashboardActivities()]);
  } catch (err) {
    console.error('[dashboard] Erro ao carregar dados:', err);
    summary = {
      activeMembers: 0,
      projectsInProgress: 0,
      projectsFrozen: 0,
      monthlyRevenue: 0,
      revenueGoal: 0,
      monthlyLeads: 0,
    };
    activities = [];
  }

  return (
    <section
      aria-labelledby="dashboard-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 sm:gap-8"
    >
      {/* ─── Cabeçalho ─── */}
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
          Visão geral
        </p>
        <h1
          id="dashboard-heading"
          className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
        >
          {greetingName ? `Olá, ${greetingName}` : 'Dashboard'}
        </h1>
        <p className="text-text-secondary">Indicadores e atividades do mês corrente da EJMC.</p>
      </header>

      {/* ─── KPIs (grid responsivo: 1 / 2 / 3 colunas) ─── */}
      <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2 desktop:grid-cols-3">
        <KpiCard
          label="Membros ativos"
          value={summary.activeMembers}
          format="integer"
          tone={summary.activeMembers === 0 ? 'muted' : 'default'}
          hint="Contas com acesso liberado ao portal."
        />

        <KpiCard
          label="Projetos em andamento"
          value={summary.projectsInProgress}
          format="integer"
          tone={summary.projectsInProgress === 0 ? 'muted' : 'default'}
          hint="Projetos com status “Em andamento”."
        />

        <KpiCard
          label="Projetos congelados"
          value={summary.projectsFrozen}
          format="integer"
          tone={summary.projectsFrozen === 0 ? 'muted' : 'default'}
          hint="Projetos com status “Congelado”."
        />

        <KpiCard
          label="Faturamento mensal"
          value={summary.monthlyRevenue}
          format="currency"
          tone={summary.monthlyRevenue === 0 ? 'muted' : 'default'}
          hint="Acumulado do mês corrente."
        />

        <KpiCard
          label="Meta de faturamento"
          value={summary.revenueGoal}
          format="currency"
          tone={summary.revenueGoal === 0 ? 'muted' : 'default'}
          hint="Definida para o mês corrente."
        />

        <KpiCard
          label="Leads do mês"
          value={summary.monthlyLeads}
          format="integer"
          tone={summary.monthlyLeads === 0 ? 'muted' : 'default'}
          hint="Novos leads captados neste mês."
        />
      </div>

      {/* ─── Lista de atividades do mês ─── */}
      <ActivityList activities={activities} />
    </section>
  );
}
