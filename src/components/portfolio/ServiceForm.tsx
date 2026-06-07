'use client';

/**
 * `ServiceForm` — Formulário de criação/edição de serviço (Task 12.4).
 *
 * Renderizado dentro do `Modal` da UI base. Apenas Admin/Diretor
 * deveriam montar este componente — o controle vive no parent
 * (`PortfolioShell`) via `usePermission('service:write')`. A própria
 * API valida novamente no servidor, então o gate UI é só para UX.
 *
 * ─── Validação client-side ──────────────────────────────────────────
 *
 * Reusamos as constantes e mensagens do schema Zod em
 * `@/lib/validators/service.ts`, garantindo sincronia com a API:
 *
 *   - `name`        → 3–100 caracteres (após trim).
 *   - `description` → 10–1000 caracteres (após trim).
 *
 * ─── Modos create / edit ────────────────────────────────────────────
 *
 * Quando `editingService` é fornecido, o modal funciona em modo de
 * edição (PATCH /api/services/:id). Caso contrário, é criação
 * (POST /api/services).
 *
 * ─── Pós-sucesso ────────────────────────────────────────────────────
 *
 * Em sucesso (201 para create, 200 para edit), chamamos `onSaved()`
 * para que o parent revalide a lista e fechamos o modal. O parent usa
 * `router.refresh()` para forçar nova SSR.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';

import { Button, Input, Modal } from '@/components/ui';
import {
  SERVICE_NAME_MIN_LENGTH,
  SERVICE_NAME_MAX_LENGTH,
  SERVICE_DESCRIPTION_MIN_LENGTH,
  SERVICE_DESCRIPTION_MAX_LENGTH,
  SERVICE_VALIDATION_MESSAGES,
} from '@/lib/validators/service';

import type { ServiceItem } from './ServicesList';

/**
 * Schema de validação local — mesmas regras que a API, sem transforms.
 */
const formSchema = z.object({
  name: z
    .string()
    .trim()
    .min(SERVICE_NAME_MIN_LENGTH, SERVICE_VALIDATION_MESSAGES.name.tooShort)
    .max(SERVICE_NAME_MAX_LENGTH, SERVICE_VALIDATION_MESSAGES.name.tooLong),
  description: z
    .string()
    .trim()
    .min(SERVICE_DESCRIPTION_MIN_LENGTH, SERVICE_VALIDATION_MESSAGES.description.tooShort)
    .max(SERVICE_DESCRIPTION_MAX_LENGTH, SERVICE_VALIDATION_MESSAGES.description.tooLong),
});

type FormErrors = Partial<Record<'name' | 'description' | '_global', string>>;

export interface ServiceFormProps {
  open: boolean;
  onClose: () => void;
  /** Chamado após criar/editar com sucesso para revalidar dados. */
  onSaved: () => void;
  /** Quando fornecido, o formulário opera em modo edição. */
  editingService?: ServiceItem | null;
}

interface FormValues {
  name: string;
  description: string;
}

export function ServiceForm({ open, onClose, onSaved, editingService }: ServiceFormProps) {
  const isEditing = Boolean(editingService);

  const [values, setValues] = useState<FormValues>({ name: '', description: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Reseta/preenche o formulário quando o modal abre.
  useEffect(() => {
    if (!open) return;
    if (editingService) {
      setValues({ name: editingService.name, description: editingService.description });
    } else {
      setValues({ name: '', description: '' });
    }
    setErrors({});
  }, [open, editingService]);

  function setField<K extends keyof FormValues>(key: K, value: FormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, _global: undefined }));
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;

    setErrors({});

    const parsed = formSchema.safeParse(values);
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = (issue.path[0] as keyof FormErrors) ?? '_global';
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      return;
    }

    const payload = { name: parsed.data.name, description: parsed.data.description };

    const url = isEditing ? `/api/services/${editingService!.id}` : '/api/services';
    const method = isEditing ? 'PATCH' : 'POST';

    setSubmitting(true);
    try {
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as {
          code?: string;
          message?: string;
          fields?: Array<{ path: string; message: string }>;
        } | null;

        if (data?.fields?.length) {
          const next: FormErrors = {};
          for (const f of data.fields) {
            const key = (f.path as keyof FormErrors) ?? '_global';
            if (!next[key]) next[key] = f.message;
          }
          setErrors(next);
        } else {
          setErrors({
            _global:
              data?.message ??
              `Não foi possível ${isEditing ? 'atualizar' : 'criar'} o serviço. Tente novamente.`,
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
      title={isEditing ? 'Editar serviço' : 'Novo serviço'}
      description={
        isEditing
          ? 'Atualize as informações do serviço.'
          : 'Cadastre um novo serviço no portfólio da empresa.'
      }
      size="md"
      closeOnEscape={!submitting}
      closeOnOverlayClick={!submitting}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="service-form" variant="primary" loading={submitting}>
            {isEditing ? 'Salvar alterações' : 'Adicionar serviço'}
          </Button>
        </div>
      }
    >
      <form id="service-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        {errors._global && (
          <div
            role="alert"
            className="rounded-md border border-red-vivid/30 bg-red-vivid/5 px-3 py-2 text-sm text-red-vivid"
          >
            {errors._global}
          </div>
        )}

        <Input
          label="Nome do serviço"
          name="name"
          value={values.name}
          onChange={(e) => setField('name', e.target.value)}
          maxLength={SERVICE_NAME_MAX_LENGTH}
          required
          placeholder="Ex.: Desenvolvimento de Website"
          error={errors.name}
          helperText={`${values.name.trim().length}/${SERVICE_NAME_MAX_LENGTH} caracteres`}
          disabled={submitting}
        />

        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor="service-description" className="text-sm font-medium text-text-primary">
            Descrição
            <span aria-hidden="true" className="ml-0.5 text-red-vivid">
              *
            </span>
          </label>
          <textarea
            id="service-description"
            value={values.description}
            onChange={(e) => setField('description', e.target.value)}
            maxLength={SERVICE_DESCRIPTION_MAX_LENGTH}
            rows={4}
            disabled={submitting}
            required
            placeholder="Descreva o serviço oferecido pela empresa (mín. 10 caracteres)."
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={
              errors.description ? 'service-description-error' : 'service-description-hint'
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
            <p id="service-description-error" className="text-xs text-red-vivid">
              {errors.description}
            </p>
          ) : (
            <p id="service-description-hint" className="text-xs text-text-muted">
              {values.description.trim().length}/{SERVICE_DESCRIPTION_MAX_LENGTH} caracteres
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
