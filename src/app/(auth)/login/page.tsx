import type { Metadata } from 'next';
import Image from 'next/image';
import { Suspense } from 'react';

import { LoginForm } from '@/components/auth/LoginForm';

/**
 * Página `/login` — Portal Interno EJMC (Task 3.8).
 *
 * Server Component que monta a estrutura visual herdada do `login.html`:
 *   - Cena de fundo (`scene` + 4 blobs animados + SVG orgânico + grão +
 *     light leak) usando as classes utilitárias já definidas em
 *     `src/app/globals.css` (Task 1.6).
 *   - Card glassmorphism (`glass-card glass-card--reveal`) centralizado.
 *   - Logo emblem (gradiente vermelho com glow) com a `logoejmc.png`
 *     servida estaticamente a partir de `public/`.
 *   - Formulário interativo (`LoginForm`) — único trecho `'use client'`,
 *     contendo a lógica de `signIn('credentials')` / `signIn('google')`
 *     e o mapeamento de erros (`?error=<code>`). Envolvido em `Suspense`
 *     porque usa `useSearchParams` (Next.js exige a fronteira para
 *     habilitar o prerender estático da página).
 *
 * Nota sobre o layout `(auth)/layout.tsx`:
 *   A Task 5.7 prevê um layout dedicado para as páginas públicas
 *   (`login`, `cadastro`) com o background unificado. Enquanto essa
 *   task não estiver concluída, o background é inlinado aqui e na
 *   página `/cadastro` (Task 3.9). Quando a Task 5.7 for executada,
 *   esses fragmentos podem ser removidos sem alterar o visual.
 *
 * Responsividade (320px / 768px / 1024px):
 *   - Container `min-h-screen` com `min-w-[320px]` garante a largura
 *     mínima exigida pelo Requisito 20.4.
 *   - Padding lateral variável (`px-4 sm:px-6`) e card com `max-w-md`
 *     (~28rem) preservam o respiro visual em qualquer breakpoint.
 *   - Card cresce até 420px (`max-w-[26.25rem]`) replicando o limite
 *     do design original.
 */

export const metadata: Metadata = {
  title: 'Acesso ao Portal — EJMC',
  description: 'Faça login no Portal Interno da EJMC.',
};

export default function LoginPage() {
  return (
    <div className="relative min-h-screen min-w-[320px] overflow-hidden text-white">
      {/* ─── Background ─── */}
      <div className="scene" aria-hidden="true">
        <div className="blob blob-1" />
        <div className="blob blob-2" />
        <div className="blob blob-3" />
        <div className="blob blob-4" />

        <svg
          className="organic-svg"
          viewBox="0 0 1440 900"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M-80,200 C100,100 300,350 500,200 S800,50 1000,200 S1300,400 1520,250"
            stroke="#c0182e"
            strokeWidth="1.5"
            fill="none"
          />
          <path
            d="M0,500 C200,380 400,600 600,480 S900,350 1100,500 S1350,650 1520,520"
            stroke="#e8203a"
            strokeWidth="1"
            fill="none"
            opacity="0.6"
          />
          <path
            d="M200,750 C350,680 550,800 700,720 S950,600 1150,750 S1380,850 1520,780"
            stroke="#7a1220"
            strokeWidth="2"
            fill="none"
            opacity="0.4"
          />
          <ellipse
            cx="200"
            cy="150"
            rx="300"
            ry="180"
            fill="#7a1220"
            opacity="0.12"
            transform="rotate(-15,200,150)"
          />
          <ellipse
            cx="1200"
            cy="720"
            rx="280"
            ry="160"
            fill="#c0182e"
            opacity="0.1"
            transform="rotate(10,1200,720)"
          />
        </svg>

        <div className="grain" />
        <div className="light-leak" />
      </div>

      {/* ─── Card centralizado ─── */}
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
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
      </main>
    </div>
  );
}
