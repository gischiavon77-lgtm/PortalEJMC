/**
 * `ProfileBanner` — Banner do perfil com a foto da pessoa.
 *
 * O banner é padronizado pela área do usuário: usa o gradiente de cor
 * e o animal (emoji) da área (ver `@/lib/area-theme`). A foto de perfil
 * aparece sobreposta na parte inferior do banner; quando não há foto,
 * mostramos as iniciais.
 *
 * Componente puramente apresentacional (Server Component).
 */

import type { Area } from '@prisma/client';

import { getAreaTheme } from '@/lib/area-theme';

export interface ProfileBannerProps {
  name: string;
  avatarUrl: string | null;
  area: Area | null;
  position: string | null;
}

function getInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '?';
  const base = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function ProfileBanner({ name, avatarUrl, area, position }: ProfileBannerProps) {
  const theme = getAreaTheme(area);
  const subtitle = position?.trim() ? position : theme.label;

  return (
    <div className="overflow-hidden rounded-xl border border-border-light bg-surface-card shadow-sm">
      {/* Banner colorido por área */}
      <div className={`relative h-32 bg-gradient-to-r ${theme.gradient} sm:h-40`}>
        {/* Animal da área em marca d'água */}
        <span
          className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 select-none text-7xl opacity-40 drop-shadow-lg sm:text-8xl"
          aria-hidden="true"
        >
          {theme.emoji}
        </span>
        {/* Etiqueta da área */}
        <span className="absolute left-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-black/25 px-3 py-1 text-xs font-semibold uppercase tracking-[1.5px] text-white backdrop-blur-sm">
          <span aria-hidden="true">{theme.emoji}</span>
          {theme.label}
        </span>
      </div>

      {/* Foto + nome sobrepostos */}
      <div className="flex flex-col items-center gap-1 px-6 pb-6 text-center">
        <div className="-mt-12 sm:-mt-14">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={`Foto de ${name}`}
              className="h-24 w-24 rounded-full border-4 border-surface-card object-cover shadow-md sm:h-28 sm:w-28"
            />
          ) : (
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full border-4 border-surface-card bg-gradient-to-br ${theme.gradient} text-2xl font-bold text-white shadow-md sm:h-28 sm:w-28`}
              aria-hidden="true"
            >
              {getInitials(name)}
            </div>
          )}
        </div>
        <h2 className="font-heading text-xl font-bold text-text-primary">{name || 'Usuário'}</h2>
        <p className="text-sm font-medium uppercase tracking-[1.5px] text-text-muted">{subtitle}</p>
      </div>
    </div>
  );
}
