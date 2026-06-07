'use client';

/**
 * `Toast` — Notificação temporária de feedback para o usuário.
 *
 * Exibe uma mensagem de sucesso ou erro que desaparece automaticamente
 * após o tempo configurado (padrão: 4 segundos).
 *
 * Posicionamento: fixo no canto superior central da viewport,
 * com animação de entrada/saída suave.
 *
 * Uso:
 *   <Toast
 *     message="Serviço adicionado com sucesso!"
 *     variant="success"
 *     visible={showToast}
 *     onDismiss={() => setShowToast(false)}
 *   />
 */

import { useEffect, useRef } from 'react';

export type ToastVariant = 'success' | 'error';

export interface ToastProps {
  /** Mensagem exibida no toast. */
  message: string;
  /** Variante visual: success (verde) ou error (vermelho). */
  variant?: ToastVariant;
  /** Controla visibilidade do toast. */
  visible: boolean;
  /** Chamado quando o toast deve ser escondido (auto-dismiss ou click). */
  onDismiss: () => void;
  /** Tempo em ms antes do auto-dismiss. Padrão: 4000. */
  duration?: number;
}

export function Toast({
  message,
  variant = 'success',
  visible,
  onDismiss,
  duration = 4000,
}: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (visible) {
      timerRef.current = setTimeout(() => {
        onDismiss();
      }, duration);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [visible, duration, onDismiss]);

  if (!visible) return null;

  const isSuccess = variant === 'success';

  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'fixed left-1/2 top-6 z-[9999]',
        'flex items-center gap-2 rounded-lg border px-4 py-3 shadow-lg',
        'animate-toast-in',
        'max-w-[90vw] sm:max-w-md',
        isSuccess
          ? 'border-green-200 bg-green-50 text-green-800'
          : 'border-red-200 bg-red-50 text-red-800',
      ].join(' ')}
    >
      {/* Ícone */}
      <svg
        aria-hidden="true"
        className={['h-4 w-4 flex-shrink-0', isSuccess ? 'text-green-600' : 'text-red-600'].join(
          ' ',
        )}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        {isSuccess ? (
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        ) : (
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        )}
      </svg>

      <span className="text-sm font-medium">{message}</span>

      {/* Botão de fechar */}
      <button
        type="button"
        onClick={onDismiss}
        className={[
          'ml-auto -mr-1 rounded-md p-1 transition-colors',
          isSuccess
            ? 'text-green-600 hover:bg-green-100 hover:text-green-800'
            : 'text-red-600 hover:bg-red-100 hover:text-red-800',
        ].join(' ')}
        aria-label="Fechar notificação"
      >
        <svg
          aria-hidden="true"
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
