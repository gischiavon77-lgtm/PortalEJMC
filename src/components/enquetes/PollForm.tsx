'use client';

/**
 * `PollForm` — Formulário de criação de enquete (Task 15.7).
 *
 * Modal com inputs dinâmicos para opções (adicionar/remover).
 * Validação client-side reutiliza constantes do schema Zod.
 *
 * Regras:
 *   - Título: 1–150 chars
 *   - Descrição: 1–2000 chars
 *   - Opções: 2–10, cada uma 1–200 chars
 */

import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';

import { Button, Input, Modal } from '@/components/ui';
import {
  POLL_TITLE_MAX_LENGTH,
  POLL_DESCRIPTION_MAX_LENGTH,
  POLL_OPTION_TEXT_MAX_LENGTH,
  POLL_OPTIONS_MIN,
  POLL_OPTIONS_MAX,
  POLL_VALIDATION_MESSAGES,
} from '@/lib/validators/poll';

const formSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, POLL_VALIDATION_MESSAGES.title.required)
    .max(POLL_TITLE_MAX_LENGTH, POLL_VALIDATION_MESSAGES.title.tooLong),
  description: z
    .string()
    .trim()
    .min(1, POLL_VALIDATION_MESSAGES.description.required)
    .max(POLL_DESCRIPTION_MAX_LENGTH, POLL_VALIDATION_MESSAGES.description.tooLong),
  options: z
    .array(
      z
        .string()
        .trim()
        .min(1, POLL_VALIDATION_MESSAGES.options.itemRequired)
        .max(POLL_OPTION_TEXT_MAX_LENGTH, POLL_VALIDATION_MESSAGES.options.itemTooLong),
    )
    .min(POLL_OPTIONS_MIN, POLL_VALIDATION_MESSAGES.options.tooFew)
    .max(POLL_OPTIONS_MAX, POLL_VALIDATION_MESSAGES.options.tooMany),
});

type FormErrors = Partial<Record<'title' | 'description' | 'options' | '_global', string>>;

export interface PollFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function PollForm({ open, onClose, onSaved }: PollFormProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [options, setOptions] = useState<string[]>(['', '']);
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);

  // Reset when modal opens
  useEffect(() => {
    if (!open) return;
    setTitle('');
    setDescription('');
    setOptions(['', '']);
    setErrors({});
  }, [open]);

  function addOption() {
    if (options.length >= POLL_OPTIONS_MAX) return;
    setOptions((prev) => [...prev, '']);
  }

  function removeOption(index: number) {
    if (options.length <= POLL_OPTIONS_MIN) return;
    setOptions((prev) => prev.filter((_, i) => i !== index));
  }

  function updateOption(index: number, value: string) {
    setOptions((prev) => prev.map((opt, i) => (i === index ? value : opt)));
    setErrors((prev) => ({ ...prev, options: undefined, _global: undefined }));
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting) return;

    setErrors({});

    const parsed = formSchema.safeParse({ title, description, options });
    if (!parsed.success) {
      const next: FormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0];
        if (key === 'title' || key === 'description' || key === 'options') {
          if (!next[key]) next[key] = issue.message;
        } else {
          if (!next._global) next._global = issue.message;
        }
      }
      setErrors(next);
      return;
    }

    const payload = {
      title: parsed.data.title,
      description: parsed.data.description,
      options: parsed.data.options,
    };

    setSubmitting(true);
    try {
      const res = await fetch('/api/polls', {
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
            const key = f.path.split('.')[0] as keyof FormErrors;
            if (!next[key]) next[key] = f.message;
          }
          setErrors(next);
        } else {
          setErrors({
            _global: data?.message ?? 'Não foi possível criar a enquete. Tente novamente.',
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
      title="Nova enquete"
      description="Crie uma enquete para votação dos membros."
      size="md"
      closeOnEscape={!submitting}
      closeOnOverlayClick={!submitting}
      footer={
        <div className="flex w-full items-center justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
            Cancelar
          </Button>
          <Button type="submit" form="poll-form" variant="primary" loading={submitting}>
            Criar enquete
          </Button>
        </div>
      }
    >
      <form id="poll-form" onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
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
          name="poll-title"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
            setErrors((prev) => ({ ...prev, title: undefined, _global: undefined }));
          }}
          maxLength={POLL_TITLE_MAX_LENGTH}
          required
          placeholder="Ex.: Próximo tema da capacitação"
          error={errors.title}
          helperText={`${title.trim().length}/${POLL_TITLE_MAX_LENGTH} caracteres`}
          disabled={submitting}
        />

        <div className="flex w-full flex-col gap-1.5">
          <label htmlFor="poll-description" className="text-sm font-medium text-text-primary">
            Descrição
            <span aria-hidden="true" className="ml-0.5 text-red-vivid">
              *
            </span>
          </label>
          <textarea
            id="poll-description"
            value={description}
            onChange={(e) => {
              setDescription(e.target.value);
              setErrors((prev) => ({ ...prev, description: undefined, _global: undefined }));
            }}
            maxLength={POLL_DESCRIPTION_MAX_LENGTH}
            rows={3}
            disabled={submitting}
            required
            placeholder="Descreva o propósito da enquete..."
            aria-invalid={Boolean(errors.description) || undefined}
            aria-describedby={
              errors.description ? 'poll-description-error' : 'poll-description-hint'
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
            <p id="poll-description-error" className="text-xs text-red-vivid">
              {errors.description}
            </p>
          ) : (
            <p id="poll-description-hint" className="text-xs text-text-muted">
              {description.trim().length}/{POLL_DESCRIPTION_MAX_LENGTH} caracteres
            </p>
          )}
        </div>

        {/* Dynamic Options */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-text-primary">
              Opções
              <span aria-hidden="true" className="ml-0.5 text-red-vivid">
                *
              </span>
            </label>
            <span className="text-xs text-text-muted">
              {options.length}/{POLL_OPTIONS_MAX}
            </span>
          </div>

          {errors.options && <p className="text-xs text-red-vivid">{errors.options}</p>}

          <div className="flex flex-col gap-2">
            {options.map((option, index) => (
              <div key={index} className="flex items-center gap-2">
                <input
                  type="text"
                  value={option}
                  onChange={(e) => updateOption(index, e.target.value)}
                  placeholder={`Opção ${index + 1}`}
                  maxLength={POLL_OPTION_TEXT_MAX_LENGTH}
                  disabled={submitting}
                  className={[
                    'flex-1 rounded-md border bg-white px-3 py-2 text-sm text-text-primary',
                    'placeholder:text-text-muted',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-core/30',
                    'border-border-light focus-visible:border-red-core',
                    'disabled:cursor-not-allowed disabled:bg-surface-bg disabled:text-text-muted',
                  ].join(' ')}
                  aria-label={`Opção ${index + 1}`}
                />
                {options.length > POLL_OPTIONS_MIN && (
                  <button
                    type="button"
                    onClick={() => removeOption(index)}
                    disabled={submitting}
                    className="shrink-0 rounded-md p-1.5 text-text-muted hover:bg-red-vivid/10 hover:text-red-vivid transition-colors disabled:opacity-50"
                    aria-label={`Remover opção ${index + 1}`}
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
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
            ))}
          </div>

          {options.length < POLL_OPTIONS_MAX && (
            <button
              type="button"
              onClick={addOption}
              disabled={submitting}
              className="mt-1 flex items-center gap-1 self-start rounded-md px-2 py-1 text-xs font-medium text-red-core hover:bg-red-core/5 transition-colors disabled:opacity-50"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Adicionar opção
            </button>
          )}
        </div>
      </form>
    </Modal>
  );
}
