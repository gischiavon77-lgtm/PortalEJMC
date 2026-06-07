'use client';

/**
 * `AnnouncementForm` — Formulário de criação de comunicado (Task 14.5).
 *
 * Renderizado dentro do `Modal` da UI base. Apenas Coordenador+
 * deveriam montar este componente — o controle vive no parent
 * (`ComunicadosShell`) via `usePermission('announcement:create')`.
 * A própria API valida novamente no servidor.
 *
 * ─── Validação client-side ──────────────────────────────────────────
 *
 * Reusamos as constantes e mensagens do schema Zod em
 * `@/lib/validators/announcement.ts`, garantindo sincronia com a API:
 *
 *   - `title`   → 1–150 caracteres (após trim).
 *   - `content` → 1–5000 caracteres (após trim).
 *
 * ─── Pós-sucesso ────────────────────────────────────────────────────
 *
 * Em sucesso (201), chamamos `onSaved()` para que o parent revalide
 * a lista via `router.refresh()` e fechamos o modal.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';

import { Button, Input, Modal } from '@/components/ui';
import {
  ANNOUNCEMENT_TITLE_MAX_LENGTH,
  ANNOUNCEMENT_CONTENT_MAX_LENGTH,
  ANNOUNCEMENT_VALIDATION_MESSAGES,
} from '@/lib/validators/announcement';

/**
 * Schema de validação local — mesmas regras que a API.
 */
const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, ANNOUNCEMENT_VALIDATION_MESSAGES.title.required)
    .max(ANNOUNCEMENT_TITLE_MAX_LENGTH, ANNOUNCEMENT_VALIDATION_MESSAGES.title.tooLong),
  content: z
    .string()
    .trim()
    .min(1, ANNOUNCEMENT_VALIDATION_MESSAGES.content.required)
    .max(ANNOUNCEMENT_CONTENT_MAX_LENGTH, ANNOUNCEMENT_VALIDATION_MESSAGES.content.tooLong),
});

type FormErrors = Partial<Record<'title' | 'content' | '_global', string>>;

export interface AnnouncementFormProps {
  open: boolean;
  onClose: () => void;
  /** Chamado após criar com sucesso para revalidar dados. */
  onSaved: () => void;
}

interface FormValues {
  title: string;
  content: string;
}

export function AnnouncementForm({ open, onClose, onSaved }: AnnouncementFormProps) {
  const [values, setValues] = useState<FormValues>({ title: '', content: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Reseta o formulário quando o modal abre.
  useEffect(() => {
    if (!open) return;
    setValues({ title: '', content: '' });
    setErrors({});
  }, [open]);

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

    const payload = { title: parsed.data.title, content: parsed.data.content };

    setSubmitting(true);
    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
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
            _global: data?.message ?? 'Não foi possível publicar o comunicado. Tente novamente.',
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
      title="Novo comunicado"
      description="Publique um comunicado para todos os membros da empresa."
      size="md"
      closeOnEscape={!submitting}
      closeOnOverlayClick={!submitting}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="announcement-form" variant="primary" loading={submitting}>
            Publicar comunicado
          </Button>
        </div>
      }
    >
      <form
        id="announcement-form"
        onSubmit={handleSubmit}
        className="flex flex-col gap-4"
        noValidate
      >
        {errors._global && (
          <div
            role="alert"
            className="rounded-md border border-red-vivid/30 bg-red-vivid/5 px-3 py-2 text-sm text-red-vivid"
          >
            {errors._global}
          </div>
        )}

        <Input
          label="Título"
          name="title"
          value={values.title}
          onChange={(e) => setField('title', e.target.value)}
          maxLength={ANNOUNCEMENT_TITLE_MAX_LENGTH}
          required
          placeholder="Ex.: Reunião geral na sexta-feira"
          error={errors.title}
          helperText={`${values.title.trim().length}/${ANNOUNCEMENT_TITLE_MAX_LENGTH} caracteres`}
          disabled={submitting}
        />

        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor="announcement-content" className="text-sm font-medium text-text-primary">
            Conteúdo
            <span aria-hidden="true" className="ml-0.5 text-red-vivid">
              *
            </span>
          </label>
          <textarea
            id="announcement-content"
            value={values.content}
            onChange={(e) => setField('content', e.target.value)}
            maxLength={ANNOUNCEMENT_CONTENT_MAX_LENGTH}
            rows={6}
            disabled={submitting}
            required
            placeholder="Escreva o conteúdo do comunicado..."
            aria-invalid={Boolean(errors.content) || undefined}
            aria-describedby={
              errors.content ? 'announcement-content-error' : 'announcement-content-hint'
            }
            className={[
              'w-full resize-y rounded-md border bg-white px-3 py-2 text-sm text-text-primary',
              'placeholder:text-text-muted',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30',
              errors.content
                ? 'border-red-vivid focus-visible:border-red-vivid focus-visible:ring-red-vivid/30'
                : 'border-border-light focus-visible:border-red-core',
              'disabled:cursor-not-allowed disabled:bg-surface-bg disabled:text-text-muted',
            ].join(' ')}
          />
          {errors.content ? (
            <p id="announcement-content-error" className="text-xs text-red-vivid">
              {errors.content}
            </p>
          ) : (
            <p id="announcement-content-hint" className="text-xs text-text-muted">
              {values.content.trim().length}/{ANNOUNCEMENT_CONTENT_MAX_LENGTH} caracteres
            </p>
          )}
        </div>
      </form>
    </Modal>
  );
}
