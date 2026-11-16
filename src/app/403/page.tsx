import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';

import { SignOutButton } from './SignOutButton';

/**
 * Página `/403` — Acesso restrito (Task 4.7).
 *
 * Server Component que comunica ao usuário, com mensagem genérica e em
 * pt-BR, que ele não tem permissão para acessar o recurso solicitado.
 * Esta é a página de destino para os redirects emitidos pelo
 * middleware (Task 4.3) quando um usuário autenticado tenta atingir
 * uma rota restrita (ex.: `/admin/**` sem ser ADMIN), e poderá ser
 * referenciada por wrappers de UI (Task 4.5) para o mesmo fim.
 *
 * ─── Conformidade com Req 5.2 ───────────────────────────────────────
 *
 *   "Bloquear o acesso e exibir uma mensagem informando que o acesso é
 *    restrito, sem revelar detalhes sobre a funcionalidade protegida."
 *
 * Por isso a mensagem aqui é deliberadamente genérica — não dizemos
 * "você não pode acessar /admin", apenas "você não tem permissão para
 * acessar esta página". A `metadata.robots = { index: false }` evita
 * que mecanismos de busca cataloguem a URL e seu título.
 *
 * ─── Sobre o status HTTP ────────────────────────────────────────────
 *
 * Páginas do App Router em Next 14 são entregues com HTTP 200 por
 * padrão — não há API estável de Server Component para emitir 403
 * (ao contrário de 404 via `notFound()`). O middleware (Task 4.3)
 * redireciona o usuário para `/403`, então o status final percebido
 * pelo navegador é 307/200 (redirect + página). Isso é aceitável
 * porque:
 *
 *   1. Crawlers públicos não chegam aqui (rota privada por trás do
 *      middleware) e o `noindex` impede indexação caso a URL vaze.
 *   2. O contrato HTTP estrito de 403 é coberto pelas API Routes via
 *      `forbiddenResponse()` em `@/lib/api-auth.ts` (Task 4.4); isto
 *      é, a fronteira programática (frontend → API) já devolve 403
 *      conforme o design.md.
 *
 * Quando o projeto migrar para Next 15+, a função `forbidden()` poderá
 * ser usada aqui para fechar a brecha — não há mudança visual
 * necessária, somente a linha que dispara o status. Mantemos a opção
 * documentada para revisão futura.
 *
 * ─── Estilização ────────────────────────────────────────────────────
 *
 * Replica a estética das páginas públicas (`/login`, `/cadastro` —
 * Tasks 3.8 e 3.9): cena de fundo (`scene` + 4 blobs animados +
 * SVG orgânico + grão + light leak) e card glass centralizado, todos
 * usando classes utilitárias já definidas em `src/app/globals.css`
 * (Task 1.6). Essa escolha mantém coerência visual mesmo quando o
 * usuário "cai" do portal interno (camada clara) para a camada escura
 * do design system.
 *
 * Responsividade (Req 20.4):
 *   - `min-h-screen min-w-[320px]` cobre o viewport mínimo.
 *   - Padding lateral variável (`px-4 sm:px-6`) e card com
 *     `max-w-[26.25rem]` (~420px) preservam respiro visual em
 *     qualquer breakpoint.
 *
 * ─── Composição de Server + Client ──────────────────────────────────
 *
 * Toda a página é Server Component, exceto o botão "Sair", que vive em
 * `./SignOutButton.tsx` (`'use client'`). A separação minimiza o
 * bundle JS enviado: apenas a lógica do `signOut(...)` precisa de
 * hidratação. O link "Voltar ao Dashboard" é um `next/link` puro e
 * navega via SSR.
 */

export const metadata: Metadata = {
  title: 'Acesso restrito — EJMC',
  description: 'Você não tem permissão para acessar esta página.',
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <div className="relative min-h-screen min-w-[320px] overflow-hidden text-white">
      {/* ─── Card centralizado ─── */}
      <main className="relative z-10 flex min-h-screen items-center justify-center px-4 py-10 sm:px-6">
        <section
          className="auth-card w-full max-w-[26.25rem] px-7 py-10 sm:px-11 sm:py-12"
          aria-labelledby="forbidden-title"
          role="alert"
          aria-live="polite"
        >
          {/* ─── Logo + identificação ─── */}
          <header className="mb-8 flex flex-col items-center text-center animate-fade-up opacity-0 [animation-delay:0.15s]">
            <div className="h-[100px] w-[100px]">
              <Image
                src="/logoejmc.png"
                alt="Logo EJMC"
                width={120}
                height={120}
                className="relative z-[2] block h-[120px] w-[120px] object-contain"
                priority
              />
            </div>
            <p className="mt-6 text-[11px] font-medium text-danger">403 · Erro</p>
            <h1
              id="forbidden-title"
              className="mt-2 font-heading text-[28px] font-extrabold leading-tight tracking-[-0.5px] text-white"
            >
              Acesso restrito
            </h1>
            <p className="mt-4 max-w-[20rem] text-[14px] leading-relaxed text-white/55 text-balance">
              Você não tem permissão para acessar esta página. Se acredita que isso é um engano,
              entre em contato com um administrador.
            </p>
          </header>

          {/* ─── Ações (voltar / sair) ─── */}
          <div className="flex flex-col gap-3 animate-fade-up opacity-0 [animation-delay:0.28s]">
            <Link href="/dashboard" className="auth-button" prefetch={false}>
              Voltar ao Dashboard
              <svg
                viewBox="0 0 24 24"
                className="h-4 w-4 stroke-current"
                fill="none"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="5" y1="12" x2="19" y2="12" />
                <polyline points="12,5 19,12 12,19" />
              </svg>
            </Link>

            <SignOutButton />
          </div>

          <footer className="mt-9 border-t border-white/[0.07] pt-5 text-center animate-fade-up opacity-0 [animation-delay:0.4s]">
            <p className="text-[11px] tracking-[0.5px] text-white/20">
              EJMC — Empresa Júnior · Acesso restrito a membros
            </p>
          </footer>
        </section>
      </main>
    </div>
  );
}
