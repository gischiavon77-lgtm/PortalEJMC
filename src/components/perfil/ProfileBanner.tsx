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
      <div className={`relative h-36 overflow-hidden bg-gradient-to-r ${theme.gradient} sm:h-44`}>
        {/* Vários animaizinhos da área espalhados pelo banner */}
        <div
          className="pointer-events-none absolute inset-0 flex flex-wrap content-center items-center justify-center gap-x-4 gap-y-2 overflow-hidden p-2 opacity-25 select-none"
          aria-hidden="true"
        >
          {Array.from({ length: 28 }).map((_, i) => (
            <span
              key={i}
              className="text-2xl sm:text-3xl"
              style={{ transform: `rotate(${(i % 3) - 1}0deg)` }}
            >
              {theme.emoji}
            </span>
          ))}
        </div>

        {/* Etiqueta da área */}
        <span className="absolute left-4 top-4 z-10 inline-flex items-center gap-1.5 rounded-full bg-black/30 px-3 py-1 text-xs font-semibold uppercase tracking-[1.5px] text-white backdrop-blur-sm">
          <span aria-hidden="true">{theme.emoji}</span>
          {theme.label}
        </span>

        {/* Foto em destaque, na frente do banner */}
        <div className="absolute inset-x-0 -bottom-12 z-20 flex justify-center sm:-bottom-14">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={`Foto de ${name}`}
              className="h-24 w-24 rounded-full border-4 border-surface-card bg-surface-card object-cover shadow-xl sm:h-28 sm:w-28"
            />
          ) : (
            <div
              className={`flex h-24 w-24 items-center justify-center rounded-full border-4 border-surface-card bg-gradient-to-br ${theme.gradient} text-2xl font-bold text-white shadow-xl sm:h-28 sm:w-28`}
              aria-hidden="true"
            >
              {getInitials(name)}
            </div>
          )}
        </div>
      </div>

      {/* Nome + cargo (espaço reservado para a foto sobreposta) */}
      <div className="flex flex-col items-center gap-1 px-6 pb-6 pt-16 text-center sm:pt-[4.5rem]">
        <h2 className="font-heading text-xl font-bold text-text-primary">{name || 'Usuário'}</h2>
        <p className="text-sm font-medium uppercase tracking-[1.5px] text-text-muted">{subtitle}</p>
      </div>
    </div>
  );
}
