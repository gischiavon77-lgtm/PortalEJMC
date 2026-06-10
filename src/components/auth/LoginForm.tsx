'use client';

/**
 * `LoginForm` — Formulário de login do Portal Interno EJMC (Task 3.8).
 *
 * Componente cliente responsável por:
 *   1. Coletar email + senha e disparar `signIn('credentials', …)` do
 *      NextAuth v5, com `redirect: false` para que possamos exibir
 *      mensagens específicas via `?error=<code>` antes de navegar.
 *   2. Disparar `signIn('google', { callbackUrl: '/dashboard' })` para o
 *      fluxo OAuth.
 *   3. Mapear os códigos de erro emitidos pelo `auth.ts`
 *      (`AUTH_ERROR_CODES`) para mensagens amigáveis em pt-BR — tanto
 *      os que chegam como `?error=...` (depois de redirect) quanto os
 *      que retornam no objeto `result.error.code` do `signIn` cliente.
 *   4. Manter a estética do design system (glass card, ícones,
 *      placeholder em caixa-alta com letterspacing, spinner no botão
 *      branco, banner de erro com shake) reutilizando as classes
 *      utilitárias já definidas em `src/app/globals.css`.
 *
 * Decisões importantes:
 *   - O componente usa `redirect: false` no Credentials para garantir que
 *     o tratamento de erros aconteça inline (sem reload da página). Em
 *     caso de sucesso, navegamos manualmente para o `callbackUrl`,
 *     respeitando `?callbackUrl=` da URL ou caindo em `/dashboard`.
 *   - Para o Google, deixamos o `redirect` padrão (true): o NextAuth
 *     já redireciona o usuário ao provedor e, em caso de erro,
 *     devolve para `/login?error=<code>`, que esta página lê na primeira
 *     renderização (via `searchParams`/`useSearchParams`).
 *   - A mensagem genérica de credenciais inválidas (Property 1 / Req 1.2)
 *     é a default — qualquer erro não-mapeado também cai nela, evitando
 *     enumeração de contas.
 *   - `noValidate` no `<form>` para que o navegador não tome conta da
 *     validação básica de email; isso permite que nossas mensagens em
 *     pt-BR predominem.
 */

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signIn } from 'next-auth/react';

import {
  ERROR_MESSAGES,
  GENERIC_CREDENTIALS_MESSAGE,
  resolveErrorMessage,
} from './login-error-messages';

