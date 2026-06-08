'use client';

/**
 * Global error boundary — catches errors from root layout and all pages.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: 'system-ui, sans-serif', padding: '2rem', textAlign: 'center' }}>
        <h1>Erro Inesperado</h1>
        <p>Ocorreu um erro no Portal EJMC.</p>
        {error?.message && (
          <pre
            style={{
              background: '#f5f5f5',
              padding: '1rem',
              borderRadius: '8px',
              textAlign: 'left',
              overflow: 'auto',
              fontSize: '12px',
              color: '#c00',
            }}
          >
            {error.message}
          </pre>
        )}
        <button
          onClick={reset}
          style={{
            marginTop: '1rem',
            padding: '0.75rem 1.5rem',
            background: '#c0182e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
          }}
        >
          Tentar novamente
        </button>
      </body>
    </html>
  );
}
