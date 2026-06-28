'use client';

/**
 * `SystemMembersView` — Lista de membros puxada do sistema.
 *
 * Diferente do Álbum de Figurinhas (que é preenchido manualmente),
 * esta visão busca os usuários ATIVOS direto do sistema via
 * `GET /api/users/members` e exibe foto (a que a própria pessoa
 * enviou em Configurações), nome e cargo. Inclui filtro por área.
 *
 * O filtro é mantido em estado local (não na URL) para não conflitar
 * com o parâmetro `?gestao=` usado pela aba do álbum.
 */

import { useEffect, useState } from 'react';
import type { Area } from '@prisma/client';

import { AREA_LABELS } from '@/lib/goals';

import { MembersList, type MemberItem } from './MembersList';

const FILTER_AREAS: Area[] = [
  'VENDAS',
  'PRESIDENCIA',
  'PROJETOS',
  'MARKETING',
  'GESTAO_PESSOAS',
  'ADM_FIN',
];

export function SystemMembersView() {
  const [area, setArea] = useState<'ALL' | Area>('ALL');
  const [members, setMembers] = useState<MemberItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const qs = area === 'ALL' ? '' : `?area=${area}`;
    fetch(`/api/users/members${qs}`, { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { members: [] }))
      .then((d) => {
        if (active) setMembers(Array.isArray(d.members) ? d.members : []);
      })
      .catch(() => {
        if (active) setMembers([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [area]);

  const isEmpty = !loading && members.length === 0;
  const emptyMessage =
    area === 'ALL'
      ? 'Nenhum membro ativo encontrado no momento.'
      : `Não há membros ativos em ${AREA_LABELS[area]}.`;

  return (
    <section aria-labelledby="membros-lista-heading" className="flex w-full flex-col gap-6">
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2
            id="membros-lista-heading"
            className="font-heading text-2xl font-bold tracking-[-0.5px] text-text-primary"
          >
            Lista de Membros
          </h2>
          <p className="text-text-secondary">
            Membros ativos do sistema, com a foto que cada pessoa enviou no perfil.
          </p>
        </div>

        {/* Filtro por área */}
        <div className="flex w-full flex-col gap-1.5 tablet:max-w-xs">
          <label
            htmlFor="membros-lista-area-filter"
            className="text-xs font-semibold uppercase tracking-[1.5px] text-text-muted"
          >
            Filtrar por área
          </label>
          <select
            id="membros-lista-area-filter"
            value={area}
            onChange={(e) => setArea(e.target.value as 'ALL' | Area)}
            className="h-10 w-full rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30"
          >
            <option value="ALL">Todas as áreas</option>
            {FILTER_AREAS.map((a) => (
              <option key={a} value={a}>
                {AREA_LABELS[a]}
              </option>
            ))}
          </select>
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-200 border-t-red-core" />
        </div>
      ) : isEmpty ? (
        <p
          role="status"
          className="rounded-lg border border-dashed border-border-light bg-surface-card p-8 text-center text-sm text-text-muted"
        >
          {emptyMessage}
        </p>
      ) : (
        <MembersList members={members} />
      )}
    </section>
  );
}
