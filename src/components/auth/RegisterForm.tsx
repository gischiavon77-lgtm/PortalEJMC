'use client';

/**
 * `RegisterForm` — Formulário de auto-cadastro do Portal Interno EJMC
 * (Task 3.9).
 *
 * Componente cliente responsável por:
 *   1. Coletar nome, email, senha e confirmação de senha.
 *   2. Validar localmente com `registerSchema` (Task 3.6) — o mesmo
 *      schema usado pela API Route — e estender com a verificação de
 *      `password === confirmPassword`. A validação client-side serve
 *      apenas para feedback imediato; o servidor revalida com o mesmo
 *      schema no `POST /api/auth/register`.
 *   3. Submeter via `fetch` para `POST /api/auth/register` e mapear a
 *      resposta para mensagens em pt-BR conforme o contrato definido
 *      no design.md / Task 3.6:
 *        - 201 success: confirma cadastro pendente e redireciona para
 *          `/login` em 3 segundos (botão "Voltar para o login" também
 *          disponível imediatamente).
 *        - 409 EMAIL_TAKEN: "Este email já está em uso." (Req 3.2)
 *        - 400 VALIDATION_ERROR: erros por campo inline.
 *        - 400 INVALID_JSON / 500 INTERNAL_ERROR: mensagem genérica.
 *   4. Estética glass do design system reutilizando os utilitários
 *      `glass-input`, `btn-light`, `error-banner`, `spinner-ring`,
 *      `focus-ring-red` definidos em `globals.css`.
 *
 * Decisões importantes:
 *   - O schema é estendido localmente com `superRefine` para anexar o
 *     erro de "as senhas não coincidem" exclusivamente ao campo
 *     `confirmPassword`. Se anexássemos via `path: ['password']`, o
 *     campo da senha real ficaria marcado como inválido mesmo quando
 *     o problema é só na confirmação — isso confunde o usuário.
 *   - Usamos `fetch` direto (sem `react-query` ou similar) para manter
 *     a dependência mínima: este formulário é submetido uma vez,
 *     não precisa de cache ou refetch.
 *   - Em caso de 201, o usuário vê a tela de sucesso com countdown
 *     visual (texto explica que será redirecionado em 3s) e o botão
 *     "Voltar para o login". O `useEffect` agenda um `router.push`
 *     após 3000ms — se o componente for desmontado antes (porque o
 *     usuário clicou no botão), `clearTimeout` evita warnings.
 *   - `noValidate` no `<form>` para que o navegador não interfira com
 *     a validação Zod nativa em pt-BR.
 *   - `aria-invalid` + `aria-describedby` em cada input para
 *     acessibilidade (leitores de tela leem a mensagem de erro
 *     inline ao focar o campo).
 */

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { z } from 'zod';

import { registerSchema } from '@/lib/validators/auth';

/** Quanto tempo a tela de sucesso espera antes de redirecionar para /login. */
const SUCCESS_REDIRECT_MS = 3000;

/**
 * Schema do formulário (client-side). Estende `registerSchema` com
 * `confirmPassword` e a verificação de igualdade. O `transform` em
 * `email` (lowercase) já é aplicado pelo schema base.
 */
const registerFormSchema = registerSchema
  .extend({
    confirmPassword: z.string({
      error: 'Confirme sua senha.',
    }),
  })
  .superRefine((data, ctx) => {
    if (data.confirmPassword !== data.password) {
      ctx.addIssue({
        code: 'custom',
        message: 'As senhas não coincidem.',
        path: ['confirmPassword'],
      });
    }
  });

type FieldKey = 'name' | 'email' | 'password' | 'confirmPassword';
type FieldErrors = Partial<Record<FieldKey, string>>;

/**
 * Mensagens dos códigos de erro retornados pela API. As mensagens
 * exibidas para o usuário são as do servidor quando disponíveis (já
 * em pt-BR), mas mantemos fallbacks específicos para garantir o
 * comportamento exigido pela Task mesmo se o backend mudar a `message`.
 */
const SERVER_ERROR_MESSAGES: Record<string, string> = {
  EMAIL_TAKEN: 'Este email já está em uso.',
  INVALID_JSON: 'Não foi possível concluir o cadastro. Tente novamente.',
  INTERNAL_ERROR: 'Não foi possível concluir o cadastro. Tente novamente.',
};

const GENERIC_ERROR_MESSAGE =
  'Não foi possível concluir o cadastro. Tente novamente.';

const SUCCESS_MESSAGE =
  'Cadastro recebido. Sua conta está aguardando aprovação. Você receberá um email quando for aprovada.';

interface ApiErrorResponse {
  error?: boolean;
  code?: string;
  message?: string;
  fields?: Array<{ path: string; message: string }>;
}

