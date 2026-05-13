import type { Metadata } from 'next';
import Image from 'next/image';

import { RegisterForm } from '@/components/auth/RegisterForm';

/**
 * Página `/cadastro` — Portal Interno EJMC (Task 3.9).
 *
 * Server Component que renderiza apenas o card glassmorphism com
 * logo, título e o formulário de auto-registro. A cena de fundo
 * (`scene` + 4 blobs + SVG orgânico + grão + light leak) e a
 * centralização vertical/horizontal são fornecidas pelo layout
 * `src/app/(auth)/layout.tsx` (Task 5.7), garantindo paridade
 * visual com `/login` sem duplicação de markup.
 *
 * ─── Conteúdo desta página ────────────────────────────────────────
 *
 *   - `<section.glass-card>` com `aria-labelledby="cadastro-title"`,
 *     replicando o padrão visual da página de login.
 *   - Logo emblem com `logoejmc.png` servida estaticamente.
 *   - `RegisterForm` (`'use client'`) — responsável por toda a
 *     interação: validação isomórfica com `registerSchema`, fetch
 *     para `POST /api/auth/register`, mapeamento de respostas
 *     201/400/409/500 para mensagens em pt-BR e redirect para
 *     `/login` após sucesso.
 *
 * ─── Responsividade (320px / 768px / 1024px) — Req 20.4 ───────────
 *
 * O wrapper externo (`min-h-screen`, `min-w-[320px]`, padding
 * lateral e centralização) é aplicado pelo layout `(auth)`. Aqui
 * apenas o card preserva o limite de largura `max-w-[26.25rem]`
 * (~420px) do design original e o padding interno responsivo
 * (`px-7 sm:px-11`).
 */

export const metadata: Metadata = {
  title: 'Criar conta — EJMC',
  description: 'Solicite acesso ao Portal Interno da EJMC.',
};

export default function CadastroPage() {
  return (
    <section
      className="glass-card glass-card--reveal w-full max-w-[26.25rem] px-7 py-10 sm:px-11 sm:py-12"
      aria-labelledby="cadastro-title"
    >
      {/* ─── Logo + identificação ─── */}
      <header className="mb-8 flex flex-col items-center text-center animate-fade-up opacity-0 [animation-delay:0.15s]">
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
          id="cadastro-title"
          className="mt-6 font-heading text-[28px] font-black leading-none tracking-[-0.5px] text-white"
        >
          Criar conta
        </h1>
        <p className="mt-2 text-[11px] font-medium uppercase tracking-[3px] text-white/35">
          Portal Interno
        </p>
        <p className="mt-3 max-w-[18rem] text-[13px] leading-relaxed text-white/45">
          Preencha seus dados para solicitar acesso. Sua conta passará por
          aprovação de um administrador.
        </p>
      </header>

      <RegisterForm />

      <footer className="mt-9 border-t border-white/[0.07] pt-5 text-center animate-fade-up opacity-0 [animation-delay:0.55s]">
        <p className="text-[11px] tracking-[0.5px] text-white/20">
          EJMC — Empresa Júnior · Acesso restrito a membros
        </p>
      </footer>
    </section>
  );
}
