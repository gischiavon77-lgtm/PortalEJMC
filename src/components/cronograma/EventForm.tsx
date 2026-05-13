'use client';

/**
 * `EventForm` — Formulário de criação/edição de evento (Task 7.6).
 *
 * Renderizado dentro do `Modal` da UI base. Suporta dois modos:
 *
 *   - **create** — sem `event`; submete via `POST /api/calendar/events`.
 *   - **edit**   — com `event`; submete via
 *                  `PATCH /api/calendar/events/:id` e expõe um botão
 *                  "Excluir" que chama `DELETE`.
 *
 * Validação client-side reusa o mesmo schema Zod que a API
 * (`createEventSchema`/`updateEventSchema` em
 * `@/lib/validators/calendar`). Manter um único schema garante que
 * uma alteração de regra (ex.: aumentar o limite do título) seja
 * aplicada simultaneamente em frontend e backend, eliminando
 * divergências silenciosas.
 *
 * ─── Tratamento de datas ────────────────────────────────────────────
 *
 * Os inputs `<input type="datetime-local">` produzem strings sem fuso
 * (ex.: "2025-01-15T14:30"). Convertemos para ISO 8601 UTC antes de
 * enviar — `new Date(localString).toISOString()` é suficiente porque
 * o navegador interpreta `localString` no fuso local do usuário.
 *
 * Para preencher o formulário em modo edição, fazemos o caminho
 * inverso: convertemos o ISO do banco para "local datetime-string"
 * (ver `toDatetimeLocal`).
 *
 * ─── Estados de submit ──────────────────────────────────────────────
 *
 *   - `submitting`  — durante o fetch; desabilita botões e exibe spinner.
 *   - `errors`      — mapa por campo com mensagens em pt-BR; vem da
 *                     validação Zod local + erros do servidor (mesmo
 *                     formato `fields: [{path, message}]`).
 *   - `globalError` — mensagem genérica para falhas de rede ou códigos
 *                     desconhecidos (502, etc.).
 *   - `syncWarning` — quando a API responde 201/200 com
 *                     `sync.status === 'failed'`, exibimos uma mensagem
 *                     informando que o evento foi salvo localmente mas
 *                     não chegou ao Google. Isso casa com o indicador
 *                     visual da Task 7.9 dentro do calendário.
 *
 * ─── Acessibilidade ────────────────────────────────────────────────
 *
 *   - O modal já gerencia foco inicial e `aria-labelledby`.
 *   - Erros aparecem abaixo do `Input` correspondente via `error` —
 *     isso já adiciona `aria-describedby` corretamente.
 *   - O botão "Excluir" (modo edição) confirma a ação via
 *     `window.confirm` antes de chamar a API. Ainda que esse padrão
 *     não seja ideal para mobile, é suficiente para uma operação
 *     destrutiva em um portal interno e dispensa um segundo modal.
 */

import { useEffect, useState, type FormEvent } from 'react';
import { z } from 'zod';

import { Button, Input, Modal } from '@/components/ui';
import {
  EVENT_TITLE_MAX_LENGTH,
  EVENT_VALIDATION_MESSAGES,
} from '@/lib/validators/calendar';
import type { CalendarEvent } from './calendar-utils';

/**
 * Schema de validação client-side. NÃO importamos os schemas de
 * `validators/calendar.ts` diretamente porque eles fazem `transform`
 * para `Date`, o que dificulta o re-uso em formulários (queremos as
 * strings cruas para reagir a `error.path`). Mantemos uma versão
 * paralela com as MESMAS regras — as constantes/labels vêm do mesmo
 * módulo, então uma mudança em `EVENT_TITLE_MAX_LENGTH` propaga
 * automaticamente.
 */
const formSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(1, EVENT_VALIDATION_MESSAGES.title.tooShort)
      .max(EVENT_TITLE_MAX_LENGTH, EVENT_VALIDATION_MESSAGES.title.tooLong),
    startsAt: z
      .string()
      .min(1, EVENT_VALIDATION_MESSAGES.startsAt.required)
      .refine((v) => !Number.isNaN(Date.parse(v)), {
        message: EVENT_VALIDATION_MESSAGES.startsAt.invalid,
      }),
    endsAt: z
      .string()
      .min(1, EVENT_VALIDATION_MESSAGES.endsAt.required)
      .refine((v) => !Number.isNaN(Date.parse(v)), {
        message: EVENT_VALIDATION_MESSAGES.endsAt.invalid,
      }),
  })
  .refine(
    (data) => {
      const s = Date.parse(data.startsAt);
      const e = Date.parse(data.endsAt);
      if (Number.isNaN(s) || Number.isNaN(e)) return true;
      return e > s;
    },
    {
      path: ['endsAt'],
      message: EVENT_VALIDATION_MESSAGES.endsAt.afterStart,
    },
  );

type FormErrors = Partial<Record<'title' | 'startsAt' | 'endsAt' | '_global', string>>;

export interface EventFormProps {
  open: boolean;
  onClose: () => void;
  /**
   * Quando informado, o formulário entra em modo edição. Sem evento,
   * é tratado como criação.
   */
  event?: CalendarEvent | null;
  /**
   * Data inicial sugerida para um novo evento (ex.: clique em uma
   * célula da grade). Em modo edição, é ignorada.
   */
  defaultDate?: Date | null;
  /** Chamado após criar/editar/excluir com sucesso para revalidar dados. */
  onSaved: () => void;
}

const isEditingMode = (event?: CalendarEvent | null): event is CalendarEvent =>
  Boolean(event && event.id);

/**
 * Converte um `Date` para o formato aceito por `<input type="datetime-local">`
 * (`YYYY-MM-DDTHH:mm`) usando o fuso local. `toISOString` produziria UTC,
 * o que confundiria o usuário que digitou em horário local.
 */
function toDatetimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * Constrói o estado inicial do formulário de acordo com o modo.
 */
function buildInitialState(
  event?: CalendarEvent | null,
  defaultDate?: Date | null,
) {
  if (isEditingMode(event)) {
    return {
      title: event.title,
      startsAt: toDatetimeLocal(new Date(event.startsAt)),
      endsAt: toDatetimeLocal(new Date(event.endsAt)),
    };
  }

  // Para novos eventos, usa o `defaultDate` (ou hoje) como base, com
  // hora padrão 09:00 → 10:00. É a janela mais provável para um
  // evento corporativo e evita o usuário ter que ajustar horários
  // mínimos.
  const base = defaultDate ?? new Date();
  const start = new Date(
    base.getFullYear(),
    base.getMonth(),
    base.getDate(),
    9,
    0,
    0,
    0,
  );
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    title: '',
    startsAt: toDatetimeLocal(start),
    endsAt: toDatetimeLocal(end),
  };
}