export function RegisterForm() {
  const router = useRouter();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const redirectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Garante que o timeout do redirect seja limpo se o componente for
  // desmontado (ex.: o usuário clica em "Voltar para o login" antes).
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  function clearFieldError(field: FieldKey) {
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    if (errorMessage) setErrorMessage(null);
  }

  /**
   * Mapeia o array `fields` retornado por `VALIDATION_ERROR` (cada item
   * com `path` e `message`) para o `FieldErrors` usado pelo formulário.
   * Erros em paths desconhecidos (ex.: "") caem na mensagem geral.
   */
  function applyServerFieldErrors(fields: ApiErrorResponse['fields']): boolean {
    if (!fields || fields.length === 0) return false;
    const next: FieldErrors = {};
    let unknownFieldFound = false;
    for (const issue of fields) {
      if (
        issue.path === 'name' ||
        issue.path === 'email' ||
        issue.path === 'password'
      ) {
        next[issue.path] = issue.message;
      } else {
        unknownFieldFound = true;
      }
    }
    setFieldErrors(next);
    if (unknownFieldFound && Object.keys(next).length === 0) {
      setErrorMessage('Dados de cadastro inválidos.');
    }
    return Object.keys(next).length > 0;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSubmitting || successMessage) return;

    setErrorMessage(null);

    // ─── 1. Validação client-side com Zod ────────────────────────────
    const parsed = registerFormSchema.safeParse({
      name,
      email,
      password,
      confirmPassword,
    });

    if (!parsed.success) {
      const nextErrors: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (
          key === 'name' ||
          key === 'email' ||
          key === 'password' ||
          key === 'confirmPassword'
        ) {
          // Mantemos apenas o primeiro erro por campo — exibir múltiplos
          // erros simultâneos para a mesma input deixa o layout poluído.
          if (!nextErrors[key]) {
            nextErrors[key] = issue.message;
          }
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    // ─── 2. Submissão para a API Route ───────────────────────────────
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: parsed.data.name,
          email: parsed.data.email,
          password: parsed.data.password,
        }),
      });

      // 201 — sucesso. A API retorna { id, email, status }.
      if (response.status === 201) {
        setSuccessMessage(SUCCESS_MESSAGE);
        // Limpa o formulário para evitar reenvio acidental se o
        // redirect demorar.
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        redirectTimeoutRef.current = setTimeout(() => {
          router.push('/login');
        }, SUCCESS_REDIRECT_MS);
        return;
      }

      // Demais respostas seguem o contrato { error, code, message, fields? }.
      let body: ApiErrorResponse | null = null;
      try {
        body = (await response.json()) as ApiErrorResponse;
      } catch {
        body = null;
      }

      if (response.status === 409) {
        // Req 3.2 — email já em uso, mensagem específica.
        setErrorMessage(
          body?.message ?? SERVER_ERROR_MESSAGES.EMAIL_TAKEN,
        );
        return;
      }

      if (response.status === 400) {
        if (body?.code === 'VALIDATION_ERROR') {
          const applied = applyServerFieldErrors(body.fields);
          if (!applied && !errorMessage) {
            setErrorMessage(body.message ?? 'Dados de cadastro inválidos.');
          }
          return;
        }
        // INVALID_JSON ou outro 400 inesperado.
        setErrorMessage(
          body?.message ?? GENERIC_ERROR_MESSAGE,
        );
        return;
      }

      if (response.status === 500) {
        setErrorMessage(
          body?.message ?? SERVER_ERROR_MESSAGES.INTERNAL_ERROR,
        );
        return;
      }

      // Status inesperado — fallback para mensagem genérica.
      setErrorMessage(GENERIC_ERROR_MESSAGE);
    } catch {
      // Falha de rede / fetch abortado.
      setErrorMessage(GENERIC_ERROR_MESSAGE);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handleManualRedirect() {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
      redirectTimeoutRef.current = null;
    }
    router.push('/login');
  }

  // ─── Estado de sucesso ─────────────────────────────────────────────
  if (successMessage) {
    return (
      <div
        className="flex flex-col gap-5 animate-fade-up opacity-0 [animation-delay:0.1s]"
        role="status"
        aria-live="polite"
      >
        <div className="rounded-md border border-white/15 bg-white/[0.06] px-5 py-6 text-center">
          <div
            className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-white/15 bg-white/10"
            aria-hidden="true"
          >
            <svg
              viewBox="0 0 24 24"
              className="h-6 w-6 stroke-white"
              fill="none"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm leading-relaxed text-white/80">
            {successMessage}
          </p>
          <p className="mt-3 text-[12px] tracking-[0.5px] text-white/35">
            Redirecionando para o login em alguns segundos…
          </p>
        </div>

        <button
          type="button"
          onClick={handleManualRedirect}
          className="btn-light"
        >
          Voltar para o login
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
        </button>
      </div>
    );
  }

  // ─── Formulário ────────────────────────────────────────────────────
  return (
    <form
      noValidate
      onSubmit={handleSubmit}
      className="flex flex-col gap-3.5 animate-fade-up opacity-0 [animation-delay:0.28s]"
    >
      {errorMessage ? (
        <div className="error-banner" role="alert" aria-live="polite">
          {errorMessage}
        </div>
      ) : null}

      {/* ─── Campo Nome ─── */}
      <div className="flex flex-col gap-1">
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
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </span>
          <input
            id="register-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            placeholder="Nome completo"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              clearFieldError('name');
            }}
            disabled={isSubmitting}
            aria-label="Nome completo"
            aria-invalid={Boolean(fieldErrors.name)}
            aria-describedby={fieldErrors.name ? 'register-name-error' : undefined}
            className="glass-input w-full px-[46px] py-[14px] text-sm font-normal tracking-[0.3px] focus-ring-red"
          />
        </div>
        {fieldErrors.name ? (
          <p
            id="register-name-error"
            className="px-1 text-[12px] leading-snug text-red-bright/90"
          >
            {fieldErrors.name}
          </p>
        ) : null}
      </div>

      {/* ─── Campo Email ─── */}
      <div className="flex flex-col gap-1">
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
            id="register-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            required
            placeholder="Email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
              clearFieldError('email');
            }}
            disabled={isSubmitting}
            aria-label="Email"
            aria-invalid={Boolean(fieldErrors.email)}
            aria-describedby={fieldErrors.email ? 'register-email-error' : undefined}
            className="glass-input w-full px-[46px] py-[14px] text-sm font-normal tracking-[0.3px] focus-ring-red"
          />
        </div>
        {fieldErrors.email ? (
          <p
            id="register-email-error"
            className="px-1 text-[12px] leading-snug text-red-bright/90"
          >
            {fieldErrors.email}
          </p>
        ) : null}
      </div>

      {/* ─── Campo Senha ─── */}
      <div className="flex flex-col gap-1">
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
            id="register-password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            placeholder="Senha"
            value={password}
            onChange={(event) => {
              setPassword(event.target.value);
              clearFieldError('password');
            }}
            disabled={isSubmitting}
            aria-label="Senha"
            aria-invalid={Boolean(fieldErrors.password)}
            aria-describedby={
              fieldErrors.password ? 'register-password-error' : 'register-password-hint'
            }
            className="glass-input w-full px-[46px] py-[14px] text-sm font-normal tracking-[0.3px] focus-ring-red"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            aria-pressed={showPassword}
            className="absolute right-3.5 z-10 flex items-center rounded-md p-1 text-white/30 transition-colors hover:text-white/70 focus:outline-none focus-visible:text-white/70"
            disabled={isSubmitting}
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
        {fieldErrors.password ? (
          <p
            id="register-password-error"
            className="px-1 text-[12px] leading-snug text-red-bright/90"
          >
            {fieldErrors.password}
          </p>
        ) : (
          <p
            id="register-password-hint"
            className="px-1 text-[11px] leading-snug text-white/35"
          >
            Mínimo 8 caracteres com maiúscula, minúscula e número.
          </p>
        )}
      </div>

      {/* ─── Campo Confirmar Senha ─── */}
      <div className="flex flex-col gap-1">
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
              <path d="M9 16l2 2 4-4" />
            </svg>
          </span>
          <input
            id="register-confirm-password"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            autoComplete="new-password"
            required
            placeholder="Confirmar senha"
            value={confirmPassword}
            onChange={(event) => {
              setConfirmPassword(event.target.value);
              clearFieldError('confirmPassword');
            }}
            disabled={isSubmitting}
            aria-label="Confirmar senha"
            aria-invalid={Boolean(fieldErrors.confirmPassword)}
            aria-describedby={
              fieldErrors.confirmPassword ? 'register-confirm-password-error' : undefined
            }
            className="glass-input w-full px-[46px] py-[14px] text-sm font-normal tracking-[0.3px] focus-ring-red"
          />
          <button
            type="button"
            onClick={() => setShowConfirmPassword((value) => !value)}
            aria-label={showConfirmPassword ? 'Ocultar confirmação de senha' : 'Mostrar confirmação de senha'}
            aria-pressed={showConfirmPassword}
            className="absolute right-3.5 z-10 flex items-center rounded-md p-1 text-white/30 transition-colors hover:text-white/70 focus:outline-none focus-visible:text-white/70"
            disabled={isSubmitting}
            tabIndex={0}
          >
            {showConfirmPassword ? (
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
        {fieldErrors.confirmPassword ? (
          <p
            id="register-confirm-password-error"
            className="px-1 text-[12px] leading-snug text-red-bright/90"
          >
            {fieldErrors.confirmPassword}
          </p>
        ) : null}
      </div>

      {/* ─── Divisor ─── */}
      <div className="my-1 flex items-center gap-3" aria-hidden="true">
        <div className="glass-divider flex-1" />
      </div>

      {/* ─── Botão de submit ─── */}
      <button
        type="submit"
        className="btn-light mt-1.5 animate-fade-up opacity-0 [animation-delay:0.4s]"
        disabled={isSubmitting}
        aria-busy={isSubmitting}
      >
        {isSubmitting ? (
          <span className="spinner-ring" aria-hidden="true" />
        ) : (
          <>
            Criar conta
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

      {/* ─── Link para login ─── */}
      <div className="mt-3 text-center text-[13px] text-white/45 animate-fade-up opacity-0 [animation-delay:0.5s]">
        Já tem conta?{' '}
        <Link
          href="/login"
          className="text-white/85 underline-offset-2 transition-colors hover:text-white hover:underline"
        >
          Entrar
        </Link>
      </div>
    </form>
  );
}
