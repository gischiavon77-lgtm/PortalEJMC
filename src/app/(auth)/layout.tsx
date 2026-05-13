import type { ReactNode } from 'react';

import { AuthBackground } from '@/components/layout/AuthBackground';

/**
 * Layout do grupo de rotas públicas `(auth)` (Task 5.7).
 *
 * Server Component que centraliza a cena visual de fundo (4 blobs
 * animados + SVG orgânico + grão + light leak) usada por todas as
 * páginas públicas do portal — atualmente `/login` (Task 3.8) e
 * `/cadastro` (Task 3.9).
 *
 * Antes desta task, cada página inlinava o markup completo da cena,
 * o que gerava duplicação e risco de divergência visual entre
 * `/login` e `/cadastro`. Centralizar a cena em `(auth)/layout.tsx`
 * (e em `<AuthBackground/>`) elimina a duplicação e garante
 * consistência visual ao custo de zero re-render — o layout é
 * estático e renderizado uma única vez para todo o segmento, então
 * a navegação entre `/login` ↔ `/cadastro` preserva os blobs e
 * animações em curso (App Router segmenta layouts).
 *
 * ─── Estrutura ─────────────────────────────────────────────────────
 *
 *   <div .relative .min-h-screen .min-w-[320px] .overflow-hidden .text-white>
 *     <AuthBackground />              ← decoração (aria-hidden)
 *     <main .relative .z-10 ...>      ← conteúdo da página
 *       {children}
 *     </main>
 *   </div>
 *
 * O contêiner raiz fixa o tema escuro (`text-white`) — separando-o
 * do tema claro do `(portal)` — e estabelece o `min-w-[320px]`
 * exigido pelo Requisito 20.4 (responsividade mínima).
 *
 * O `<main>` aplica `relative z-10` para sobrepor a cena e usa
 * Flex para centralizar o card glass das páginas filhas vertical e
 * horizontalmente. As páginas (`/login`, `/cadastro`) renderizam
 * apenas o `<section>` do card, sem repetir o wrapper de
 * background.
 *
 * ─── Por que Server Component? ─────────────────────────────────────
 *
 * Não há estado nem interatividade (a cena é puramente CSS). Manter
 * como Server Component evita JS desnecessário no bundle público e
 * preserva o prerender estático das páginas filhas que também são
 * servers (Task 3.8 / 3.9).
 *
 * Não chamamos `auth()` aqui (diferentemente de `(portal)/layout`):
 * estas são páginas públicas. O middleware (Task 4.3) cuida de
 * redirecionar usuários **já logados** que tentem acessar `/login`
 * ou `/cadastro`, conforme a configuração de rotas públicas.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative min-h-screen min-w-[320px] overflow-hidden text-white">
      <AuthBackground />

      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        {children}
      </main>
    </div>
  );
}
