'use client';

/**
 * `Badge` — Etiqueta pequena para indicadores de status.
 *
 * Variantes mapeiam para os estados mais comuns no portal:
 *   - `success`  — verde (aprovado, ativo, concluído)
 *   - `warning`  — âmbar (pendente, atenção, congelado)
 *   - `error`    — vermelho (rejeitado, vencido, infração)
 *   - `info`     — azul (em revisão, em sincronização)
 *   - `neutral`  — cinza (default, arquivado)
 *
 * Usamos cores fixas (não tokens do design system) para os semáforos
 * porque o vermelho da paleta EJMC é cor de marca, e usá-lo para
 * "erro" criaria conflito visual com botões primários. As cores
 * neutras sim usam tokens.
 *
 * Tamanhos: `sm` (default) e `md` para casos de destaque.
 */

import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from './cn';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';
export type BadgeSize = 'sm' | 'md';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  size?: BadgeSize;
  /** Renderiza com pontinho colorido à esquerda (status dot). */
  withDot?: boolean;
}

const VARIANT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-100 text-amber-800 ring-amber-200',
  error: 'bg-red-100 text-red-700 ring-red-200',
  info: 'bg-sky-100 text-sky-700 ring-sky-200',
  neutral: 'bg-border-light text-text-secondary ring-border-light',
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-emerald-500',
  warning: 'bg-amber-500',
  error: 'bg-red-vivid',
  info: 'bg-sky-500',
  neutral: 'bg-text-muted',
};

const SIZE_CLASSES: Record<BadgeSize, string> = {
  sm: 'text-[11px] px-2 py-0.5 gap-1',
  md: 'text-xs px-2.5 py-1 gap-1.5',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { variant = 'neutral', size = 'sm', withDot, className, children, ...rest },
  ref,
) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex items-center rounded-full font-medium ring-1 ring-inset',
        'whitespace-nowrap',
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        className,
      )}
      {...rest}
    >
      {withDot && (
        <span
          aria-hidden="true"
          className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASSES[variant])}
        />
      )}
      {children}
    </span>
  );
});
