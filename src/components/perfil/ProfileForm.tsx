'use client';

/**
 * `ProfileForm` — Formulário de edição do perfil do usuário (Tasks 11.3–11.6).
 *
 * Campos editáveis: nome, email, telefone, CPF.
 * Campos somente leitura: área, cargo, nível de permissão.
 *
 * Comportamento:
 *   - Validação client-side com Zod antes de enviar (sem perder dados dos outros campos)
 *   - Erros por campo exibidos abaixo do input correspondente
 *   - Mensagem de sucesso (banner verde) ao salvar — some após 4s
 *   - Formatação visual de CPF (###.###.###-##) e telefone ((##) #####-####)
 */

import { useState, useTransition } from 'react';
import type { Area, UserRole } from '@prisma/client';
import { z } from 'zod';

import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { updateProfileSchema, validateCpf, validatePhone } from '@/lib/validators/profile';

// ─── Labels ──────────────────────────────────────────────────────────────────

const AREA_LABELS: Record<Area, string> = {
  VENDAS: 'Vendas',
  PRESIDENCIA: 'Presidência',
  PROJETOS: 'Projetos',
  MARKETING: 'Marketing',
  GESTAO_PESSOAS: 'Gestão de Pessoas',
  ADM_FIN: 'Adm-Fin',
};

const ROLE_LABELS: Record<UserRole, string> = {
  ADMIN: 'Administrador',
  DIRETOR: 'Diretor',
  GERENTE: 'Gerente',
  COORDENADOR: 'Coordenador',
  MEMBRO: 'Membro',
};

// ─── Formatação ──────────────────────────────────────────────────────────────

function formatCpfDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}

function formatPhoneDisplay(digits: string): string {
  const d = digits.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

// ─── Tipos ───────────────────────────────────────────────────────────────────

import type { AccountStatus } from '@prisma/client';

export interface ProfileUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  area: Area | null;
  position: string | null;
  phone: string | null;
  cpf: string | null;
  avatarUrl: string | null;
  status: AccountStatus;
}

interface FieldErrors {
  name?: string;
  email?: string;
  phone?: string;
  cpf?: string;
  _global?: string;
}

// ─── Componente ──────────────────────────────────────────────────────────────

export function ProfileForm({ user }: { user: ProfileUser }) {
  const [name, setName] = useState(user.name);
  const [email, setEmail] = useState(user.email);
  const [phone, setPhone] = useState(
    user.phone ? formatPhoneDisplay(user.phone) : '',
  );
  const [cpf, setCpf] = useState(
    user.cpf ? formatCpfDisplay(user.cpf) : '',
  );

  const [errors, setErrors] = useState<FieldErrors>({});
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handlePhoneChange(value: string) {
    setPhone(formatPhoneDisplay(value));
    if (errors.phone) setErrors((e) => ({ ...e, phone: undefined }));
  }

  function handleCpfChange(value: string) {
    setCpf(formatCpfDisplay(value));
    if (errors.cpf) setErrors((e) => ({ ...e, cpf: undefined }));
  }

  function validate(): boolean {
    const newErrors: FieldErrors = {};

    if (!name.trim() || name.trim().length < 3) {
      newErrors.name = 'O nome deve ter pelo menos 3 caracteres.';
    } else if (name.trim().length > 150) {
      newErrors.name = 'O nome deve ter no máximo 150 caracteres.';
    }

    if (!email.trim()) {
      newErrors.email = 'O email é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      newErrors.email = 'Informe um email válido.';
    }

    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits && !validatePhone(phoneDigits)) {
      newErrors.phone =
        'Informe um telefone brasileiro válido com DDD (ex: 11 99999-9999).';
    }

    const cpfDigits = cpf.replace(/\D/g, '');
    if (cpfDigits && !validateCpf(cpfDigits)) {
      newErrors.cpf = 'Informe um CPF válido (11 dígitos com dígitos verificadores).';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    startTransition(async () => {
      setSuccess(false);
      setErrors({});

      try {
        const payload = updateProfileSchema.parse({
          name: name.trim(),
          email: email.trim(),
          phone: phone || undefined,
          cpf: cpf || undefined,
        });

        const res = await fetch('/api/users/me', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        const json = (await res.json()) as {
          error?: boolean;
          code?: string;
          fields?: { path: string; message: string }[];
          message?: string;
        };

        if (!res.ok) {
          if (json.fields) {
            const fieldErrors: FieldErrors = {};
            for (const f of json.fields) {
              (fieldErrors as Record<string, string>)[f.path] = f.message;
            }
            setErrors(fieldErrors);
          } else {
            setErrors({ _global: json.message ?? 'Erro ao salvar.' });
          }
          return;
        }

        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      } catch (err) {
        if (err instanceof z.ZodError) {
          const fieldErrors: FieldErrors = {};
          for (const issue of err.issues) {
            const key = issue.path[0] as keyof FieldErrors;
            if (key) fieldErrors[key] = issue.message;
          }
          setErrors(fieldErrors);
        } else {
          setErrors({ _global: 'Erro inesperado. Tente novamente.' });
        }
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="flex w-full flex-col gap-8"
    >
      {/* Banner de sucesso (Task 11.6) */}
      {success && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800"
        >
          <svg
            aria-hidden="true"
            className="h-4 w-4 flex-shrink-0 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          Perfil atualizado com sucesso.
        </div>
      )}

      {/* Erro global */}
      {errors._global && (
        <div
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
        >
          {errors._global}
        </div>
      )}

      {/* ── Dados somente leitura ── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-[1.5px] text-text-muted">
          Informações institucionais
        </legend>

        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Área</span>
            <div className="flex h-10 items-center rounded-md border border-border-light bg-surface-bg px-3 text-sm text-text-secondary">
              {user.area ? AREA_LABELS[user.area] : '—'}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">Cargo</span>
            <div className="flex h-10 items-center rounded-md border border-border-light bg-surface-bg px-3 text-sm text-text-secondary">
              {user.position ?? '—'}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-text-primary">
              Nível de acesso
            </span>
            <div className="flex h-10 items-center rounded-md border border-border-light bg-surface-bg px-3 text-sm text-text-secondary">
              {ROLE_LABELS[user.role]}
            </div>
          </div>
        </div>
      </fieldset>

      {/* ── Dados editáveis ── */}
      <fieldset className="flex flex-col gap-4">
        <legend className="mb-2 text-xs font-semibold uppercase tracking-[1.5px] text-text-muted">
          Dados pessoais
        </legend>

        <div className="grid grid-cols-1 gap-4 tablet:grid-cols-2">
          <Input
            label="Nome completo"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) setErrors((err) => ({ ...err, name: undefined }));
            }}
            error={errors.name}
            autoComplete="name"
          />

          <Input
            label="Email"
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email) setErrors((err) => ({ ...err, email: undefined }));
            }}
            error={errors.email}
            autoComplete="email"
          />

          <Input
            label="Telefone"
            type="tel"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            error={errors.phone}
            placeholder="(11) 99999-9999"
            autoComplete="tel"
            helperText="Com DDD, 10 ou 11 dígitos"
          />

          <Input
            label="CPF"
            value={cpf}
            onChange={(e) => handleCpfChange(e.target.value)}
            error={errors.cpf}
            placeholder="000.000.000-00"
            autoComplete="off"
            inputMode="numeric"
          />
        </div>
      </fieldset>

      <div className="flex justify-end">
        <Button type="submit" loading={isPending} size="md">
          Salvar alterações
        </Button>
      </div>
    </form>
  );
}
