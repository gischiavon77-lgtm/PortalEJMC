/**
 * `StatusBadge` — etiqueta de status ou categoria.
 *
 * Contorno fino e texto em caixa normal (Montserrat nunca em maiúsculas).
 * Os tons são auxiliares e discretos, para não competir com o vermelho
 * da marca:
 *
 *   - `neutral` → padrão, cinza
 *   - `ok`      → concluído, ativo, aprovado
 *   - `warn`    → pendente, atenção
 *   - `info`    → informativo, categoria
 *   - `danger`  → erro, vencido, bloqueado
 *   - `brand`   → destaque (usar com parcimônia)
 *
 * Para etiquetas com ponto colorido ou fundo preenchido, existe o `Badge`.
 *
 * Componente sem estado: pode ser usado em Server e Client Components.
 */

import type { ReactNode } from 'react';

import { cn } from './cn';

export type StatusTone = 'neutral' | 'ok' | 'warn' | 'info' | 'danger' | 'brand';

export interface StatusBadgeProps {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}

const TONE_CLASSES: Record<StatusTone, string> = {
  neutral: 'border-border text-text-soft',
  ok: 'border-ok/40 text-ok',
  warn: 'border-warn/40 text-warn',
  info: 'border-info/40 text-info',
  danger: 'border-danger/40 text-danger',
  brand: 'border-brand bg-brand text-white',
};

export function StatusBadge({ tone = 'neutral', children, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium',
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
