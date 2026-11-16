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
  success: 'bg-ok/15 text-ok ring-ok/30',
  warning: 'bg-warn/15 text-warn ring-warn/30',
  error: 'bg-brand/20 text-danger ring-brand',
  info: 'bg-info/15 text-info ring-info/30',
  neutral: 'bg-border text-text-soft ring-border',
};

const DOT_CLASSES: Record<BadgeVariant, string> = {
  success: 'bg-ok',
  warning: 'bg-warn',
  error: 'bg-brand',
  info: 'bg-info',
  neutral: 'bg-text-faint',
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
        <span aria-hidden="true" className={cn('h-1.5 w-1.5 rounded-full', DOT_CLASSES[variant])} />
      )}
      {children}
    </span>
  );
});
