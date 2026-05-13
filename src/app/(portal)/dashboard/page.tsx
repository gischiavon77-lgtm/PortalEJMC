/**
 * Placeholder de `/dashboard` — Tasks 5.2–5.5.
 *
 * O dashboard real é objeto da Task 6.3, com cards de KPIs, lista
 * de atividades do mês e API integrada. Aqui o objetivo é apenas:
 *
 *   1. Garantir que o layout `(portal)/layout.tsx` resolve uma rota
 *      filho — o Next exige que cada grupo tenha pelo menos uma
 *      `page.tsx` para que o build não falhe em rotas privadas
 *      derivadas (`/dashboard`, citado pelo `LoginForm` como
 *      destino padrão pós-login).
 *
 *   2. Servir como destino do redirect pós-login durante o
 *      desenvolvimento das demais tasks de UI, para que o
 *      desenvolvedor consiga validar visualmente o layout
 *      (sidebar + topbar mobile + drawer) sem dependência das
 *      tasks 6+.
 *
 * Quando a Task 6.3 começar, este arquivo será substituído pelo
 * componente real do dashboard.
 */

export default function DashboardPlaceholderPage() {
  return (
    <section aria-labelledby="dashboard-heading" className="mx-auto max-w-3xl">
      <h1
        id="dashboard-heading"
        className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary"
      >
        Dashboard
      </h1>
      <p className="mt-3 text-text-secondary">
        Em construção. Os indicadores e a linha do tempo de atividades chegam na Task 6.
      </p>
    </section>
  );
}
