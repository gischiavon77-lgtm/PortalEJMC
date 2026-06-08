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
      <h2 className="text-2xl font-bold text-text-primary">Algo deu errado</h2>
      <p className="text-text-secondary">Não foi possível carregar o dashboard. Tente novamente.</p>
      {error?.message && (
        <pre className="mt-2 max-w-full overflow-auto rounded bg-gray-100 p-3 text-xs text-red-700">
          {error.message}
        </pre>
      )}
      <button
        onClick={reset}
        className="mt-4 rounded-lg bg-red-core px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-vivid"
      >
        Tentar novamente
      </button>
    </div>
  );
}
