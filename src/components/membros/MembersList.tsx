'use client';

/**
 * `MembersList` — Listagem responsiva de membros (Tasks 10.2, 10.5).
 *
 * Renderiza dois layouts a partir do mesmo dataset:
 *
 *   - **Mobile (<768px)**: cada membro vira um cartão vertical com
 *     avatar, nome em destaque, cargo e badge de área. Empilhamento
 *     `flex-col` garante que nomes longos quebrem sem rolagem
 *     horizontal (Req 20.4).
 *
 *   - **Desktop/Tablet (≥768px)**: tabela com colunas Nome, Cargo e
 *     Área. Cabeçalhos em tipografia pequena e `uppercase` para
 *     destaque, divisórias sutis usando `border-light`.
 *
 * A escolha de duplicar o markup (em vez de manipular CSS via
 * grid/flex inteligente) facilita acessibilidade — o leitor de tela
 * recebe a árvore correta para cada layout sem hacks de display.
 * Usamos `tablet:hidden` / `hidden tablet:block` para alternar entre
 * os dois layouts no breakpoint de 768px definido em
 * `tailwind.config.ts` (`tablet: '768px'` é min-width).
 *
 * ─── Renderização do avatar ────────────────────────────────────────
 *
 * Quando `avatarUrl` é nulo, mostramos um círculo com iniciais
 * derivadas do nome (até 2 letras). Isso evita placeholders genéricos
 * e cria identidade visual por membro mesmo antes do upload.
 *
 * Para o `<img>` usamos a tag nativa em vez de `next/image` porque:
 *   - O dataset do diretório é pequeno (≤80 membros).
 *   - A URL real virá de upload futuro (Task 18.3) e precisará de
 *     validação prévia. Adiar a otimização de imagens é deliberado.
 */

import type { Area, UserRole } from '@prisma/client';

import { Badge } from '@/components/ui';
import { AREA_LABELS } from '@/lib/goals';
import { effectivePosition } from '@/lib/position';

export interface MemberItem {
  id: string;
  name: string;
  position: string | null;
  area: Area | null;
  avatarUrl: string | null;
  role?: UserRole | null;
}

export interface MembersListProps {
  members: MemberItem[];
}

/** Iniciais para o avatar fallback (até 2 letras maiúsculas). */
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function AreaBadge({ area }: { area: Area | null }) {
  if (!area) {
    return (
      <Badge variant="neutral" size="sm">
        Sem área
      </Badge>
    );
  }
  return (
    <Badge variant="info" size="sm">
      {AREA_LABELS[area]}
    </Badge>
  );
}

function Avatar({ name, avatarUrl }: { name: string; avatarUrl: string | null }) {
  if (avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={avatarUrl}
        alt=""
        aria-hidden="true"
        className="h-10 w-10 flex-none rounded-full object-cover ring-1 ring-border-light"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-red-core/10 text-sm font-semibold uppercase tracking-wide text-red-core ring-1 ring-red-core/20"
    >
      {getInitials(name)}
    </span>
  );
}

export function MembersList({ members }: MembersListProps) {
  return (
    <div role="region" aria-label="Lista de membros ativos" className="w-full">
      {/* ─── Mobile: cartões empilhados (visível apenas <768px) ─── */}
      <ul
        className="flex tablet:hidden flex-col gap-3"
        aria-label="Membros (visualização em cartões)"
      >
        {members.map((member) => (
          <li
            key={member.id}
            className="rounded-lg border border-border-light bg-surface-card p-4 shadow-sm"
          >
            <div className="flex items-start gap-3">
              <Avatar name={member.name} avatarUrl={member.avatarUrl} />
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <p className="truncate font-heading text-base font-semibold text-text-primary">
                  {member.name}
                </p>
                {effectivePosition(member.role, member.position) && (
                  <p className="truncate text-sm text-text-secondary">
                    {effectivePosition(member.role, member.position)}
                  </p>
                )}
                <div className="mt-0.5">
                  <AreaBadge area={member.area} />
                </div>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {/* ─── Desktop/Tablet: tabela (escondido em <768px) ─── */}
      <div className="hidden tablet:block w-full overflow-hidden rounded-lg border border-border-light bg-surface-card shadow-sm">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">
            Lista de membros ativos da empresa, ordenada alfabeticamente por nome.
          </caption>
          <thead className="bg-surface-bg/60">
            <tr>
              <th
                scope="col"
                className="border-b border-border-light px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Nome
              </th>
              <th
                scope="col"
                className="border-b border-border-light px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Cargo
              </th>
              <th
                scope="col"
                className="border-b border-border-light px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary"
              >
                Área
              </th>
            </tr>
          </thead>
          <tbody>
            {members.map((member) => (
              <tr key={member.id} className="border-b border-border-light last:border-b-0">
                <td className="px-4 py-3 align-middle">
                  <div className="flex items-center gap-3">
                    <Avatar name={member.name} avatarUrl={member.avatarUrl} />
                    <span className="font-medium text-text-primary">{member.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 align-middle text-text-secondary">
                  {effectivePosition(member.role, member.position) || '—'}
                </td>
                <td className="px-4 py-3 align-middle">
                  <AreaBadge area={member.area} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
