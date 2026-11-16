/**
 * `PageHeader` — cabeçalho padrão de página do portal.
 *
 * Padrão da identidade EJMC:
 *   - Título em League Spartan, branco, negrito e grande.
 *   - Logo abaixo, subtítulo em Montserrat, menor, em caixa normal, no
 *     vermelho da marca (#87000a).
 *   - À direita (abaixo, no celular), a ação principal da página.
 *
 * O `#87000a` tem contraste baixo sobre o fundo escuro. Por isso o
 * subtítulo é só uma frase de apoio curta, em tamanho maior e peso 600;
 * informação essencial não deve ficar apenas nele.
 *
 * Componente sem estado: pode ser usado em Server e Client Components.
 */

import type { ReactNode } from 'react';

import { cn } from './cn';

export interface PageHeaderProps {
  /** Título da página (vira o `<h1>`). */
  title: string;
  /** `id` do `<h1>`, para `aria-labelledby` da seção. */
  titleId?: string;
  /** Frase de apoio, em caixa normal. */
  subtitle?: string;
  /** Ação principal (ex.: botão "Novo comunicado"). */
  action?: ReactNode;
  className?: string;
}

export function PageHeader({ title, titleId, subtitle, action, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'mb-6 flex flex-col gap-4 tablet:flex-row tablet:items-start tablet:justify-between',
        className,
      )}
    >
      <div className="min-w-0">
        <h1
          id={titleId}
          className="font-heading text-3xl font-bold leading-tight text-text tablet:text-4xl"
        >
          {title}
        </h1>
        {subtitle && <p className="mt-1 text-base font-semibold text-brand">{subtitle}</p>}
      </div>
      {action && <div className="flex shrink-0 flex-wrap items-center gap-2">{action}</div>}
    </header>
  );
}
