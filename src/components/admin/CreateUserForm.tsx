'use client';

/**
 * `CreateUserForm` — Modal para criação de conta pelo Admin (Task 19.4, 19.9).
 *
 * Campos: nome, email, nível de permissão.
 * Validação: email duplicado retorna erro 409 do servidor.
 * A conta é criada diretamente como ACTIVE (sem aprovação).
 */

import { useCallback, useState } from 'react';
import type { UserRole } from '@prisma/client';

import { Button, Input, Modal } from '@/components/ui';

interface CreateUserFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

const ROLES: { value: UserRole; label: string }[] = [
  { value: 'MEMBRO', label: 'Membro' },
  { value: 'COORDENADOR', label: 'Coordenador' },
  { value: 'GERENTE', label: 'Gerente' },
  { value: 'DIRETOR', label: 'Diretor' },
  { value: 'ADMIN', label: 'Admin' },
];

interface FormFields {
  name: string;
  email: string;
  role: UserRole;
}

interface FieldErrors {
  name?: string;
  email?: string;
  role?: string;
  general?: string;
}

export function CreateUserForm({ open, onClose, onSaved }: CreateUserFormProps) {
  const [fields, setFields] = useState<FormFields>({
    name: '',
    email: '',
    role: 'MEMBRO',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const resetForm = useCallback(() => {
    setFields({ name: '', email: '', role: 'MEMBRO' });
    setErrors({});
  }, []);

  function handleClose() {
    resetForm();
    onClose();
  }

  function validateClient(): boolean {
    const newErrors: FieldErrors = {};
    if (!fields.name.trim() || fields.name.trim().length < 3) {
      newErrors.name = 'Nome deve ter no mínimo 3 caracteres.';
    }
    if (fields.name.trim().length > 150) {
      newErrors.name = 'Nome deve ter no máximo 150 caracteres.';
    }
    if (!fields.email.trim()) {
      newErrors.email = 'Email é obrigatório.';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email.trim())) {
      newErrors.email = 'Email inválido.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateClient()) return;

    setSubmitting(true);
    setErrors({});

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: fields.name.trim(),
          email: fields.email.trim().toLowerCase(),
          role: fields.role,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        if (data.code === 'EMAIL_TAKEN') {
          setErrors({ email: 'Este email já está cadastrado no sistema.' });
        } else if (data.fields) {
          const fieldErrors: FieldErrors = {};
          for (const field of data.fields) {
            if (field.path === 'name') fieldErrors.name = field.message;
            if (field.path === 'email') fieldErrors.email = field.message;
            if (field.path === 'role') fieldErrors.role = field.message;
          }
          setErrors(fieldErrors);
        } else {
          setErrors({ general: data.message || 'Erro ao criar conta.' });
        }
        return;
      }

      resetForm();
      onClose();
      onSaved();
    } catch {
      setErrors({ general: 'Erro de conexão. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Nova Conta"
      description="Crie uma conta diretamente ativa, sem necessidade de aprovação."
      size="md"
      footer={
        <>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClose}
            disabled={submitting}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            loading={submitting}
            disabled={submitting}
            onClick={handleSubmit}
          >
            Criar conta
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {errors.general && (
          <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {errors.general}
          </p>
        )}

        <Input
          label="Nome completo"
          type="text"
          value={fields.name}
          onChange={(e) => setFields((prev) => ({ ...prev, name: e.target.value }))}
          error={errors.name}
          autoFocus
        />

        <Input
          label="Email"
          type="email"
          value={fields.email}
          onChange={(e) => setFields((prev) => ({ ...prev, email: e.target.value }))}
          error={errors.email}
        />

        <div className="flex flex-col gap-1.5">
          <label htmlFor="role-select" className="text-sm font-medium text-text-primary">
            Nível de permissão
          </label>
          <select
            id="role-select"
            value={fields.role}
            onChange={(e) => setFields((prev) => ({ ...prev, role: e.target.value as UserRole }))}
            className="rounded-md border border-border-light bg-surface-card px-3 py-2 text-sm text-text-primary transition-colors focus:outline-none focus:ring-2 focus:ring-red-core/30"
          >
            {ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          {errors.role && <p className="text-xs text-red-600">{errors.role}</p>}
        </div>
      </form>
    </Modal>
  );
}
