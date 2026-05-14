'use client';

/**
 * `MembrosShell` — Casca client-side da página `/membros`
 * (Tasks 10.3, 10.4, 10.5).
 *
 * Recebe a lista pré-renderizada pelo Server Component (já filtrada
 * por área e ordenada alfabeticamente) e adiciona:
 *
 *   1. **Filtro por área** (Task 10.3) — dropdown com todas as áreas
 *      cadastradas + opção "Todos". Trocar a área reescreve a URL via
 *      `router.push(...)` e o Server Component refaz o fetch já com
 *      o filtro correto. Mantemos o resto da query string (caso
 *      futuras extensões adicionem outros parâmetros).
 *
 *   2. **Mensagem de empty-state** (Task 10.4) — quando o filtro
 *      selecionado não retorna resultados, exibimos uma mensagem
 *      contextual mencionando a área escolhida (Req 11.3 — "exibir
 *      uma mensagem informando que não há membros cadastrados na
 *      Área selecionada"). Quando não há filtro e a lista é vazia,
 *      mostramos uma mensagem genérica ("nenhum membro ativo").
 *
 *   3. **Layout responsivo** (Task 10.5) — delegado ao
 *      `MembersList`, que renderiza cartões em mobile e tabela em
 *      desktop. O shell apenas estrutura cabeçalho + filtro + lista.
 *
 * ─── Por que dropdown nativo (`<select>`)? ────────────────────────
 *
 * Para filtros de uma única seleção em conjuntos pequenos (≤10
 * opções), o `<select>` nativo já é acessível, performático e
 * familiar — especialmente em mobile, onde o picker do sistema é
 * superior a qualquer dropdown customizado. Reservamos componentes
 * customizados para casos com busca, multi-seleção ou estilização
 * pesada — o que não é o caso aqui.
 *
 * ─── Sobre estado de URL vs. estado local ─────────────────────────
 *
 * Manter o filtro na URL (`?area=...`) tem 3 vantagens importantes:
 *
 *   - Compartilhamento: copiar o link já preserva o filtro aplicado.
 *   - Navegação: voltar/avançar do navegador funciona naturalmente.
 *   - SSR: o Server Component lê o `searchParams` e já entrega o
 *     dataset filtrado, evitando flash de "lista completa → lista
 *     filtrada" que ocorreria com filtro client-only.
 */

import { useRouter, useSearchParams } from 'next/navigation';
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

export interface MembrosShellProps {
  members: MemberItem[];
  /** Filtro atual. `null` representa o atalho "Todos". */
  currentArea: Area | null;
}

export function MembrosShell({ members, currentArea }: MembrosShellProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleAreaChange(value: 'ALL' | Area) {
    const params = new URLSearchParams(searchParams?.toString() ?? '');
    if (value === 'ALL') {
      params.delete('area');
    } else {
      params.set('area', value);
    }
    const qs = params.toString();
    router.push(qs ? `/membros?${qs}` : '/membros');
  }

  const isEmpty = members.length === 0;
  const emptyMessage = currentArea
    ? `Não há membros cadastrados em ${AREA_LABELS[currentArea]}.`
    : 'Nenhum membro ativo encontrado no momento.';

  return (
    <section
      aria-labelledby="membros-heading"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6"
    >
      <header className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <p className="text-[11px] font-semibold uppercase tracking-[2px] text-text-muted">
            Diretório
          </p>
          <h1
            id="membros-heading"
            className="font-heading text-3xl font-bold tracking-[-0.5px] text-text-primary sm:text-4xl"
          >
            Membros
          </h1>
          <p className="text-text-secondary">
            Lista de membros ativos da empresa, ordenada alfabeticamente.
          </p>
        </div>

        {/* Filtro por área (Task 10.3) */}
        <div className="flex w-full flex-col gap-1.5 tablet:max-w-xs desktop:max-w-xs">
          <label
            htmlFor="membros-area-filter"
            className="text-xs font-semibold uppercase tracking-[1.5px] text-text-muted"
          >
            Filtrar por área
          </label>
          <select
            id="membros-area-filter"
            value={currentArea ?? 'ALL'}
            onChange={(e) =>
              handleAreaChange(e.target.value as 'ALL' | Area)
            }
            className="h-10 w-full rounded-md border border-border-light bg-white px-3 text-sm text-text-primary focus-visible:border-red-core focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30"
          >
            <option value="ALL">Todos</option>
            {FILTER_AREAS.map((area) => (
              <option key={area} value={area}>
                {AREA_LABELS[area]}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Empty-state (Task 10.4) ou listagem responsiva (Task 10.5) */}
      {isEmpty ? (
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
