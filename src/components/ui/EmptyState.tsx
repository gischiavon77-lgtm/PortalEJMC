/**
 * `EmptyState` — estado vazio de uma lista ou seção.
 *
 * Ícone e texto discretos, centralizados. Sem moldura por padrão, para
 * poder ficar dentro de um card; use `bordered` quando ele ocupar o
 * lugar do card inteiro.
 *
 * Componente sem estado: pode ser usado em Server e Client Components.
 */

import type { ReactNode } from 'react';

import { cn } from './cn';

export interface EmptyStateProps {
  /** Mensagem principal. Ex.: "Nenhum comunicado disponível no momento." */
  message: string;
  /** Texto de apoio opcional. */
  hint?: string;
  /** Ícone opcional; sem ele, usa uma bandeja vazia. */
  icon?: ReactNode;
  /** Ação opcional (ex.: botão para criar o primeiro item). */
  action?: ReactNode;
  /** Desenha borda e fundo de card em volta. */
  bordered?: boolean;
  className?: string;
}

function InboxIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 12h-6l-2 3h-4l-2-3H2" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </svg>
  );
}

export function EmptyState({ message, hint, icon, action, bordered, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-2 px-4 py-10 text-center',
        bordered && 'rounded-lg border border-border bg-surface',
        className,
      )}
    >
      <span className="text-text-faint" aria-hidden="true">
        {icon ?? <InboxIcon />}
      </span>
      <p className="text-sm text-text-faint">{message}</p>
      {hint && <p className="text-xs text-text-faint">{hint}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
