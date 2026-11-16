'use client';

/**
 * ConfiguracoesShell — Shell client do módulo Configurações.
 *
 * Tasks 18.4, 18.5:
 *   - Seção "Alterar Senha": formulário com senha atual, nova senha, confirmar.
 *   - Seção "Foto de Perfil": preview do avatar atual + upload.
 *   - Seção "Administração" (condicional): link para /admin se Admin.
 *   - Mensagens de sucesso/erro para cada operação (Task 18.5).
 */

import { useState, useRef, type FormEvent } from 'react';

import { UPLOAD_MAX_BYTES, UPLOAD_MAX_LABEL } from '@/lib/validators/upload';

export interface ConfiguracoesUser {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
}

interface Props {
  user: ConfiguracoesUser;
}

export function ConfiguracoesShell({ user }: Props) {
  return (
    <div className="flex flex-col gap-8">
      <ChangePasswordSection />
      <AvatarSection initialAvatarUrl={user.avatarUrl} userName={user.name} />
      {user.role === 'ADMIN' && <AdminSection />}
    </div>
  );
}

// ─── Seção: Alterar Senha ─────────────────────────────────────────────────────

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setMessage(null);

    // Validação client-side: confirmar senha
    if (newPassword !== confirmPassword) {
      setMessage({ type: 'error', text: 'A confirmação de senha não confere.' });
      return;
    }

    // Validação client-side: requisitos mínimos
    if (newPassword.length < 8 || newPassword.length > 128) {
      setMessage({
        type: 'error',
        text: 'A nova senha deve ter entre 8 e 128 caracteres, com pelo menos uma maiúscula, uma minúscula e um número.',
      });
      return;
    }
    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setMessage({
        type: 'error',
        text: 'A nova senha deve ter entre 8 e 128 caracteres, com pelo menos uma maiúscula, uma minúscula e um número.',
      });
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/users/me/password', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Erro ao alterar senha.' });
      } else {
        setMessage({ type: 'success', text: data.message || 'Senha alterada com sucesso!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section
      aria-labelledby="password-heading"
      className="rounded-xl border border-border bg-surface p-6 shadow-sm"
    >
      <h2 id="password-heading" className="mb-4 font-heading text-xl font-semibold text-text">
        Alterar Senha
      </h2>

      {message && (
        <div
          role="alert"
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border border-ok/40 bg-ok/15 text-ok'
              : 'border border-brand bg-brand/20 text-danger'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="current-password" className="text-sm font-medium text-text-soft">
            Senha atual
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text outline-none transition-colors focus:border-white/60 focus:ring-1 focus:ring-white/30"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password" className="text-sm font-medium text-text-soft">
            Nova senha
          </label>
          <input
            id="new-password"
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
            className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text outline-none transition-colors focus:border-white/60 focus:ring-1 focus:ring-white/30"
          />
          <p className="text-xs text-text-faint">
            8-128 caracteres, com pelo menos uma maiúscula, uma minúscula e um número.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-password" className="text-sm font-medium text-text-soft">
            Confirmar nova senha
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={8}
            maxLength={128}
            className="rounded-lg border border-border bg-surface-raised px-3 py-2 text-sm text-text outline-none transition-colors focus:border-white/60 focus:ring-1 focus:ring-white/30"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !currentPassword || !newPassword || !confirmPassword}
          className="mt-2 w-fit rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? 'Alterando...' : 'Alterar Senha'}
        </button>
      </form>
    </section>
  );
}

// ─── Seção: Foto de Perfil ────────────────────────────────────────────────────

function AvatarSection({
  initialAvatarUrl,
  userName,
}: {
  initialAvatarUrl: string | null;
  userName: string;
}) {
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload() {
    const file = fileInputRef.current?.files?.[0];
    if (!file) return;

    setMessage(null);

    // Validação client-side: tipo
    if (!['image/png', 'image/jpeg'].includes(file.type)) {
      setMessage({ type: 'error', text: 'Formato não suportado. Use PNG ou JPG.' });
      return;
    }

    // Validação client-side: tamanho (mesmo limite do servidor)
    if (file.size > UPLOAD_MAX_BYTES) {
      setMessage({ type: 'error', text: `A foto deve ter no máximo ${UPLOAD_MAX_LABEL}.` });
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch('/api/users/me/avatar', {
        method: 'PATCH',
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setMessage({ type: 'error', text: data.message || 'Erro ao atualizar foto.' });
      } else {
        setMessage({ type: 'success', text: data.message || 'Foto de perfil atualizada!' });
        setAvatarUrl(data.avatarUrl);
        // Notifica sidebar/topbar para recarregar o avatar.
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('ejmc:profile-updated'));
        }
      }
    } catch {
      setMessage({ type: 'error', text: 'Erro de conexão. Tente novamente.' });
    } finally {
      setLoading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  }

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <section
      aria-labelledby="avatar-heading"
      className="rounded-xl border border-border bg-surface p-6 shadow-sm"
    >
      <h2 id="avatar-heading" className="mb-4 font-heading text-xl font-semibold text-text">
        Foto de Perfil
      </h2>

      {message && (
        <div
          role="alert"
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border border-ok/40 bg-ok/15 text-ok'
              : 'border border-brand bg-brand/20 text-danger'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {/* Avatar preview */}
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border bg-brand/20">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`Avatar de ${userName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xl font-bold text-danger">{initials}</span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="text-sm text-text-soft file:mr-3 file:rounded-lg file:border-0 file:bg-brand/20 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-text file:transition-colors hover:file:bg-brand/20"
              aria-label="Selecionar foto de perfil"
            />
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={loading}
            className="w-fit rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar Foto'}
          </button>

          <p className="text-xs text-text-faint">PNG ou JPG. Tamanho máximo: {UPLOAD_MAX_LABEL}.</p>
        </div>
      </div>
    </section>
  );
}

// ─── Seção: Admin ─────────────────────────────────────────────────────────────

function AdminSection() {
  return (
    <section
      aria-labelledby="admin-heading"
      className="rounded-xl border border-border bg-surface p-6 shadow-sm"
    >
      <h2 id="admin-heading" className="mb-4 font-heading text-xl font-semibold text-text">
        Administração
      </h2>
      <p className="mb-3 text-sm text-text-soft">
        Gerencie contas de usuários, permissões e configurações do sistema.
      </p>
      <a
        href="/admin"
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
        Painel de Administração
      </a>
    </section>
  );
}
