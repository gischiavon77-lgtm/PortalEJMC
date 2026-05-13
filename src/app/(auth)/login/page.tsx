import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';

import { LoginForm } from '@/components/auth/LoginForm';

/**
 * Página `/login` — Portal Interno EJMC (Task 3.8).
 *
 * Server Component que renderiza apenas o card glassmorphism com
 * logo, título e o formulário interativo. A cena de fundo (`scene`
 * + 4 blobs animados + SVG orgânico + grão + light leak) e a
 * centralização vertical/horizontal são fornecidas pelo layout
 * `src/app/(auth)/layout.tsx` (Task 5.7), que aplica também o tema
 * escuro (`text-white`) e o `min-w-[320px]` exigido pelo Requisito
 * 20.4.
 *
 * ─── Conteúdo desta página ────────────────────────────────────────
 *
 *   - `<section.glass-card>` com `aria-labelledby="login-title"`,
 *     reaproveitando todas as classes utilitárias definidas em
 *     `src/app/globals.css` (Task 1.6).
 *   - Logo emblem (gradiente vermelho com glow) com a `logoejmc.png`
 *     servida estaticamente a partir de `public/`.
 *   - Formulário interativo (`LoginForm`) — único trecho `'use client'`,
 *     contendo a lógica de `signIn('credentials')` / `signIn('google')`
 *     e o mapeamento de erros (`?error=<code>`). Envolvido em `Suspense`
 *     porque usa `useSearchParams` (Next.js exige a fronteira para
 *     habilitar o prerender estático da página).
 *
 * ─── Responsividade (320px / 768px / 1024px) ──────────────────────
 *
 * O wrapper externo (`min-h-screen`, `min-w-[320px]`, padding lateral
 * e centralização) é aplicado pelo layout `(auth)`. Aqui apenas o
 * card preserva o limite de largura `max-w-[26.25rem]` (~420px) do
 * design original e o padding interno responsivo (`px-7 sm:px-11`).
 */

export const metadata: Metadata = {
  title: 'Acesso ao Portal — EJMC',
  description: 'Faça login no Portal Interno da EJMC.',
};

export default function LoginPage() {
  return (
    <section
      className="glass-card glass-card--reveal w-full max-w-[26.25rem] px-7 py-10 sm:px-11 sm:py-12"
      aria-labelledby="login-title"
    >
      {/* ─── Logo + identificação ─── */}
      <header className="mb-10 flex flex-col items-center text-center animate-fade-up opacity-0 [animation-delay:0.15s]">
        <div className="logo-emblem h-[100px] w-[100px]">
          <Image
            src="/logoejmc.png"
            alt="Logo EJMC"
            width={120}
            height={120}
            className="relative z-[2] block h-[120px] w-[120px] object-contain"
            priority
          />
        </div>
        <h1
          id="login-title"
          className="mt-6 font-heading text-[32px] font-black leading-none tracking-[-0.5px] text-white"
        >
          EJMC
          <span className="ml-0.5 align-super text-[18px] font-normal italic leading-none text-red-bright">
            Jr.
          </span>
        </h1>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[3px] text-white/35">
          Portal Interno
        </p>
      </header>

      <Suspense
        fallback={
          <div className="flex min-h-[260px] items-center justify-center">
            <span className="spinner-ring" aria-hidden="true" />
            <span className="sr-only">Carregando formulário…</span>
          </div>
        }
      >
        <LoginForm />
      </Suspense>

      <footer className="mt-9 border-t border-white/[0.07] pt-5 text-center animate-fade-up opacity-0 [animation-delay:0.55s]">
        <p className="text-[11px] tracking-[0.5px] text-white/20">
          EJMC — Empresa Júnior · Acesso restrito a membros
        </p>
      </footer>
    </section>
  );
}
