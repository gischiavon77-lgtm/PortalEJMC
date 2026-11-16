'use client';

/**
 * `PortalShell` — Casca client-side do layout autenticado (Tasks 5.3 e 5.4).
 *
 * Encapsula o estado e a interatividade que o layout do grupo
 * `(portal)` precisa: abrir/fechar o drawer da `Sidebar` em viewports
 * mobile (<768px), exibir a barra superior com botão hamburger e
 * lidar com o backdrop, tecla Escape e bloqueio de scroll do `body`.
 *
 * ─── Por que separar este componente do `(portal)/layout.tsx`? ──────
 *
 * O `layout.tsx` da Task 5.2 é um Server Component — chama `auth()`
 * (Node-only, depende de Prisma) para fazer a checagem defensiva de
 * sessão antes de qualquer render. Hooks de cliente (`useState`,
 * `useEffect`) não vivem em Server Components, então o controle do
 * drawer fica aqui, em uma boundary `'use client'` própria. O layout
 * server-side apenas instancia o shell e injeta `children`. Esse
 * split mantém o `auth()` no servidor (sem expor segredo nem inflar
 * o bundle) e isola o JS interativo no que realmente precisa.
 *
 * ─── Estratégia de responsividade (Req 6.2, 6.3, 6.4 / Req 20.1–20.3) ──
 *
 * Em desktop/tablet (≥768px) o layout é um `flex` com a `Sidebar`
 * ocupando 256px à esquerda e o conteúdo principal preenchendo o
 * resto. A própria `Sidebar` usa `sticky top-0`, então rola junto com
 * a página até onde for necessário e fica fixa na viewport.
 *
 * Em mobile (<768px) a `Sidebar` muda para `position: fixed`
 * (configurado via `mobile:fixed` na própria `Sidebar`) e desliza
 * para fora da viewport com `translate-x` — isso evita re-renderizar
 * a árvore quando o drawer abre/fecha e dá uma transição GPU-friendly
 * via CSS. O `PortalShell` controla apenas o booleano `isOpen` e
 * repassa para `Sidebar` + backdrop. A barra superior (`<header>`)
 * fica visível apenas em mobile (`hidden mobile:flex`), aparecendo
 * sobre a área de conteúdo com `position: fixed`.
 *
 * ─── Acessibilidade ────────────────────────────────────────────────
 *
 *   - Botão hamburger com `aria-expanded`, `aria-controls` e
 *     `aria-label` em pt-BR (Req 22). Tamanho 44×44px (Req 20.3).
 *   - Tecla `Escape` fecha o drawer enquanto ele estiver aberto —
 *     escutamos no `window` apenas durante esse intervalo para evitar
 *     poluir o event-loop com listeners ociosos.
 *   - Backdrop usa `aria-hidden="true"` (decoração) e bloqueia
 *     interação no resto da página enquanto o drawer está aberto.
 *   - Scroll do `body` é travado enquanto o drawer estiver aberto
 *     para impedir o "scroll bleed" comum em drawers mobile.
 *
 * ─── Por que não fechar o drawer ao redimensionar para desktop? ─────
 *
 * O `isOpen` só tem efeito visual abaixo de 768px (as classes da
 * `Sidebar` e do backdrop são todas com prefixo `mobile:`). Em
 * desktop/tablet, qualquer valor é ignorado pelo CSS — a sidebar
 * permanece visível e o backdrop fica `display: none`. Não precisamos
 * resetar `isOpen` no resize, mantendo o componente sem listeners
 * adicionais. Quando o usuário voltar para mobile (rotação, devtools),
 * o drawer reaparecerá no estado em que estava — comportamento aceitável.
 */

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { signOut, useSession } from 'next-auth/react';

import { Sidebar } from './Sidebar';
import { NotificationBell } from './NotificationBell';
import { useCurrentUser } from '@/hooks/useCurrentUser';

interface PortalShellProps {
  children: ReactNode;
}

