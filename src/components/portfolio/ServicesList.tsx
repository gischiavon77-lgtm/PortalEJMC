'use client';

/**
 * `ServicesList` — Listagem responsiva de serviços do portfólio
 * (Tasks 12.3, 12.4).
 *
 * Renderiza dois layouts a partir do mesmo dataset:
 *
 *   - **Mobile (<768px)**: cada serviço vira um cartão vertical com
 *     nome em destaque e descrição truncada. Empilhamento `flex-col`
 *     garante que nomes longos quebrem sem rolagem horizontal.
 *
 *   - **Desktop/Tablet (≥768px)**: tabela com colunas Nome,
 *     Descrição e Ações (se Admin/Diretor). Cabeçalhos em tipografia
 *     pequena e `uppercase` para destaque, divisórias sutis usando
 *     `border-light`.
 *
 * Task 12.4: Botão "Editar" por item, visível apenas quando
 * `canManage` é `true` (Admin/Diretor).
 */

export interface ServiceItem {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface ServicesListProps {
  services: ServiceItem[];
  /** Se o usuário pode editar serviços (Admin/Diretor). */
  canManage?: boolean;
  /** Callback ao clicar "Editar" em um serviço. */
  onEdit?: (service: ServiceItem) => void;
}

export function ServicesList({ services, canManage, onEdit }: ServicesListProps) {
  return (
    <div role="region" aria-label="Lista de serviços do portfólio" className="w-full">
      {/* ─── Mobile: cartões empilhados (visível apenas <768px) ─── */}
      <ul
        className="flex tablet:hidden flex-col gap-3"
        aria-label="Serviços (visualização em cartões)"
      >
        {services.map((service) => (
          <li
            key={service.id}
            className="rounded-lg border border-border-light bg-surface-card p-4 shadow-sm"
          >
            <div className="flex flex-col gap-2">
              <div className="flex items-start justify-between gap-2">
                <p className="font-heading text-base font-semibold text-text-primary">
                  {service.name}
                </p>
                {canManage && onEdit && (
                  <button
                    type="button"
                    onClick={() => onEdit(service)}
                    className="shrink-0 rounded-md px-2 py-1 text-xs font-medium text-red-core transition-colors hover:bg-red-core/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30"
                    aria-label={`Editar serviço ${service.name}`}
                  >
                    Editar
                  </button>
                )}
              </div>
              <p className="line-clamp-3 text-sm text-text-secondary">{service.description}</p>
            </div>
          </li>
        ))}
      </ul>

      {/* ─── Desktop/Tablet: tabela (escondido em <768px) ─── */}
      <div className="hidden tablet:block w-full overflow-hidden rounded-lg border border-border-light bg-surface-card shadow-sm">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Lista de serviços do portfólio, ordenada alfabeticamente por nome.
          </caption>
          <thead className="bg-surface-bg/60">
            <tr>
              <th
                scope="col"
                className="border-b border-border-light px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Serviço
              </th>
              <th
                scope="col"
                className="border-b border-border-light px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Descrição
              </th>
              {canManage && (
                <th
                  scope="col"
                  className="border-b border-border-light px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-text-secondary"
                >
                  Ações
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {services.map((service) => (
              <tr key={service.id} className="border-b border-border-light last:border-b-0">
                <td className="px-4 py-3 align-middle">
                  <span className="font-medium text-text-primary">{service.name}</span>
                </td>
                <td className="px-4 py-3 align-middle text-text-secondary">
                  <p className="line-clamp-2">{service.description}</p>
                </td>
                {canManage && (
                  <td className="px-4 py-3 align-middle text-right">
                    <button
                      type="button"
                      onClick={() => onEdit?.(service)}
                      className="rounded-md px-2.5 py-1 text-xs font-medium text-red-core transition-colors hover:bg-red-core/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30"
                      aria-label={`Editar serviço ${service.name}`}
                    >
                      Editar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
