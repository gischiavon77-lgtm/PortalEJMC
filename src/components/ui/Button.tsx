'use client';

/**
 * `Button` — Botão base do design system EJMC (Task 5.6).
 *
 * Componente apresentacional, sem regra de negócio. Cobre os usos
 * mais comuns no portal autenticado (modo claro):
 *
 *   - `variant`:
 *       • `primary`    — fundo vermelho (`--red-core`), texto branco.
 *                        Ações principais (salvar, criar, confirmar).
 *       • `secondary`  — fundo branco, texto vermelho com borda.
 *                        Ações secundárias dentro de cards/forms.
 *       • `ghost`      — sem fundo, texto neutro com hover sutil.
 *                        Ações terciárias e cancelamentos.
 *       • `destructive`— fundo vermelho mais intenso (`--red-vivid`)
 *                        para ações irreversíveis (excluir, desativar).
 *   - `size`: `sm` | `md` | `lg` — controla padding/altura/tipografia.
 *   - `loading`: exibe spinner alinhado ao texto e desabilita o botão
 *                (`aria-busy="true"` + `disabled`).
 *   - `fullWidth`: ocupa 100% do container (útil em mobile/forms).
 *
 * ─── Diferença para `.auth-button` em globals.css ─────────────────────
 *
 * `.auth-button` é específico da camada escura (login/cadastro) — branco
 * sobre fundo vermelho, com letterspacing exagerado e. Este
 * `Button` é o equivalente para a camada clara (portal autenticado),
 * onde o vermelho aparece como cor de destaque e não como fundo de
 * página. Os dois coexistem por design.
 *
 * ─── Por que `forwardRef`? ──────────────────────────────────────────
 *
 * Para integrar com bibliotecas que precisam de `ref` (React Hook Form
 * em casos de submit programático, listas virtuais, focus management
 * em modais, etc.) sem pedir um wrapper extra do consumidor.
 *
 * ─── Acessibilidade ────────────────────────────────────────────────
 *
 *   - Foco visível com `focus-visible:ring` em todas as variantes.
 *   - `aria-busy="true"` durante `loading` para leitores de tela.
 *   - Estado `disabled` reduz opacidade e remove pointer events.
 *   - Tamanho mínimo 36px (sm), 40px (md), 44px (lg) para target táctil
 *     em mobile (Req 20.3 — ≥44px no `lg`, ainda confortável em `md`).
 */

import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from './cn';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  /** Conteúdo opcional renderizado antes do `children` (ícone). */
  leftIcon?: ReactNode;
  /** Conteúdo opcional renderizado após o `children` (ícone). */
  rightIcon?: ReactNode;
}

const VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: [
    'bg-brand text-white border border-transparent',
    'hover:bg-brand-hover',
    'active:bg-brand',
    'focus-visible:ring-white/30',
    'disabled:bg-brand/50',
  ].join(' '),
  secondary: [
    'bg-transparent text-text border border-border',
    'hover:bg-surface-raised hover:border-text-faint',
    'active:bg-surface-raised',
    'focus-visible:ring-white/30',
    'disabled:text-text-faint disabled:border-border',
  ].join(' '),
  ghost: [
    'bg-transparent text-text-soft border border-transparent',
    'hover:bg-surface-raised hover:text-text',
    'active:bg-surface-raised',
    'focus-visible:ring-white/30',
    'disabled:text-text-faint',
  ].join(' '),
  destructive: [
    'bg-transparent text-danger border border-brand',
    'hover:bg-brand hover:text-white',
    'active:bg-brand active:text-white',
    'focus-visible:ring-white/30',
    'disabled:text-text-faint disabled:border-border',
  ].join(' '),
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'h-9 px-3 text-xs gap-1.5 rounded-md',
  md: 'h-10 px-4 text-sm gap-2 rounded-md',
  lg: 'h-12 px-6 text-base gap-2 rounded-lg',
};

const SPINNER_SIZE: Record<ButtonSize, string> = {
  sm: 'h-3.5 w-3.5 border-[1.5px]',
  md: 'h-4 w-4 border-2',
  lg: 'h-5 w-5 border-2',
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    type = 'button',
    className,
    disabled,
    children,
    ...rest
  },
  ref,
) {
  const isDisabled = disabled || loading;

  return (
    <button
      ref={ref}
      type={type}
      disabled={isDisabled}
      aria-busy={loading || undefined}
      data-loading={loading ? 'true' : undefined}
      className={cn(
        // Base
        'inline-flex items-center justify-center font-semibold',
        'transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg',
        'disabled:cursor-not-allowed disabled:opacity-80',
        // Tipografia comum
        'tracking-tight',
        // Variantes
        VARIANT_CLASSES[variant],
        SIZE_CLASSES[size],
        fullWidth && 'w-full',
        className,
      )}
      {...rest}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className={cn(
            'inline-block animate-spin rounded-full border-current border-t-transparent',
            SPINNER_SIZE[size],
          )}
        />
      ) : (
        leftIcon && <span aria-hidden="true">{leftIcon}</span>
      )}
      {children && <span>{children}</span>}
      {!loading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
    </button>
  );
});
