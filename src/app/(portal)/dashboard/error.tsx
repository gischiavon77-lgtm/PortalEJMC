'use client';

/**
 * Error boundary for the dashboard page.
 * Catches runtime errors and shows a friendly message instead of crashing.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 py-16 text-center">
      <h2 className="text-2xl font-bold text-text">Algo deu errado</h2>
      <p className="text-text-soft">Não foi possível carregar o dashboard. Tente novamente.</p>
      {error?.message && (
        <pre className="mt-2 max-w-full overflow-auto rounded bg-surface-raised p-3 text-xs text-danger">
          {error.message}
        </pre>
      )}
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        Tentar novamente
      </button>
    </div>
  );
}
