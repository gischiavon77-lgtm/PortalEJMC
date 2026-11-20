/**
 * Tema visual por Área — cor de destaque (fio discreto) e animal (emoji).
 *
 * Fonte única da verdade para a identidade visual de cada área,
 * reutilizada na Estrutura (cards de área e organograma) e no banner do perfil.
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
  /** Classe Tailwind de fundo na cor da área (usar num fio fino, não em blocos). */
  accent: string;
}

export const AREA_THEME: Record<Area, AreaTheme> = {
  VENDAS: { label: 'Vendas', emoji: '🦈', accent: 'bg-area-vendas' },
  PRESIDENCIA: { label: 'Presidência', emoji: '🐘', accent: 'bg-area-presidencia' },
  PROJETOS: { label: 'Projetos', emoji: '🐙', accent: 'bg-area-projetos' },
  MARKETING: { label: 'Marketing', emoji: '🦅', accent: 'bg-area-marketing' },
  GESTAO_PESSOAS: { label: 'Gestão de Pessoas', emoji: '🐬', accent: 'bg-area-gp' },
  ADM_FIN: { label: 'Adm-Fin', emoji: '🦁', accent: 'bg-area-admfin' },
};

export const DEFAULT_AREA_THEME: AreaTheme = {
  label: 'Administração',
  emoji: '🐺',
  accent: 'bg-brand',
};

export function getAreaTheme(area: Area | null | undefined): AreaTheme {
  if (!area) return DEFAULT_AREA_THEME;
  return AREA_THEME[area] ?? DEFAULT_AREA_THEME;
}
