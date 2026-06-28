/**
 * Tema visual por Área — cores (gradiente) e animal (emoji).
 *
 * Fonte única da verdade para a identidade visual de cada área,
 * reutilizada no álbum de figurinhas e no banner do perfil.
 *
 * Animais/cores (identidade EJMC):
 *   - Vendas            🦈 tubarão     — verde-água (teal)
 *   - Presidência       🐘 elefante    — vermelho escuro
 *   - Projetos          🐙 polvo       — laranja
 *   - Marketing         🦅 águia       — roxo
 *   - Gestão de Pessoas 🐬 golfinho    — azul claro (sky)
 *   - Adm-Fin           🦁 leão        — amarelo
 *
 * Sem área (ex.: Admin): mascote lobo 🐺 com gradiente vermelho EJMC.
 */

import type { Area } from '@prisma/client';

export interface AreaTheme {
  label: string;
  emoji: string;
  /** Classes Tailwind do gradiente (usar com `bg-gradient-to-r`). */
  gradient: string;
}

export const AREA_THEME: Record<Area, AreaTheme> = {
  VENDAS: { label: 'Vendas', emoji: '🦈', gradient: 'from-teal-400 to-teal-600' },
  PRESIDENCIA: { label: 'Presidência', emoji: '🐘', gradient: 'from-red-800 to-red-950' },
  PROJETOS: { label: 'Projetos', emoji: '🐙', gradient: 'from-orange-500 to-orange-700' },
  MARKETING: { label: 'Marketing', emoji: '🦅', gradient: 'from-purple-500 to-purple-700' },
  GESTAO_PESSOAS: { label: 'Gestão de Pessoas', emoji: '🐬', gradient: 'from-sky-400 to-sky-600' },
  ADM_FIN: { label: 'Adm-Fin', emoji: '🦁', gradient: 'from-yellow-500 to-amber-600' },
};

export const DEFAULT_AREA_THEME: AreaTheme = {
  label: 'Administração',
  emoji: '🐺',
  gradient: 'from-red-core to-red-vivid',
};

export function getAreaTheme(area: Area | null | undefined): AreaTheme {
  if (!area) return DEFAULT_AREA_THEME;
  return AREA_THEME[area] ?? DEFAULT_AREA_THEME;
}
