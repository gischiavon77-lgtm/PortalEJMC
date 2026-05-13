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

import { Sidebar } from './Sidebar';

interface PortalShellProps {
  children: ReactNode;
}

export function PortalShell({ children }: PortalShellProps) {
  const [isOpen, setIsOpen] = useState(false);

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
    <div className="flex min-h-screen bg-surface-bg text-text-primary">
      {/* ─── Topbar mobile (hamburger + EJMC) ───
          Visível apenas em viewports < 768px. `position: fixed` para
          permanecer no topo enquanto o conteúdo rola. Z-index 30 fica
          abaixo do drawer (z-40 na Sidebar) para ser ocultado pela
          drawer aberta. */}
      <header
        className="mobile:flex hidden fixed inset-x-0 top-0 z-30 h-14 items-center justify-between border-b border-border-light bg-surface-card px-3 shadow-sm"
        aria-label="Cabeçalho mobile"
      >
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          aria-label="Abrir menu de navegação"
          aria-expanded={isOpen}
          aria-controls="portal-sidebar"
          className="flex h-11 w-11 items-center justify-center rounded-md text-text-primary transition-colors hover:bg-border-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/40"
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

        <span
          className="font-heading text-lg font-bold tracking-[-0.3px] text-text-primary"
          aria-hidden="true"
        >
          EJMC
        </span>

        {/* Spacer simétrico para manter o título centralizado */}
        <span aria-hidden="true" className="h-11 w-11" />
      </header>

      {/* ─── Backdrop ───
          Fica logo abaixo da Sidebar (z-30 vs z-40). Renderizado
          sempre, com transição de opacidade controlada por `isOpen`.
          `pointer-events-none` quando fechado evita capturar cliques
          mortos. Apenas em mobile (`hidden mobile:block`). */}
      <div
        data-testid="portal-shell-backdrop"
        onClick={() => setIsOpen(false)}
        aria-hidden="true"
        className={[
          'mobile:block hidden fixed inset-0 z-30 bg-black/50 transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'pointer-events-none opacity-0',
        ].join(' ')}
      />

      {/* ─── Sidebar ───
          Em desktop/tablet ela fica visível (sticky) à esquerda. Em
          mobile recebe `isOpen` para abrir/fechar e `onNavigate` para
          fechar quando o usuário clicar em um link. */}
      <Sidebar isOpen={isOpen} onNavigate={() => setIsOpen(false)} />

      {/* ─── Conteúdo principal ───
          `flex-1` ocupa o espaço restante em desktop/tablet. Em
          mobile, `pt-14` reserva espaço para a topbar fixa. Padding
          horizontal cresce em telas maiores para dar respiro. */}
      <main className="flex-1 px-4 py-6 mobile:pt-20 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
