'use client';

/**
 * `InfractionForm` — Formulário de registro de infração (Task 16.5).
 *
 * Exibido em modal. Apenas equipe GP pode acessar.
 * Campos: membro infrator (select), tipo de infração (select), data.
 * Pontos são atribuídos automaticamente pelo backend via InfractionConfig.
 */

import { type FormEvent, useState } from 'react';

import { Button, Modal } from '@/components/ui';

export interface InfractionFormProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  activeUsers: { id: string; name: string }[];
}

const INFRACTION_TYPE_LABELS: Record<string, string> = {
  ATRASO: 'Atraso',
  FALTA: 'Falta',
  DRESS_CODE: 'Dress Code',
};

export function InfractionForm({ open, onClose, onSaved, activeUsers }: InfractionFormProps) {
  const [targetId, setTargetId] = useState('');
  const [type, setType] = useState('');
  const [date, setDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetForm() {
    setTargetId('');
    setType('');
    setDate('');
    setErrors({});
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrors({});

    // Client-side validation
    const newErrors: Record<string, string> = {};
    if (!targetId) newErrors.targetId = 'Selecione o membro infrator.';
    if (!type) newErrors.type = 'Selecione o tipo de infração.';
    if (!date) {
      newErrors.date = 'A data é obrigatória.';
    } else {
      const d = new Date(date);
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      if (d > today) newErrors.date = 'A data não pode ser futura.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, date, targetId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        if (data?.fields) {
          const fieldErrors: Record<string, string> = {};
          for (const field of data.fields) {
            fieldErrors[field.path] = field.message;
          }
          setErrors(fieldErrors);
        } else {
          setErrors({ form: data?.message ?? 'Erro ao registrar infração.' });
        }
        return;
      }

      resetForm();
      onSaved();
    } catch {
      setErrors({ form: 'Erro de conexão. Tente novamente.' });
    } finally {
      setSubmitting(false);
    }
  }

  // Today formatted for max date in input
  const today = new Date().toISOString().split('T')[0];

  return (
    <Modal open={open} onClose={handleClose} title="Registrar Infração">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {/* Target member select */}
        <div className="flex flex-col gap-1">
          <label htmlFor="infraction-target" className="text-sm font-medium text-text-primary">
            Membro infrator
          </label>
          <select
            id="infraction-target"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            className="rounded-md border border-border-light bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-red-core focus:ring-1 focus:ring-red-core"
          >
            <option value="">Selecione um membro...</option>
            {activeUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
          {errors.targetId && <p className="text-xs text-red-vivid">{errors.targetId}</p>}
        </div>

        {/* Type select */}
        <div className="flex flex-col gap-1">
          <label htmlFor="infraction-type" className="text-sm font-medium text-text-primary">
            Tipo de infração
          </label>
          <select
            id="infraction-type"
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="rounded-md border border-border-light bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-red-core focus:ring-1 focus:ring-red-core"
          >
            <option value="">Selecione o tipo...</option>
            {Object.entries(INFRACTION_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          {errors.type && <p className="text-xs text-red-vivid">{errors.type}</p>}
        </div>

        {/* Date input */}
        <div className="flex flex-col gap-1">
          <label htmlFor="infraction-date" className="text-sm font-medium text-text-primary">
            Data da infração
          </label>
          <input
            id="infraction-date"
            type="date"
            value={date}
            max={today}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-border-light bg-surface-card px-3 py-2 text-sm text-text-primary outline-none focus:border-red-core focus:ring-1 focus:ring-red-core"
          />
          {errors.date && <p className="text-xs text-red-vivid">{errors.date}</p>}
        </div>

        {/* Form-level error */}
        {errors.form && <p className="text-xs text-red-vivid">{errors.form}</p>}

        {/* Actions */}
        <div className="flex items-center justify-end gap-2 pt-2">
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
          >
            Registrar
          </Button>
        </div>
      </form>
    </Modal>
  );
}
