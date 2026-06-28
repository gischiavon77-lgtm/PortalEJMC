'use client';

/**
 * `Sidebar` — Menu lateral persistente do portal autenticado (Task 5.1).
 *
 * Responsabilidades:
 *   1. Listar os módulos navegáveis (`MENU_ITEMS`), filtrando por
 *      permissão via `hasPermission(user, requiredAction)`. Itens sem
 *      `requiredAction` são visíveis a qualquer sessão autenticada.
 *   2. Realçar visualmente o item correspondente à rota atual
 *      (Req 6.5), usando `usePathname()` do App Router.
 *   3. Renderizar o cabeçalho com o emblema EJMC e o subtítulo
 *      "Portal Interno" no topo, mantendo identidade visual.
 *   4. Mostrar, no rodapé, um cartão com o usuário autenticado (nome,
 *      cargo/área) e o botão "Sair" (signOut com retorno a `/login`).
 *
 * ─── Por que ler `useSession()` aqui em vez de receber por props? ───
 *
 * O componente é montado em `(portal)/layout.tsx` (Task 5.2) — um
 * Server Component que ainda não foi escrito. Para evitar acoplamento
 * com o layout pai (que poderia ou não ler `auth()` do servidor),
 * mantemos o Sidebar autocontido lendo a sessão pelo provider
 * client-side já presente em `app/layout.tsx`. Quando a Task 5.2
 * vier, o layout pode passar a sessão como prop opcional para SSR
 * (otimização) sem quebrar este componente, porque o `useSession()`
 * cliente continuará servindo de fallback.
 *
 * ─── Filtragem por permissão (Req 5.3 / Property 8) ─────────────────
 *
 * Usamos `hasPermission` direto de `@/lib/permissions` em vez do hook
 * `usePermission` por item, porque:
 *   - Faz uma única leitura de `useSession()` para todos os itens.
 *   - A função é pura/sincrona — não há estado de loading por item;
 *     o estado de carregamento é centralizado no componente (durante
 *     `status === 'loading'` mostramos placeholders neutros para
 *     evitar "piscar" itens restritos).
 *   - Os predicados extras de `permissions.ts` continuam aplicados —
 *     a lógica é a mesma do middleware e das API Routes.
 *
 * ─── Estilização ────────────────────────────────────────────────────
 *
 * - Largura fixa `w-64` (256px) em desktop, conforme Task 5.1.
 * - Fundo `bg-surface-sidebar` (token escuro definido em globals.css
 *   `--surface-sidebar: #1a0a0d`) e texto branco — a cor escura cria
 *   contraste com a área de conteúdo clara (`--surface-bg`).
 * - Item ativo recebe um destaque com `bg-white/10` + barra vermelha
 *   à esquerda, similar ao padrão do design.md.
 * - Em mobile (<768px) o componente renderiza por padrão fora da
 *   viewport — o controle de abertura/fechamento será adicionado pela
 *   Task 5.3 (toggle hamburger) e é injetado via prop opcional `isOpen`.
 *
 * ─── Acessibilidade ─────────────────────────────────────────────────
 *
 * - `aria-label="Menu principal"` no `<nav>` (Req 22 — WCAG 2.1).
 * - `aria-current="page"` no item ativo para leitores de tela.
 * - Foco visível com `focus-visible` em cada link e botão (alta
 *   contraste com `outline` sobre o fundo escuro).
 * - Botão "Sair" com `aria-busy` durante o `signOut` para informar
 *   estado de processamento.
 */

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut, useSession } from 'next-auth/react';
import type { Area, UserRole } from '@prisma/client';

import { hasPermission, type PermissionUser } from '@/lib/permissions';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { effectivePosition } from '@/lib/position';

import { MENU_ITEMS, type SidebarIconName, type SidebarItem } from './sidebar-items';

interface SidebarProps {
  /**
   * Controla a visibilidade em viewports < 768px (Task 5.3). Em
   * desktop/tablet é ignorado. Default `false` para que o menu fique
   * recolhido em mobile sem necessidade de prop explícita até que a
   * Task 5.3 implemente o controle.
   */
  isOpen?: boolean;
  /**
   * Disparado quando um link é clicado em mobile, para que a Task 5.3
   * possa fechar o drawer. Em desktop o handler é ignorado.
   */
  onNavigate?: () => void;
}

