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
    <div className="flex min-h-screen items-center justify-center bg-surface-bg p-6">
      <div className="max-w-md text-center">
        <h2 className="text-2xl font-bold text-text-primary">Erro no Portal</h2>
        <p className="mt-2 text-text-secondary">Ocorreu um erro ao carregar esta página.</p>
        {error?.message && (
          <pre className="mt-4 overflow-auto rounded bg-gray-100 p-3 text-left text-xs text-red-700">
            {error.message}
          </pre>
        )}
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-red-core px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-vivid"
        >
          Tentar novamente
        </button>
        <a
          href="/login"
          className="mt-3 block text-sm text-text-muted underline hover:text-text-primary"
        >
          Voltar ao login
        </a>
      </div>
    </div>
  );
}
