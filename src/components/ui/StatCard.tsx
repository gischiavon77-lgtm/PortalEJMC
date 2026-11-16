/**
 * `StatCard` — card de número.
 *
 * Número grande em League Spartan (branco, negrito) e, abaixo, o rótulo
 * em Montserrat, menor e em caixa normal. Usado para indicadores
 * (dashboard, contadores de página).
 *
 * Componente sem estado: pode ser usado em Server e Client Components.
 */

import type { ReactNode } from 'react';

import { cn } from './cn';

export interface StatCardProps {
  /** Valor em destaque (já formatado: "12", "R$ 4.500", "87%"). */
  value: ReactNode;
  /** Rótulo do indicador, em caixa normal. */
  label: string;
  /** Texto de apoio opcional, abaixo do rótulo. */
  hint?: string;
  /** Ícone opcional, à direita. */
  icon?: ReactNode;
  className?: string;
}

export function StatCard({ value, label, hint, icon, className }: StatCardProps) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-3 hover-card rounded-lg border border-border bg-surface p-4 sm:p-5',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="font-heading text-3xl font-bold leading-none text-text sm:text-4xl">
          {value}
        </p>
        <p className="mt-2 text-sm text-text-soft">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-text-faint">{hint}</p>}
      </div>
      {icon && (
        <span className="shrink-0 text-text-faint" aria-hidden="true">
          {icon}
        </span>
      )}
    </div>
  );
}
