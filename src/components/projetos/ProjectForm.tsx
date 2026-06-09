'use client';

/**
 * `ProjectForm` — Formulário de criação de projeto.
 *
 * Renderizado dentro do `Modal` da UI base. Apenas Admin pode montar
 * este componente — o controle vive no parent (`ProjectsShell`) via
 * `usePermission('project:updateStatus')`. A API revalida no servidor.
 *
 * Campos:
 *   - `name`        → texto, obrigatório, max 200 chars.
 *   - `description` → textarea, opcional, max 2000 chars.
 */

import { useEffect, useState, type FormEvent } from 'react';

import { Button, Input, Modal } from '@/components/ui';

const NAME_MAX = 200;
const DESCRIPTION_MAX = 2000;

type FormErrors = Partial<Record<'name' | 'description' | '_global', string>>;

export interface ProjectFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ProjectForm({ open, onClose, onSaved }: ProjectFormProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName('');
    setDescription('');
    setErrors({});
  }, [open]);

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;

    setErrors({});

    const trimmedName = name.trim();
    const trimmedDesc = description.trim();

    // Client-side validation
    const next: FormErrors = {};
    if (!trimmedName) {
      next.name = 'Nome é obrigatório.';
    } else if (trimmedName.length > NAME_MAX) {
      next.name = `Nome deve ter no máximo ${NAME_MAX} caracteres.`;
    }
    if (trimmedDesc.length > DESCRIPTION_MAX) {
      next.description = `Descrição deve ter no máximo ${DESCRIPTION_MAX} caracteres.`;
    }
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: trimmedName,
          description: trimmedDesc || undefined,
        }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          code?: string;
          message?: string;
          fields?: Array<{ path: string; message: string }>;
        } | null;

        if (data?.fields?.length) {
          const fieldErrors: FormErrors = {};
          for (const f of data.fields) {
            const key = (f.path as keyof FormErrors) ?? '_global';
            if (!fieldErrors[key]) fieldErrors[key] = f.message;
          }
          setErrors(fieldErrors);
        } else {
          setErrors({
            _global: data?.message ?? 'Não foi possível criar o projeto. Tente novamente.',
          });
        }
        return;
      }

      onSaved();
      onClose();
    } catch {
      setErrors({
        _global: 'Erro de conexão. Verifique sua internet e tente novamente.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting ? () => {} : onClose}
      title="Novo projeto"
      description="Cadastre um novo projeto da empresa."
      size="md"
      closeOnEscape={!submitting}
      closeOnOverlayClick={!submitting}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="project-form" variant="primary" loading={submitting}>
            Criar projeto
          </Button>
        </div>
      }
    >
      <form id="project-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {errors._global && (
          <div
            role="alert"
            className="rounded-md border border-red-vivid/30 bg-red-vivid/5 px-3 py-2 text-sm text-red-vivid"
          >
            {errors._global}
          </div>
        )}

        <Input
          label="Nome"
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setErrors((prev) => ({ ...prev, name: undefined, _global: undefined }));
          }}
          maxLength={NAME_MAX}
          required
          placeholder="Ex.: Redesign do site corporativo"
          error={errors.name}
          helperText={`${name.trim().length}/${NAME_MAX} caracteres`}
          disabled={submitting}
        />

        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor="project-description" className="text-sm font-medium text-text-primary">
            Descrição
          </label>
          <textarea
            id="project-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors((prev) => ({ ...prev, description: undefined, _global: undefined }));
            }}
            maxLength={DESCRIPTION_MAX}
            rows={4}
            disabled={submitting}
            placeholder="Descreva brevemente o projeto (opcional)."
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={
              errors.description ? 'project-description-error' : 'project-description-hint'
            }
            className={[
              'w-full resize-y rounded-md border bg-white px-3 py-2 text-sm text-text-primary',
              'placeholder:text-text-muted',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30',
              errors.description
                ? 'border-red-vivid focus-visible:border-red-vivid focus-visible:ring-red-vivid/30'
                : 'border-border-light focus-visible:border-red-core',
              'disabled:cursor-not-allowed disabled:bg-surface-bg disabled:text-text-muted',
            ].join(' ')}
          />
          {errors.description ? (
            <p id="project-description-error" className="text-xs text-red-vivid">
              {errors.description}
            </p>
          ) : (
            <p id="project-description-hint" className="text-xs text-text-muted">
              {description.trim().length}/{DESCRIPTION_MAX} caracteres
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
