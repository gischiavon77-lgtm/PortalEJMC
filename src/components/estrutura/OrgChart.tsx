/**
 * Organograma de uma área (Fase 5 da reforma): camadas de cima para
 * baixo, ligadas por um fio fino, cada pessoa num card com foto, nome e
 * cargo. Sem estado; renderizado no servidor.
 *
 * O fio da cor da área fica só no topo de cada card (cor de área só em
 * fios finos, regra da identidade visual).
 */

import { MemberAvatar } from '@/components/projetos/MemberAvatar';
import type { OrgLayer } from '@/lib/org-chart';
import type { StructurePerson } from '@/lib/structure';

export interface OrgChartProps {
  layers: OrgLayer<StructurePerson>[];
  /** Classe de fundo da cor da área (ex.: `bg-area-vendas`). */
  accent: string;
}

export function OrgChart({ layers, accent }: OrgChartProps) {
  return (
    <ol className="flex flex-col items-center" aria-label="Organograma da área">
      {layers.map((layer, index) => (
        <li
          key={layer.level}
          className="flex w-full flex-col items-center"
          data-testid={`org-layer-${layer.level}`}
        >
          {index > 0 && <span aria-hidden="true" className="h-8 w-px bg-border" />}
          <h2 className="mb-3 font-heading text-lg font-bold text-text">
            {layer.label}{' '}
            <span className="font-body text-sm font-medium text-text-faint">
              ({layer.people.length})
            </span>
          </h2>
          <ul className="flex w-full flex-wrap justify-center gap-3 tablet:gap-4">
            {layer.people.map((person) => (
              <li
                key={person.id}
                data-testid="org-person"
                className="hover-card relative flex w-[calc(50%-0.375rem)] flex-col items-center overflow-hidden rounded-lg border border-border bg-surface px-3 pb-4 pt-5 text-center tablet:w-44"
              >
                <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-0.5 ${accent}`} />
                <MemberAvatar name={person.name} avatarUrl={person.avatarUrl} size="lg" />
                <p className="mt-3 line-clamp-2 break-words text-sm font-semibold text-text">
                  {person.name}
                </p>
                {person.position && (
                  <p className="mt-0.5 line-clamp-2 break-words text-xs text-text-soft">
                    {person.position}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