export function Sidebar({ isOpen = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const { user: profile } = useCurrentUser();
  const [isSigningOut, setIsSigningOut] = useState(false);

  const isAuthenticated = status === 'authenticated' && Boolean(session?.user);

  // Enquanto a sessão carrega, escondemos itens com `requiredAction`.
  // Itens públicos (sem restrição) ainda aparecem para o esqueleto
  // ficar mais próximo do estado final e evitar layout shift quando
  // a sessão chega.
  const visibleItems: SidebarItem[] = MENU_ITEMS.filter((item) => {
    if (!item.requiredAction) return true;
    if (!isAuthenticated || !session?.user) return false;
    const user: PermissionUser = {
      role: session.user.role as UserRole,
      area: (session.user.area as Area | null) ?? null,
    };
    return hasPermission(user, item.requiredAction);
  });

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut({ callbackUrl: '/login' });
    } catch {
      // Em caso de falha (rede/timeout) reabilitamos o botão para o
      // usuário tentar novamente. A mensagem fica implícita; não
      // poluímos o sidebar com banner de erro neste caminho raro.
      setIsSigningOut(false);
    }
  }

  return (
    <aside
      id="portal-sidebar"
      className={[
        // Base
        'flex h-screen w-64 flex-col bg-surface-sidebar text-white',
        // Desktop/tablet: visível e fixo à esquerda.
        'sticky top-0',
        // Mobile: posicionamento fora da viewport por padrão. A Task
        // 5.3 controla `isOpen` e adiciona overlay/transição. A
        // duração 200ms reproduz o feel de drawers nativos sem
        // criar atraso perceptível.
        'mobile:fixed mobile:inset-y-0 mobile:left-0 mobile:z-40 mobile:transition-transform mobile:duration-200 mobile:ease-out',
        isOpen ? 'mobile:translate-x-0' : 'mobile:-translate-x-full',
      ].join(' ')}
      aria-label="Menu principal"
    >
      {/* ─── Cabeçalho: emblema + subtítulo ─── */}
      <div className="flex flex-col items-center border-b border-white/[0.08] px-4 py-6">
        <div className="logo-emblem h-14 w-14">
          <Image
            src="/logoejmc.png"
            alt="Logo EJMC"
            width={56}
            height={56}
            className="relative z-[2] block h-14 w-14 object-contain"
            priority
          />
        </div>
        <p className="mt-3 font-heading text-base font-bold tracking-[-0.3px] text-white">EJMC</p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-[2px] text-white/40">
          Portal Interno
        </p>
      </div>

      {/* ─── Navegação ─── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Navegação principal">
        <ul className="flex flex-col gap-0.5">
          {visibleItems.map((item) => {
            const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={false}
                  onClick={onNavigate}
                  aria-current={isActive ? 'page' : undefined}
                  className={[
                    // Base
                    'group relative flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-bright/60',
                    isActive
                      ? 'bg-white/10 text-white'
                      : 'text-white/65 hover:bg-white/[0.06] hover:text-white',
                  ].join(' ')}
                >
                  {/* Indicador de item ativo (barra vertical à esquerda) */}
                  <span
                    aria-hidden="true"
                    className={[
                      'absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-red-bright transition-opacity',
                      isActive ? 'opacity-100' : 'opacity-0',
                    ].join(' ')}
                  />
                  <SidebarIcon name={item.icon} />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* ─── Rodapé: usuário + sair ─── */}
      <div className="border-t border-white/[0.08] px-3 py-4">
        {isAuthenticated && session?.user ? (
          <div className="rounded-lg bg-white/[0.04] p-3">
            <div className="flex items-center gap-3">
              <Link
                href="/perfil"
                aria-label="Ir para perfil"
                className="shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-bright/60"
              >
                {(profile?.avatarUrl ?? session.user.image) ? (
                  <img
                    src={(profile?.avatarUrl ?? session.user.image) as string}
                    alt={profile?.name ?? session.user.name ?? 'Avatar'}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-red-core to-red-vivid text-xs font-bold text-white"
                    aria-hidden="true"
                  >
                    {getInitials(profile?.name ?? session.user.name ?? session.user.email ?? '?')}
                  </div>
                )}
              </Link>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">
                  {profile?.name ?? session.user.name ?? 'Usuário'}
                </p>
                <p className="truncate text-[11px] uppercase tracking-[1.5px] text-white/45">
                  {effectivePosition(profile?.role as UserRole, profile?.position) ||
                    formatAreaLabel((profile?.area as Area | null) ?? session.user.area)}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              disabled={isSigningOut}
              aria-busy={isSigningOut}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold uppercase tracking-[2px] text-white/85 transition-colors hover:border-white/25 hover:bg-white/10 focus-visible:border-white/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSigningOut ? (
                <span
                  className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"
                  aria-hidden="true"
                />
              ) : (
                <SidebarIcon name="logout" />
              )}
              Sair
            </button>
          </div>
        ) : (
          <p className="px-2 text-[11px] uppercase tracking-[1.5px] text-white/30">
            Sessão não disponível
          </p>
        )}
      </div>
    </aside>
  );
}