export function PortalShell({ children }: PortalShellProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const { data: session } = useSession();
  const { user: profile } = useCurrentUser();

  // Tecla Escape fecha o drawer (apenas quando aberto, para evitar
  // listeners desnecessários). Limpamos o handler no cleanup.
  useEffect(() => {
    if (!isOpen) return;

    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  // Trava o scroll do `body` enquanto o drawer está aberto. Em
  // desktop/tablet o drawer não aparece visualmente, mas como
  // `isOpen` ainda pode ser `true` (caso o usuário tenha aberto e
  // depois redimensionado), aplicamos a trava sem condicional de
  // viewport — ela é inofensiva nesses cenários e evita flicker.
  useEffect(() => {
    if (!isOpen) return;

    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isOpen]);

  return (
    <div className="min-h-screen bg-bg text-text">
      {/* ─── Barra superior ───
          Fixa no topo. No celular (< 768px) traz o botão do menu, a
          marca, o sino e o avatar. A partir do tablet começa depois da
          sidebar fixa e mostra só o sino e o avatar, à direita.
          Z-index 30 fica abaixo da Sidebar (z-40), que a cobre quando
          o menu abre no celular. */}
      <header
        className="fixed inset-x-0 top-0 z-30 flex h-topbar items-center justify-between border-b border-border bg-bg px-3 tablet:left-sidebar tablet:px-6"
        aria-label="Barra superior"
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir menu de navegação"
          aria-expanded={isOpen}
          aria-controls="portal-sidebar"
          className="flex h-11 w-11 items-center justify-center rounded-md text-text transition-colors hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 tablet:hidden"
        >
          <svg
            viewBox="0 0 24 24"
            width="22"
            height="22"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        <span className="font-heading text-lg font-bold text-text tablet:hidden" aria-hidden="true">
          EJMC
        </span>

        {/* Lado direito: sino de notificações + avatar */}
        <div className="ml-auto flex items-center gap-2">
          {/* Notification bell (funcional) */}
          <NotificationBell tone="dark" />

          {/* User avatar with dropdown */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setAvatarMenuOpen((v) => !v)}
              aria-label="Menu do perfil"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            >
              {(profile?.avatarUrl ?? session?.user?.image) ? (
                <img
                  src={(profile?.avatarUrl ?? session?.user?.image) as string}
                  alt={profile?.name ?? session?.user?.name ?? 'Avatar'}
                  className="h-8 w-8 rounded-full object-cover"
                />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface-raised text-[11px] font-bold text-white">
                  {getInitials(profile?.name ?? session?.user?.name ?? session?.user?.email ?? '?')}
                </span>
              )}
            </button>
            {avatarMenuOpen && (
              <div className="absolute right-0 top-10 z-50 w-40 rounded-lg border border-border bg-surface py-1">
                <Link
                  href="/perfil"
                  onClick={() => setAvatarMenuOpen(false)}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-text hover:bg-surface-raised"
                >
                  Meu Perfil
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setAvatarMenuOpen(false);
                    signOut({ callbackUrl: '/login' });
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-sm text-danger hover:bg-brand/20"
                >
                  Sair
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ─── Backdrop ───
          Fica logo abaixo da Sidebar (z-30 vs z-40). Renderizado
          sempre, com transição de opacidade controlada por `isOpen`.
          `pointer-events-none` quando fechado evita capturar cliques
          mortos. Só existe no celular (`tablet:hidden`). */}
      <div
        data-testid="portal-shell-backdrop"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
        className={[
          'fixed inset-0 z-30 bg-black/70 transition-opacity duration-200 tablet:hidden',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      />

      {/* ─── Sidebar ───
          Fixa à esquerda, na altura toda. Em tablet/desktop fica sempre
          visível; no celular recebe `isOpen` para abrir/fechar e
          `onNavigate` para fechar quando o usuário clicar em um link. */}
      <Sidebar isOpen={isOpen} onNavigate={() => setIsOpen(false)} />

      {/* ─── Conteúdo principal ───
          `tablet:pl-sidebar` abre espaço para a sidebar fixa e
          `pt-topbar` para a barra superior. O padding horizontal
          cresce em telas maiores para dar respiro. */}
      <div className="pt-topbar tablet:pl-sidebar">
        <main className="px-4 py-6 sm:px-6 desktop:px-8 desktop:py-8">{children}</main>
      </div>
    </div>
  );
}

/**
 * Extrai até duas iniciais de um nome ou email para o avatar fallback.
 */
function getInitials(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '?';
  const base = trimmed.includes('@') ? trimmed.split('@')[0] : trimmed;
  const parts = base.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}