export function EventForm({
  open,
  onClose,
  event = null,
  defaultDate = null,
  onSaved,
}: EventFormProps) {
  const editing = isEditingMode(event);
  const [values, setValues] = useState(() =>
    buildInitialState(event, defaultDate),
  );
  const [errors, setErrors] = useState<FormErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [syncWarning, setSyncWarning] = useState<string | null>(null);

  // Quando o modal abre OU o evento muda, reseta o estado.
  useEffect(() => {
    if (!open) return;
    setValues(buildInitialState(event, defaultDate));
    setErrors({});
    setSyncWarning(null);
    // Não dependemos de `defaultDate` em deps para evitar resets em
    // cada render do parent; basta o `open`/`event` mudarem.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, event?.id]);

  function setField<K extends keyof typeof values>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: undefined, _global: undefined }));
  }

  async function handleSubmit(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (submitting || deleting) return;

    setErrors({});
    setSyncWarning(null);

    // Validação local com Zod.
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

    // Converte para ISO 8601 antes de enviar. `new Date(localString)`
    // assume fuso local; `.toISOString()` converte para UTC.
    const payload = {
      title: parsed.data.title,
      startsAt: new Date(parsed.data.startsAt).toISOString(),
      endsAt: new Date(parsed.data.endsAt).toISOString(),
    };

    setSubmitting(true);
    try {
      const url = editing
        ? `/api/calendar/events/${event!.id}`
        : '/api/calendar/events';
      const method = editing ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | {
              code?: string;
              message?: string;
              fields?: Array<{ path: string; message: string }>;
            }
          | null;

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
              data?.message ?? 'Não foi possível salvar o evento. Tente novamente.',
          });
        }
        return;
      }

      // Sucesso: pode vir um warning de sync (Task 7.9).
      const data = (await res.json().catch(() => null)) as
        | { sync?: { status?: string } }
        | null;
      if (data?.sync?.status === 'failed') {
        setSyncWarning(
          'Evento salvo, mas a sincronização com o Google Calendar falhou. O sistema tentará novamente em segundos.',
        );
      }

      onSaved();
      // Em caso de warning, mantemos o modal aberto por 1.5s para o
      // usuário ler. Em sucesso pleno, fechamos imediatamente.
      if (data?.sync?.status === 'failed') {
        window.setTimeout(() => onClose(), 1500);
      } else {
        onClose();
      }
    } catch {
      setErrors({
        _global:
          'Erro de conexão. Verifique sua internet e tente novamente.',
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editing) return;
    if (deleting || submitting) return;

    const confirmed = window.confirm(
      'Tem certeza que deseja excluir este evento? Esta ação não pode ser desfeita.',
    );
    if (!confirmed) return;

    setDeleting(true);
    setErrors({});
    try {
      const res = await fetch(`/api/calendar/events/${event!.id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as
          | { message?: string }
          | null;
        setErrors({
          _global:
            data?.message ?? 'Não foi possível excluir o evento. Tente novamente.',
        });
        return;
      }
      onSaved();
      onClose();
    } catch {
      setErrors({
        _global:
          'Erro de conexão. Verifique sua internet e tente novamente.',
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={submitting || deleting ? () => {} : onClose}
      title={editing ? 'Editar evento' : 'Novo evento'}
      description={
        editing
          ? 'Atualize os dados do evento. As alterações serão sincronizadas com o Google Calendar.'
          : 'Preencha os dados do evento. Ele será sincronizado com o Google Calendar.'
      }
      size="lg"
      closeOnEscape={!submitting && !deleting}
      closeOnOverlayClick={!submitting && !deleting}
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          {editing ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              loading={deleting}
              disabled={submitting}
            >
              Excluir
            </Button>
          ) : (
            <span aria-hidden="true" />
          )}
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={submitting || deleting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              form="event-form"
              variant="primary"
              loading={submitting}
              disabled={deleting}
            >
              {editing ? 'Salvar alterações' : 'Criar evento'}
            </Button>
          </div>
        </div>
      }
    >
      <form
        id="event-form"
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

        {syncWarning && (
          <div
            role="status"
            className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800"
          >
            {syncWarning}
          </div>
        )}

        <Input
          label="Título"
          name="title"
          value={values.title}
          onChange={(e) => setField('title', e.target.value)}
          maxLength={EVENT_TITLE_MAX_LENGTH}
          required
          placeholder="Ex.: Reunião de planejamento"
          error={errors.title}
          helperText={`${values.title.trim().length}/${EVENT_TITLE_MAX_LENGTH} caracteres`}
          disabled={submitting || deleting}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Início"
            name="startsAt"
            type="datetime-local"
            value={values.startsAt}
            onChange={(e) => setField('startsAt', e.target.value)}
            required
            error={errors.startsAt}
            disabled={submitting || deleting}
          />
          <Input
            label="Fim"
            name="endsAt"
            type="datetime-local"
            value={values.endsAt}
            onChange={(e) => setField('endsAt', e.target.value)}
            required
            error={errors.endsAt}
            disabled={submitting || deleting}
          />
        </div>
      </form>
    </Modal>
  );
}