/**
 * Mapeia nomes de ícones para SVGs inline (sem dependência externa).
 *
 * `name` aceita também `'logout'` — usado apenas internamente pelo
 * botão "Sair" no rodapé. Ele é separado de `SidebarIconName` (que
 * cobre só os itens do menu) para que o tipo público continue restrito
 * ao catálogo de itens. Trocar tudo para uma biblioteca de ícones no
 * futuro é uma alteração local a este componente.
 */
function SidebarIcon({ name }: { name: SidebarIconName | 'logout' }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none' as const,
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
    className: 'h-[18px] w-[18px] shrink-0',
  };

  switch (name) {
    case 'home':
      return (
        <svg {...common}>
          <path d="M3 11l9-8 9 8" />
          <path d="M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
        </svg>
      );
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="17" rx="2" />
          <line x1="3" y1="10" x2="21" y2="10" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="16" y1="2" x2="16" y2="6" />
        </svg>
      );
    case 'target':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <circle cx="12" cy="12" r="5" />
          <circle cx="12" cy="12" r="1.5" />
        </svg>
      );
    case 'chart':
      return (
        <svg {...common}>
          <line x1="3" y1="20" x2="21" y2="20" />
          <rect x="6" y="11" width="3" height="9" />
          <rect x="11" y="6" width="3" height="14" />
          <rect x="16" y="14" width="3" height="6" />
        </svg>
      );
    case 'users':
      return (
        <svg {...common}>
          <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M22 21v-2a4 4 0 00-3-3.87" />
          <path d="M16 3.13a4 4 0 010 7.75" />
        </svg>
      );
    case 'briefcase':
      return (
        <svg {...common}>
          <rect x="2" y="7" width="20" height="14" rx="2" />
          <path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16" />
        </svg>
      );
    case 'folder':
      return (
        <svg {...common}>
          <path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z" />
        </svg>
      );
    case 'megaphone':
      return (
        <svg {...common}>
          <path d="M3 11v2a2 2 0 002 2h2l5 4V5L7 9H5a2 2 0 00-2 2z" />
          <path d="M16 8a4 4 0 010 8" />
        </svg>
      );
    case 'vote':
      return (
        <svg {...common}>
          <path d="M9 11l3 3 8-8" />
          <path d="M20 12v7a2 2 0 01-2 2H6a2 2 0 01-2-2V6a2 2 0 012-2h9" />
        </svg>
      );
    case 'alert':
      return (
        <svg {...common}>
          <path d="M10.3 3.86l-8.1 14a2 2 0 001.7 3h16.2a2 2 0 001.7-3l-8.1-14a2 2 0 00-3.4 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'monitor':
      return (
        <svg {...common}>
          <rect x="2" y="3" width="20" height="14" rx="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common}>
          <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.7 1.7 0 00.34 1.87l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.7 1.7 0 00-1.87-.34 1.7 1.7 0 00-1 1.55V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.11-1.55 1.7 1.7 0 00-1.87.34l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.7 1.7 0 00.34-1.87 1.7 1.7 0 00-1.55-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.55-1.11 1.7 1.7 0 00-.34-1.87l-.06-.06a2 2 0 112.83-2.83l.06.06a1.7 1.7 0 001.87.34h.04a1.7 1.7 0 001-1.55V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.55 1.7 1.7 0 001.87-.34l.06-.06a2 2 0 112.83 2.83l-.06.06a1.7 1.7 0 00-.34 1.87v.04a1.7 1.7 0 001.55 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.55 1z" />
        </svg>
      );
    case 'shield':
      return (
        <svg {...common}>
          <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...common}>
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      );
  }
}

/**
 * Extrai até duas iniciais de um nome ou email para o avatar
 * fallback. "Maria Silva" → "MS"; "fulano@ejmc.com" → "FU".
 */
function getInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '?';

  // Se for email, usa o local-part.
  const base = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  const parts = base.split(/\s+/).filter(Boolean);

  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Mapeia o enum `Area` do Prisma para um rótulo legível em pt-BR. Os
 * valores são `SCREAMING_SNAKE_CASE` no banco; aqui formatamos para
 * exibição. Quando `area` é `null` (admins sem área associada), o
 * rótulo cai para "Administração" — coerente com a hierarquia.
 */
function formatAreaLabel(area: Area | null | undefined): string {
  if (!area) return 'Administração';

  const map: Record<Area, string> = {
    VENDAS: 'Vendas',
    PRESIDENCIA: 'Presidência',
    PROJETOS: 'Projetos',
    MARKETING: 'Marketing',
    GESTAO_PESSOAS: 'Gestão de Pessoas',
    ADM_FIN: 'Adm-Fin',
  };
  return map[area];
}
