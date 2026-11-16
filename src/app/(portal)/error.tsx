'use client';

/**
 * Error boundary for the portal group.
 * Catches errors from the layout/pages within (portal).
 */
export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg p-6">
      <div className="max-w-md text-center">
        <h2 className="text-2xl font-bold text-text">Erro no Portal</h2>
        <p className="mt-2 text-text-soft">Ocorreu um erro ao carregar esta página.</p>
        {error?.message && (
          <pre className="mt-4 overflow-auto rounded bg-surface-raised p-3 text-left text-xs text-danger">
            {error.message}
          </pre>
        )}
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
        >
          Tentar novamente
        </button>
        <a href="/login" className="mt-3 block text-sm text-text-faint underline hover:text-text">
          Voltar ao login
        </a>
      </div>
    </div>
  );
}
