'use client';

/**
 * `Card` — Container clara (portal autenticado) do design system EJMC.
 *
 * Implementa uma superfície (`--surface-card`) com borda sutil
 * (`--border-light`) e sombra `--shadow-sm`. É composto por
 * subcomponentes:
 *
 *   - `Card.Header`  — área superior com título/ações.
 *   - `Card.Title`   — título tipográfico (Playfair Display).
 *   - `Card.Body`    — área de conteúdo principal.
 *   - `Card.Footer`  — área inferior com ações/metadados.
 *
 * Para uso "simples" (apenas conteúdo sem cabeçalho), basta passar
 * `title` ou usar `Card` direto com `children`. A composição é
 * preferível quando há ações no header ou separação semântica clara.
 *
 * ─── Diferença para `.glass-card` ──────────────────────────────────
 *
 * `.glass-card` é o card da camada escura (login/cadastro), com
 * blur/saturação e fundo translúcido. Este `Card` é a versão clara
 * para o interior do portal, onde a hierarquia tipográfica e o
 * contraste são mais importantes que o efeito glass.
 *
 * ─── Padding e variantes ──────────────────────────────────────────
 *
 *   - `padding`: `none` | `sm` | `md` (padrão) | `lg`
 *   - `variant`:
 *       • `solid`    — fundo branco com borda (default)
 *       • `outlined` — fundo transparente com borda mais marcada
 *       • `subtle`   — fundo cinza-claro sem borda
 */

import { forwardRef, type HTMLAttributes, type ReactNode } from 'react';

import { cn } from './cn';

export type CardVariant = 'solid' | 'outlined' | 'subtle';
export type CardPadding = 'none' | 'sm' | 'md' | 'lg';

export interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: CardVariant;
  padding?: CardPadding;
  /**
   * Atalho para renderizar um cabeçalho com apenas título. Para layouts
   * mais ricos (com ações, descrição), prefira a composição com
   * `Card.Header` + `Card.Title`.
   *
   * Sobrescreve o atributo HTML nativo `title` do `<div>` (tooltip),
   * que é raramente usado e tipado como `string`. Se o consumidor
   * precisar do tooltip nativo, basta usar `Card.Header` manualmente.
   */
  title?: ReactNode;
  /** Conteúdo opcional do cabeçalho à direita (ações). */
  headerActions?: ReactNode;
}

const VARIANT_CLASSES: Record<CardVariant, string> = {
  solid: 'bg-surface-card border border-border-light shadow-sm',
  outlined: 'bg-transparent border border-border-light',
  subtle: 'bg-surface-bg border border-transparent',
};

const PADDING_CLASSES: Record<CardPadding, string> = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-6 sm:p-8',
};

const CardRoot = forwardRef<HTMLDivElement, CardProps>(function Card(
  {
    variant = 'solid',
    padding = 'md',
    title,
    headerActions,
    className,
    children,
    ...rest
  },
  ref,
) {
  // Quando `title` ou `headerActions` é usado, o padding é movido para
  // os blocos internos para que o header possa ter sua borda inferior.
  const hasShortcutHeader = Boolean(title) || Boolean(headerActions);
  const rootPadding = hasShortcutHeader ? PADDING_CLASSES.none : PADDING_CLASSES[padding];

  return (
    <div
      ref={ref}
      className={cn(
        'rounded-lg',
        VARIANT_CLASSES[variant],
        rootPadding,
        className,
      )}
      {...rest}
    >
      {hasShortcutHeader && (
        <CardHeader>
          {title && <CardTitle>{title}</CardTitle>}
          {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
        </CardHeader>
      )}
      {hasShortcutHeader ? <CardBody padding={padding}>{children}</CardBody> : children}
    </div>
  );
});

/** Cabeçalho do card com borda inferior sutil. */
export const CardHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(function CardHeader({ className, children, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-between gap-3 border-b border-border-light px-4 py-3 sm:px-5',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

/** Título tipográfico (h3) com Playfair Display. */
export const CardTitle = forwardRef<
  HTMLHeadingElement,
  HTMLAttributes<HTMLHeadingElement>
>(function CardTitle({ className, children, ...rest }, ref) {
  return (
    <h3
      ref={ref}
      className={cn(
        'font-heading text-base font-bold tracking-tight text-text-primary sm:text-lg',
        className,
      )}
      {...rest}
    >
      {children}
    </h3>
  );
});

/** Corpo do card. Aceita `padding` para casar com o padrão do root. */
export const CardBody = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { padding?: CardPadding }
>(function CardBody({ className, children, padding = 'md', ...rest }, ref) {
  return (
    <div ref={ref} className={cn(PADDING_CLASSES[padding], className)} {...rest}>
      {children}
    </div>
  );
});

/** Rodapé com borda superior sutil para ações/metadados. */
export const CardFooter = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement>
>(function CardFooter({ className, children, ...rest }, ref) {
  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center justify-end gap-2 border-t border-border-light px-4 py-3 sm:px-5',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
});

// Composição estilo "namespace" sem perder o tipo do root.
type CardComponent = typeof CardRoot & {
  Header: typeof CardHeader;
  Title: typeof CardTitle;
  Body: typeof CardBody;
  Footer: typeof CardFooter;
};

export const Card = CardRoot as CardComponent;
Card.Header = CardHeader;
Card.Title = CardTitle;
Card.Body = CardBody;
Card.Footer = CardFooter;
