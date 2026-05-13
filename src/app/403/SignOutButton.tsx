'use client';

/**
 * `SignOutButton` — Client island da página `/403` (Task 4.7).
 *
 * Por que um Client Component isolado?
 *   A página `/403` (`src/app/403/page.tsx`) é um Server Component —
 *   ela só renderiza markup estático (cena de fundo + glass card +
 *   mensagem) e não precisa hidratar nada além desta ação. Encapsular
 *   o `signOut(...)` num arquivo `'use client'` próprio mantém o
 *   server tree pequeno e evita arrastar `next-auth/react` para o
 *   bundle inicial das outras páginas.
 *
 * Comportamento:
 *   - Dispara `signOut({ callbackUrl: '/login' })`. O NextAuth limpa o
 *     cookie de sessão e redireciona para `/login`. Em caso de falha
 *     de rede, o botão volta ao estado normal e o usuário pode tentar
 *     de novo (sem mensagem específica — o link "Voltar ao Dashboard"
 *     ao lado já é uma alternativa segura).
 *   - Bloqueia cliques duplos enquanto a chamada está em voo.
 *
 * Estilização: reutilizamos o mesmo padrão "secundário" do
 * `LoginForm.tsx` (botão branco/transparente sobre glass) para que a
 * página de 403 fique visualmente coerente com o restante do fluxo
 * público (`/login`, `/cadastro`).
 */

import { useState } from 'react';
import { signOut } from 'next-auth/react';

export function SignOutButton() {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    if (isSigningOut) return;
    setIsSigningOut(true);
    try {
      await signOut({ callbackUrl: '/login' });
    } catch {
      // Em caso de falha (rede/timeout), reabilitamos o botão para que
      // o usuário possa tentar novamente. Não exibimos mensagem própria
      // aqui — a alternativa "Voltar ao Dashboard" já está ao lado.
      setIsSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isSigningOut}
      aria-busy={isSigningOut}
      className="flex w-full items-center justify-center gap-2.5 rounded-md border border-white/15 bg-white/5 px-4 py-3 text-xs font-semibold uppercase tracking-[2px] text-white/85 transition-colors hover:border-white/30 hover:bg-white/10 focus-visible:border-white/40 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isSigningOut ? (
        <span
          className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-white/20 border-t-white"
          aria-hidden="true"
        />
      ) : (
        <svg
          viewBox="0 0 24 24"
          className="h-[17px] w-[17px] stroke-current"
          fill="none"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
          <polyline points="16 17 21 12 16 7" />
          <line x1="21" y1="12" x2="9" y2="12" />
        </svg>
      )}
      Sair
    </button>
  );
}
