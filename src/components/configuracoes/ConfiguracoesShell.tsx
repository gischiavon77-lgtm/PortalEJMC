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
      className="rounded-xl border border-border-light bg-surface-card p-6 shadow-sm"
    >
      <h2
        id="password-heading"
        className="mb-4 font-heading text-xl font-semibold text-text-primary"
      >
        Alterar Senha
      </h2>

      {message && (
        <div
          role="alert"
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="current-password" className="text-sm font-medium text-text-secondary">
            Senha atual
          </label>
          <input
            id="current-password"
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            required
            className="rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-red-core focus:ring-1 focus:ring-red-core"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="new-password" className="text-sm font-medium text-text-secondary">
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
            className="rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-red-core focus:ring-1 focus:ring-red-core"
          />
          <p className="text-xs text-text-muted">
            8-128 caracteres, com pelo menos uma maiúscula, uma minúscula e um número.
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="confirm-password" className="text-sm font-medium text-text-secondary">
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
            className="rounded-lg border border-border-light bg-white px-3 py-2 text-sm text-text-primary outline-none transition-colors focus:border-red-core focus:ring-1 focus:ring-red-core"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !currentPassword || !newPassword || !confirmPassword}
          className="mt-2 w-fit rounded-lg bg-red-core px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-vivid disabled:cursor-not-allowed disabled:opacity-50"
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

    // Validação client-side: tamanho (5 MB)
    if (file.size > 5 * 1024 * 1024) {
      setMessage({ type: 'error', text: 'A foto deve ter no máximo 5 MB.' });
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
      className="rounded-xl border border-border-light bg-surface-card p-6 shadow-sm"
    >
      <h2 id="avatar-heading" className="mb-4 font-heading text-xl font-semibold text-text-primary">
        Foto de Perfil
      </h2>

      {message && (
        <div
          role="alert"
          className={`mb-4 rounded-lg px-4 py-3 text-sm ${
            message.type === 'success'
              ? 'border border-green-200 bg-green-50 text-green-800'
              : 'border border-red-200 bg-red-50 text-red-800'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center">
        {/* Avatar preview */}
        <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-border-light bg-red-50">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={`Avatar de ${userName}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-xl font-bold text-red-core">{initials}</span>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="text-sm text-text-secondary file:mr-3 file:rounded-lg file:border-0 file:bg-red-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-red-core file:transition-colors hover:file:bg-red-100"
              aria-label="Selecionar foto de perfil"
            />
          </div>

          <button
            type="button"
            onClick={handleUpload}
            disabled={loading}
            className="w-fit rounded-lg bg-red-core px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-vivid disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Enviando...' : 'Enviar Foto'}
          </button>

          <p className="text-xs text-text-muted">PNG ou JPG. Tamanho máximo: 5 MB.</p>
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
      className="rounded-xl border border-border-light bg-surface-card p-6 shadow-sm"
    >
      <h2 id="admin-heading" className="mb-4 font-heading text-xl font-semibold text-text-primary">
        Administração
      </h2>
      <p className="mb-3 text-sm text-text-secondary">
        Gerencie contas de usuários, permissões e configurações do sistema.
      </p>
      <a
        href="/admin"
        className="inline-flex items-center gap-2 rounded-lg bg-red-core px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-red-vivid"
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
