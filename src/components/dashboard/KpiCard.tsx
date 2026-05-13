/**
 * `KpiCard` — Card de indicador (Tasks 6.3 e 6.5).
 *
 * Cada card exibe:
 *   - um rótulo curto em maiúsculas espaçadas (`label`),
 *   - um valor numérico formatado de acordo com `format`,
 *   - opcionalmente um sublabel/descrição com contexto adicional.
 *
 * O componente é puro/server-component-friendly: só lê props e
 * renderiza markup; não usa hooks nem estado. Por isso pode ser
 * usado tanto em Server Components (caso da página `/dashboard`)
 * quanto incluído numa árvore client.
 *
 * ─── Formatos suportados ──────────────────────────────────────────
 *   - `'integer'`  — número inteiro com separadores pt-BR
 *                    (`Intl.NumberFormat`).
 *   - `'currency'` — moeda BRL com 2 casas decimais.
 *
 * ─── Fallback (Req 7.8 / Task 6.5) ────────────────────────────────
 * O componente trata `value` como `number`. Quando o consumidor
 * recebe `0` da API por indisponibilidade, o card mostra "0" /
 * "R$ 0,00" — exatamente como pede a Req 7.8 ("valor zero para
 * indicadores indisponíveis"). O CSS adiciona um destaque visual
 * (`tone="muted"`) opcional para indicar "sem dados ainda" sem
 * inventar conteúdo (ex.: a meta de faturamento do mês pode não ter
 * sido lançada — mostramos 0 e o usuário entende que precisa
 * cadastrar).
 *
 * ─── Acessibilidade ──────────────────────────────────────────────
 *   - O valor numérico fica em `<dd>` e o rótulo em `<dt>`, dentro
 *     de um `<dl>` — semanticamente correto para "definição".
 *   - `aria-describedby` opcional caso o consumidor queira anexar
 *     uma descrição explícita.
 */

import type { ReactNode } from 'react';

import { Card } from '@/components/ui';
import { cn } from '@/components/ui/cn';

export type KpiFormat = 'integer' | 'currency';

export interface KpiCardProps {
  /** Rótulo curto (ex.: "Membros ativos"). */
  label: string;
  /** Valor numérico — sempre `number`. Use 0 para indisponível. */
  value: number;
  /** Formato de exibição. Default: `'integer'`. */
  format?: KpiFormat;
  /** Subtexto opcional (ex.: "Comparado à meta de R$ 50.000"). */
  hint?: ReactNode;
  /** Ícone opcional renderizado no canto superior direito. */
  icon?: ReactNode;
  /**
   * Sutilmente esmaece o card para indicar dados ausentes/zerados.
   * Exemplo de uso: na página dashboard, `tone="muted"` quando o
   * valor é 0 e a métrica usualmente não é zero (faturamento).
   */
  tone?: 'default' | 'muted';
  /** Classe extra para customização local. */
  className?: string;
}

/** Locale e currency aplicados de forma consistente em todos os KPIs. */
const NUMBER_LOCALE = 'pt-BR';
const CURRENCY_CODE = 'BRL';

const integerFormatter = new Intl.NumberFormat(NUMBER_LOCALE, {
  maximumFractionDigits: 0,
});

const currencyFormatter = new Intl.NumberFormat(NUMBER_LOCALE, {
  style: 'currency',
  currency: CURRENCY_CODE,
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatValue(value: number, format: KpiFormat): string {
  // Defensivo: trata NaN/Infinity (não deveriam vir do helper, mas
  // mantém o card resistente a JSON corrompido vindo do fetch).
  if (!Number.isFinite(value)) {
    return format === 'currency' ? 'R$ 0,00' : '0';
  }
  return format === 'currency'
    ? currencyFormatter.format(value)
    : integerFormatter.format(value);
}

export function KpiCard({
  label,
  value,
  format = 'integer',
  hint,
  icon,
  tone = 'default',
  className,
}: KpiCardProps) {
  return (
    <Card
      variant="solid"
      padding="lg"
      className={cn(
        'flex h-full flex-col justify-between transition-opacity',
        tone === 'muted' && 'opacity-80',
        className,
      )}
    >
      <dl className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <dt className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            {label}
          </dt>
          {icon ? (
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-red-core/10 text-red-core"
              aria-hidden="true"
            >
              {icon}
            </span>
          ) : null}
        </div>

        <dd className="font-heading text-3xl font-bold leading-none tracking-[-0.5px] text-text-primary sm:text-[32px]">
          {formatValue(value, format)}
        </dd>
      </dl>

      {hint ? (
        <p className="mt-4 text-sm text-text-secondary">{hint}</p>
      ) : null}
    </Card>
  );
}
