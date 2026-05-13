'use client';

/**
 * `Modal` — Diálogo modal acessível.
 *
 * Implementação custom (não usa `<dialog>` nativo) com:
 *
 *   - Overlay com fundo escurecido + clique-para-fechar.
 *   - `Escape` fecha o modal.
 *   - Foco inicial no primeiro elemento focável + focus trap durante a
 *     interação (Tab/Shift+Tab circulam dentro do modal).
 *   - Restauração do foco ao elemento que abriu o modal ao fechar.
 *   - `role="dialog"` + `aria-modal="true"` + `aria-labelledby` apontando
 *     para o título (ou `aria-label` quando o título é visualmente
 *     omitido).
 *   - Bloqueia scroll do `body` enquanto aberto.
 *   - Renderiza via portal (`createPortal`) no `document.body` para
 *     evitar problemas de z-index/overflow do container pai.
 *
 * Por que não `<dialog>` nativo?
 * O suporte a `<dialog>` melhorou bastante, mas o controle de focus
 * trap, transições e estilização cross-browser ainda é mais previsível
 * com a abordagem manual. Mantivemos a API simples (open/onClose) para
 * facilitar a migração futura.
 */

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';

import { cn } from './cn';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Título visível no header. Obrigatório por acessibilidade — quando
   * for inadequado mostrar o título visualmente, use `hideTitle` e ele
   * permanecerá disponível para leitores de tela. */
  title: string;
  /** Esconde o título visualmente, mantendo-o para `aria-labelledby`. */
  hideTitle?: boolean;
  /** Descrição opcional logo abaixo do título. */
  description?: ReactNode;
  /** Conteúdo principal do modal. */
  children: ReactNode;
  /** Slot de ações no rodapé. Renderizado em uma área separada com
   * borda superior. */
  footer?: ReactNode;
  /** Tamanho máximo do modal (largura). */
  size?: ModalSize;
  /** Define se o clique no overlay fecha o modal. Default `true`. */
  closeOnOverlayClick?: boolean;
  /** Define se a tecla Escape fecha o modal. Default `true`. */
  closeOnEscape?: boolean;
}

const SIZE_CLASSES: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-2xl',
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

export function Modal({
  open,
  onClose,
  title,
  hideTitle,
  description,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const titleId = useId();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  // Memoiza o handler de close para reuso em vários efeitos.
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // ─── Escape para fechar ────────────────────────────────────────
  useEffect(() => {
    if (!open || !closeOnEscape) return;

    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        handleClose();
      }
    }

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, closeOnEscape, handleClose]);

  // ─── Bloqueio de scroll do body ────────────────────────────────
  useEffect(() => {
    if (!open) return;

    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  // ─── Foco inicial + restauração ────────────────────────────────
  useEffect(() => {
    if (!open) return;

    previousActiveRef.current = (document.activeElement as HTMLElement) ?? null;

    // No próximo frame, foca o primeiro elemento focável (ou o
    // container, como fallback). Isso garante que o conteúdo já
    // esteja montado.
    const raf = requestAnimationFrame(() => {
      const root = containerRef.current;
      if (!root) return;
      const focusable = root.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable) {
        focusable.focus();
      } else {
        root.focus();
      }
    });

    return () => {
      cancelAnimationFrame(raf);
      // Restaura foco ao elemento que abriu o modal.
      const previous = previousActiveRef.current;
      if (previous && typeof previous.focus === 'function') {
        previous.focus();
      }
    };
  }, [open]);

  // ─── Focus trap (Tab/Shift+Tab) ────────────────────────────────
  useEffect(() => {
    if (!open) return;

    function onKey(event: KeyboardEvent) {
      if (event.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;

      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      ).filter((el) => !el.hasAttribute('data-focus-guard'));

      if (focusables.length === 0) {
        event.preventDefault();
        root.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement as HTMLElement | null;

      if (event.shiftKey) {
        if (active === first || !root.contains(active)) {
          event.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }

    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // ─── SSR-safe portal ───────────────────────────────────────────
  if (!open) return null;
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      role="presentation"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
    >
      {/* Overlay */}
      <div
        data-testid="modal-overlay"
        aria-hidden="true"
        onClick={closeOnOverlayClick ? handleClose : undefined}
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
      />

      {/* Container — `tabIndex={-1}` permite que o modal receba foco
          como fallback quando não há elementos focáveis dentro dele. */}
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full overflow-hidden rounded-lg bg-surface-card shadow-card',
          'flex max-h-[calc(100vh-3rem)] flex-col',
          SIZE_CLASSES[size],
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 border-b border-border-light px-5 py-4">
          <div className={cn(hideTitle && 'sr-only')}>
            <h2
              id={titleId}
              className="font-heading text-lg font-bold tracking-tight text-text-primary"
            >
              {title}
            </h2>
            {description && (
              <p className="mt-1 text-sm text-text-secondary">{description}</p>
            )}
          </div>

          {/* Sempre mantemos o id do título disponível, mesmo com hideTitle */}
          {hideTitle && (
            <h2 id={titleId} className="sr-only">
              {title}
            </h2>
          )}

          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="ml-auto inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-border-light hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-sm text-text-primary">
          {children}
        </div>

        {/* Footer (opcional) */}
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border-light bg-surface-bg/50 px-5 py-3">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
