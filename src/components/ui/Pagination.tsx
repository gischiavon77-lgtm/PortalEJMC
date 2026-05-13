'use client';

/**
 * `Pagination` — Seletor de página com prev/next, página atual e
 * janelas de páginas com elipses.
 *
 * API:
 *   - `page` (1-based): página atual exibida.
 *   - `totalPages`: total de páginas (>= 1). Se `0`, o componente não
 *     renderiza nada.
 *   - `onPageChange`: callback chamado com a nova página (1-based).
 *   - `siblingCount`: quantas páginas mostrar de cada lado da atual.
 *     Default 1 (ex.: `1 … 4 5 6 … 10`).
 *
 * ─── Acessibilidade ────────────────────────────────────────────────
 *
 *   - `<nav aria-label="Paginação">` para identificar o landmark.
 *   - Botões com `aria-label` descritivo ("Página 3", "Próxima página").
 *   - Botão da página atual com `aria-current="page"`.
 *   - Elipses como `<span aria-hidden>` (decoração visual apenas).
 */

import { useMemo } from 'react';

import { cn } from './cn';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
  className?: string;
  /** Texto opcional adicional (ex.: "Mostrando 1–20 de 200"). */
  summary?: string;
}

type PageItem = number | 'ellipsis-left' | 'ellipsis-right';

function buildPages(page: number, totalPages: number, siblings: number): PageItem[] {
  // Limita siblings a um valor sensato.
  const sib = Math.max(0, siblings);

  // Sempre mostra primeira e última página.
  const first = 1;
  const last = totalPages;

  // Janela ao redor da página atual.
  const left = Math.max(first + 1, page - sib);
  const right = Math.min(last - 1, page + sib);

  // Total de slots: 1 (first) + ? + janela + ? + 1 (last).
  // Para `totalPages` pequeno, mostramos tudo sem elipses.
  const SHOW_ALL_THRESHOLD = 7;
  if (totalPages <= SHOW_ALL_THRESHOLD) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: PageItem[] = [first];

  if (left > first + 1) items.push('ellipsis-left');

  for (let p = left; p <= right; p++) {
    items.push(p);
  }

  if (right < last - 1) items.push('ellipsis-right');

  if (last !== first) items.push(last);

  return items;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  siblingCount = 1,
  className,
  summary,
}: PaginationProps) {
  const items = useMemo(
    () => buildPages(page, totalPages, siblingCount),
    [page, totalPages, siblingCount],
  );

  if (totalPages <= 0) return null;

  // Clamping defensivo — se receber `page` fora do intervalo, ainda
  // renderizamos o controle correto e as ações ficam protegidas.
  const safePage = Math.min(Math.max(1, page), totalPages);

  const canPrev = safePage > 1;
  const canNext = safePage < totalPages;

  function go(target: number) {
    const next = Math.min(Math.max(1, target), totalPages);
    if (next !== safePage) onPageChange(next);
  }

  return (
    <nav
      aria-label="Paginação"
      className={cn(
        'flex w-full flex-col items-center gap-2 sm:flex-row sm:justify-between',
        className,
      )}
    >
      {summary && (
        <p className="text-xs text-text-muted" aria-live="polite">
          {summary}
        </p>
      )}

      {/*
       * `overflow-x-auto` é uma rede de segurança para viewports
       * extremamente estreitos (Req 20.4 — 320px mínimo). Em telas
       * pequenas com muitas páginas (`siblingCount` alto + total
       * grande), os botões podem somar mais de 280px mesmo com tamanho
       * compacto; o scroll horizontal interno preserva a usabilidade
       * sem quebrar o layout do container pai.
       */}
      <ul className="flex max-w-full items-center gap-1 overflow-x-auto">
        <li>
          <button
            type="button"
            onClick={() => go(safePage - 1)}
            disabled={!canPrev}
            aria-label="Página anterior"
            className={cn(
              'inline-flex h-9 shrink-0 items-center justify-center rounded-md px-2.5 text-sm font-medium sm:px-3',
              'border border-border-light bg-white text-text-primary',
              'hover:bg-surface-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            <span className="ml-1 hidden sm:inline">Anterior</span>
          </button>
        </li>

        {items.map((item, idx) => {
          if (item === 'ellipsis-left' || item === 'ellipsis-right') {
            return (
              <li
                key={`${item}-${idx}`}
                className="shrink-0 px-1 text-text-muted sm:px-2"
                aria-hidden="true"
              >
                …
              </li>
            );
          }

          const isCurrent = item === safePage;
          return (
            <li key={item}>
              <button
                type="button"
                onClick={() => go(item)}
                aria-label={`Página ${item}`}
                aria-current={isCurrent ? 'page' : undefined}
                className={cn(
                  'inline-flex h-9 min-w-9 shrink-0 items-center justify-center rounded-md px-2 text-sm font-medium sm:px-3',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30',
                  isCurrent
                    ? 'border border-red-core bg-red-core text-white'
                    : 'border border-border-light bg-white text-text-primary hover:bg-surface-bg',
                )}
              >
                {item}
              </button>
            </li>
          );
        })}

        <li>
          <button
            type="button"
            onClick={() => go(safePage + 1)}
            disabled={!canNext}
            aria-label="Próxima página"
            className={cn(
              'inline-flex h-9 shrink-0 items-center justify-center rounded-md px-2.5 text-sm font-medium sm:px-3',
              'border border-border-light bg-white text-text-primary',
              'hover:bg-surface-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            <span className="mr-1 hidden sm:inline">Próxima</span>
            <svg
              viewBox="0 0 24 24"
              width="16"
              height="16"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="9 18 15 12 9 6" />
            </svg>
          </button>
        </li>
      </ul>
    </nav>
  );
}
