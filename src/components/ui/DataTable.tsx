'use client';

/**
 * `DataTable` — Tabela genérica com suporte a:
 *
 *   - `columns`: configuração tipada de cada coluna (header, accessor,
 *     `render` opcional, `align` opcional, `width` opcional).
 *   - Estado de carregamento (`loading`) com placeholder de linhas.
 *   - Estado vazio (`emptyMessage`) renderizado dentro da tabela.
 *   - Linhas clicáveis via `onRowClick` (acessível: tecla Enter/Space).
 *   - Responsividade: em mobile (<768px) cada linha vira um "card"
 *     vertical com `header: valor` em cada célula. Em desktop/tablet
 *     mantém o layout tabular tradicional.
 *
 * O componente é puramente apresentacional — paginação fica em
 * `Pagination` (componente separado), e ordenação/filtro são
 * responsabilidade do consumidor (passa dados já tratados).
 *
 * ─── Acessibilidade ────────────────────────────────────────────────
 *
 *   - `<table>` semântico com `<thead>`/`<tbody>`.
 *   - `caption` opcional para descrever o conteúdo.
 *   - Linhas com `onRowClick` recebem `role="button"` + `tabIndex=0`
 *     e respondem a Enter/Space.
 *   - Em layout mobile, cada célula recebe `data-label` para que o CSS
 *     possa exibir o cabeçalho à esquerda do valor.
 */

import { Fragment, type ReactNode } from 'react';

import { cn } from './cn';

export interface Column<T> {
  /** Chave estável para `key` do React e para o `data-label` mobile. */
  key: string;
  /** Cabeçalho exibido na tabela e como rótulo em layout mobile. */
  header: ReactNode;
  /** Função que extrai/renderiza a célula a partir do row. */
  render: (row: T, index: number) => ReactNode;
  /** Alinhamento horizontal da célula. Default: `left`. */
  align?: 'left' | 'center' | 'right';
  /** Largura preferida da coluna (em desktop), ex.: `'120px'`, `'20%'`. */
  width?: string;
  /** Quando `true`, a coluna fica oculta em viewports mobile. */
  hideOnMobile?: boolean;
}

export interface DataTableProps<T> {
  /** Linhas de dados. */
  data: T[];
  /** Configuração de colunas. */
  columns: Column<T>[];
  /** Função para extrair a chave única de cada linha. */
  rowKey: (row: T, index: number) => string;
  /** Estado de carregamento — exibe linhas-placeholder. */
  loading?: boolean;
  /** Mensagem exibida quando não há linhas (e não está carregando). */
  emptyMessage?: ReactNode;
  /** Caption descritivo da tabela (lido por leitores de tela). */
  caption?: ReactNode;
  /** Quando definido, cada linha vira clicável com role=button. */
  onRowClick?: (row: T, index: number) => void;
  /** Classe extra no container externo. */
  className?: string;
  /** Quantas linhas-placeholder mostrar durante `loading`. Default 5. */
  loadingRows?: number;
}

const ALIGN_CLASSES: Record<NonNullable<Column<unknown>['align']>, string> = {
  left: 'text-left',
  center: 'text-center',
  right: 'text-right',
};

export function DataTable<T>({
  data,
  columns,
  rowKey,
  loading = false,
  emptyMessage = 'Nenhum item encontrado.',
  caption,
  onRowClick,
  className,
  loadingRows = 5,
}: DataTableProps<T>) {
  const isEmpty = !loading && data.length === 0;

  return (
    <div
      className={cn(
        'w-full overflow-hidden rounded-lg border border-border-light bg-surface-card',
        className,
      )}
    >
      {/* `overflow-x-auto` em desktop garante scroll horizontal quando
          a tabela for mais larga que o container. Em mobile, mudamos
          o display para "block" e cada `tr` vira um cartão. */}
      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          {caption && <caption className="sr-only">{caption}</caption>}

          <thead className="mobile:hidden bg-surface-bg/60">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    'border-b border-border-light px-4 py-3 text-xs font-semibold uppercase tracking-wider text-text-secondary',
                    ALIGN_CLASSES[col.align ?? 'left'],
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading &&
              Array.from({ length: loadingRows }).map((_, rowIdx) => (
                <tr
                  key={`loading-${rowIdx}`}
                  className="mobile:flex mobile:flex-col mobile:gap-2 mobile:border-b mobile:border-border-light mobile:px-4 mobile:py-3"
                  aria-hidden="true"
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn(
                        'border-b border-border-light px-4 py-3',
                        'mobile:border-0 mobile:px-0 mobile:py-0',
                        ALIGN_CLASSES[col.align ?? 'left'],
                        col.hideOnMobile && 'mobile:hidden',
                      )}
                    >
                      <span className="block h-3 w-3/4 animate-pulse rounded bg-border-light" />
                    </td>
                  ))}
                </tr>
              ))}

            {!loading && isEmpty && (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-8 text-center text-sm text-text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            )}

            {!loading &&
              !isEmpty &&
              data.map((row, idx) => {
                const interactive = Boolean(onRowClick);
                return (
                  <tr
                    key={rowKey(row, idx)}
                    onClick={interactive ? () => onRowClick?.(row, idx) : undefined}
                    onKeyDown={
                      interactive
                        ? (e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              onRowClick?.(row, idx);
                            }
                          }
                        : undefined
                    }
                    role={interactive ? 'button' : undefined}
                    tabIndex={interactive ? 0 : undefined}
                    className={cn(
                      'border-b border-border-light last:border-b-0',
                      // Em mobile, transforma a linha em cartão vertical.
                      'mobile:flex mobile:flex-col mobile:gap-2 mobile:px-4 mobile:py-3',
                      interactive &&
                        'cursor-pointer transition-colors hover:bg-surface-bg/60 focus-visible:bg-surface-bg/60 focus-visible:outline-none',
                    )}
                  >
                    {columns.map((col) => (
                      <Fragment key={col.key}>
                        <td
                          data-label={
                            typeof col.header === 'string' ? col.header : undefined
                          }
                          className={cn(
                            'px-4 py-3 align-middle text-text-primary',
                            // Em mobile, tira o padding original e usa
                            // grid de 2 colunas: rótulo | valor.
                            'mobile:flex mobile:items-start mobile:justify-between mobile:gap-3 mobile:px-0 mobile:py-0',
                            ALIGN_CLASSES[col.align ?? 'left'],
                            col.hideOnMobile && 'mobile:hidden',
                          )}
                        >
                          {/* Rótulo embutido apenas em mobile. Mantém
                              o cabeçalho original para desktop intacto. */}
                          {typeof col.header === 'string' && (
                            <span
                              className="mobile:flex hidden text-xs font-semibold uppercase tracking-wider text-text-muted"
                              aria-hidden="true"
                            >
                              {col.header}
                            </span>
                          )}
                          <span className="mobile:text-right">
                            {col.render(row, idx)}
                          </span>
                        </td>
                      </Fragment>
                    ))}
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