const DEFAULT_CALLBACK_URL = '/dashboard';

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const callbackUrl = searchParams.get('callbackUrl') ?? DEFAULT_CALLBACK_URL;
  const initialErrorCode = searchParams.get('error');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(() =>
    resolveErrorMessage(initialErrorCode),
  );

  // Sincroniza com mudanças do query string (por exemplo, voltar do
  // fluxo Google com `?error=AccountInactive`). `useEffect` garante que
  // a mensagem seja renovada sem exigir um remount manual.
  useEffect(() => {
    setErrorMessage(resolveErrorMessage(initialErrorCode));
  }, [initialErrorCode]);

  async function handleCredentialsSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting) return;

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      const result = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
        callbackUrl,
      });

      if (!result) {
        setErrorMessage(GENERIC_CREDENTIALS_MESSAGE);
        return;
      }

      if (result.error) {
        // O NextAuth pode devolver o código específico (`AccountPending`,
        // `AccountLocked`, …) ou apenas `CredentialsSignin`. Em ambos os
        // casos, `resolveErrorMessage` retorna a mensagem correta.
        setErrorMessage(resolveErrorMessage(result.error) ?? GENERIC_CREDENTIALS_MESSAGE);
        return;
      }

      if (result.ok) {
        router.push(result.url ?? callbackUrl);
        router.refresh();
      } else {
        setErrorMessage(GENERIC_CREDENTIALS_MESSAGE);
      }
    } catch {
      // Falhas inesperadas (rede, timeout) caem na mensagem genérica.
      setErrorMessage(GENERIC_CREDENTIALS_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    if (isGoogleLoading) return;
    setIsGoogleLoading(true);
    setErrorMessage(null);
    try {
      // Mantemos `redirect: true` (default) — o NextAuth navega o
      // navegador ao Google. Em caso de falha, o callback retorna o
      // usuário a `/login?error=<code>` e a página exibe a mensagem.
      await signIn('google', { callbackUrl });
    } catch {
      setIsGoogleLoading(false);
      setErrorMessage(ERROR_MESSAGES.OAuthSignin);
    }
  }

  return (
    <form
      noValidate
      onSubmit={handleCredentialsSubmit}
      className="flex flex-col gap-3.5 animate-fade-up opacity-0 [animation-delay:0.28s]"
    >
      {errorMessage ? (
        <div className="error-banner" role="alert" aria-live="polite">
          {errorMessage}
        </div>
      ) : null}

      {/* ─── Campo Email ─── */}
      <div className="group relative flex items-center">
        <span className="pointer-events-none absolute left-4 z-10 flex items-center text-white/30 transition-colors group-focus-within:text-red-bright">
          <svg
            viewBox="0 0 24 24"
            className="h-[17px] w-[17px] stroke-current"
            fill="none"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <path d="M3 7l9 6 9-6" />
          </svg>
        </span>
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          inputMode="email"
          required
          placeholder="Email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          disabled={isSubmitting || isGoogleLoading}
          aria-label="Email"
          className="glass-input w-full px-[46px] py-[14px] text-sm font-normal tracking-[0.3px] focus-ring-red"
        />
      </div>

      {/* ─── Campo Senha ─── */}
      <div className="group relative flex items-center">
        <span className="pointer-events-none absolute left-4 z-10 flex items-center text-white/30 transition-colors group-focus-within:text-red-bright">
          <svg
            viewBox="0 0 24 24"
            className="h-[17px] w-[17px] stroke-current"
            fill="none"
            strokeWidth={1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
        </span>
        <input
          id="login-password"
          name="password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          required
          placeholder="Senha"
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            if (errorMessage) setErrorMessage(null);
          }}
          disabled={isSubmitting || isGoogleLoading}
          aria-label="Senha"
          className="glass-input w-full px-[46px] py-[14px] text-sm font-normal tracking-[0.3px] focus-ring-red"
        />
        <button
          type="button"
          onClick={() => setShowPassword((value) => !value)}
          aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
          aria-pressed={showPassword}
          className="absolute right-3.5 z-10 flex items-center rounded-md p-1 text-white/30 transition-colors hover:text-white/70 focus:outline-none focus-visible:text-white/70"
          disabled={isSubmitting || isGoogleLoading}
          tabIndex={0}
        >
          {showPassword ? (
            <svg
              viewBox="0 0 24 24"
              className="h-[17px] w-[17px] stroke-current"
              fill="none"
              strokeWidth={1.8}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M17.9 17.4C16.2 18.5 14.2 19 12 19c-6.4 0-10-7-10-7a18.5 18.5 0 015.1-6.4M9.9 4.2A9.4 9.4 0 0112 4c6.4 0 10 7 10 7a18.6 18.6 0 01-2.2 3.4" />
              <line x1="3" y1="3" x2="21" y2="21" />
            </svg>
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
              <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>

      {/* ─── Divisor ─── */}
      <div className="my-1 flex items-center gap-3" aria-hidden="true">
        <div className="glass-divider flex-1" />
      </div>

      {/* ─── Botão de submit (credenciais) ─── */}
      <button
        type="submit"
        className="btn-light mt-1.5 animate-fade-up opacity-0 [animation-delay:0.4s]"
        disabled={isSubmitting || isGoogleLoading}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? (
          <span className="spinner-ring" aria-hidden="true" />
        ) : (
          <>
            Entrar
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
          </>
        )}
      </button>

      {/* ─── Link para cadastro ─── */}
      <div className="mt-3 text-center text-[13px] text-white/45 animate-fade-up opacity-0 [animation-delay:0.5s]">
        Ainda não tem conta?{' '}
        <Link
          href="/cadastro"
          className="text-white/85 underline-offset-2 transition-colors hover:text-white hover:underline"
        >
          Criar conta
        </Link>
      </div>
    </form>
  );
}
