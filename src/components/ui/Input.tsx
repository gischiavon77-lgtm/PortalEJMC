'use client';

/**
 * `Input` — Campo de formulário do portal autenticado (modo claro).
 *
 * Cobre os requisitos comuns de qualquer formulário do projeto:
 *
 *   - Label associada (`<label htmlFor>` + `id` automático).
 *   - Mensagem de erro (`error`) com `aria-invalid` + `aria-describedby`.
 *   - Texto de ajuda (`helperText`) que cede lugar ao erro quando ele
 *     existe — ambos compartilham o mesmo `aria-describedby` para que
 *     leitores de tela narrem a informação.
 *   - Ícones opcionais à esquerda/direita (`leftIcon`, `rightIcon`).
 *   - `forwardRef` para integração com React Hook Form e foco
 *     programático.
 *
 * Diferença para `.glass-input` (camada escura, login/cadastro):
 * este `Input` é a versão para o interior do portal, com fundo
 * branco, borda sutil e texto escuro — combinando com `Card` claro.
 *
 * ─── Acessibilidade ────────────────────────────────────────────────
 *
 *   - `aria-invalid="true"` quando há erro.
 *   - `aria-describedby` aponta para o `<p>` de erro/ajuda. Isso
 *     garante que NVDA/VoiceOver narrem a mensagem ao focar o campo.
 *   - `aria-required="true"` quando `required` é true (Next.js já
 *     reflete o atributo, mas explicitamos por consistência).
 *   - O label fica sempre visível (sem float-label) para clareza
 *     conforme WCAG 3.3.2 (etiquetas).
 */

import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from './cn';

export interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Rótulo visível acima do campo. Obrigatório por acessibilidade. */
  label: string;
  /** Mensagem de erro — quando definida, marca o campo como inválido. */
  error?: string;
  /** Texto auxiliar exibido abaixo do campo quando não há erro. */
  helperText?: string;
  /** Ícone decorativo à esquerda do input. */
  leftIcon?: ReactNode;
  /** Ícone/ação à direita do input (toggle de senha, copiar, etc.). */
  rightIcon?: ReactNode;
  /** Esconde visualmente o label, mantendo-o para leitores de tela. */
  hideLabel?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  {
    id,
    label,
    error,
    helperText,
    leftIcon,
    rightIcon,
    hideLabel,
    className,
    required,
    disabled,
    ...rest
  },
  ref,
) {
  // `useId` garante um id estável entre client/server sem colisão.
  const reactId = useId();
  const inputId = id ?? `input-${reactId}`;
  const descId = `${inputId}-desc`;

  const hasError = Boolean(error);
  const description = error ?? helperText ?? null;

  return (
    <div className="flex w-full flex-col gap-1.5">
      <label
        htmlFor={inputId}
        className={cn(
          'text-sm font-medium text-text-primary',
          hideLabel && 'sr-only',
        )}
      >
        {label}
        {required && (
          <span aria-hidden="true" className="ml-0.5 text-red-vivid">
            *
          </span>
        )}
      </label>

      <div
        className={cn(
          // Container relativo para posicionar ícones absolutamente.
          'relative flex w-full items-center',
        )}
      >
        {leftIcon && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 flex h-5 w-5 items-center justify-center text-text-muted"
          >
            {leftIcon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={hasError || undefined}
          aria-describedby={description ? descId : undefined}
          aria-required={required || undefined}
          required={required}
          disabled={disabled}
          className={cn(
            // Base
            'flex h-10 w-full rounded-md border bg-white px-3 text-sm text-text-primary',
            'placeholder:text-text-muted',
            'transition-colors duration-150',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30',
            // Borda
            hasError
              ? 'border-red-vivid focus-visible:border-red-vivid focus-visible:ring-red-vivid/30'
              : 'border-border-light focus-visible:border-red-core',
            // Disabled
            'disabled:cursor-not-allowed disabled:bg-surface-bg disabled:text-text-muted',
            // Padding pelos ícones
            leftIcon && 'pl-9',
            rightIcon && 'pr-9',
            className,
          )}
          {...rest}
        />

        {rightIcon && (
          <span className="absolute right-3 flex h-5 w-5 items-center justify-center text-text-muted">
            {rightIcon}
          </span>
        )}
      </div>

      {description && (
        <p
          id={descId}
          className={cn(
            'text-xs',
            hasError ? 'text-red-vivid' : 'text-text-muted',
          )}
        >
          {description}
        </p>
      )}
    </div>
  );
});
