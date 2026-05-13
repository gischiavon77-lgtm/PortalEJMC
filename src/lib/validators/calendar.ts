/**
 * Validadores Zod para o módulo Cronograma — Task 7.2.
 *
 * Cobrem os payloads de `POST /api/calendar/events` e
 * `PATCH /api/calendar/events/:id`, alinhados ao Req 8.2:
 *
 *   - `title`     → string 1-100 caracteres (após trim).
 *   - `startsAt`  → datetime ISO 8601 válido.
 *   - `endsAt`    → datetime ISO 8601 válido, posterior a `startsAt`.
 *   - `description` (opcional) → até 2000 caracteres, reservado para
 *                   uso futuro pela UI; preserva o campo no payload
 *                   sem exigi-lo.
 *
 * Por que validar `startsAt < endsAt` aqui (e não no DB)?
 *   O modelo `Event` no Prisma não tem CHECK constraint para essa
 *   regra (limitações do Prisma 7 com Postgres). Centralizar a regra
 *   no schema Zod garante mensagem clara em pt-BR e bloqueio precoce,
 *   antes de qualquer roundtrip ao banco ou ao Google.
 */

import { z } from 'zod';

export const EVENT_TITLE_MIN_LENGTH = 1;
export const EVENT_TITLE_MAX_LENGTH = 100;
export const EVENT_DESCRIPTION_MAX_LENGTH = 2000;

export const EVENT_VALIDATION_MESSAGES = {
  title: {
    required: 'O título do evento é obrigatório.',
    tooShort: 'O título do evento não pode ser vazio.',
    tooLong: `O título deve ter no máximo ${EVENT_TITLE_MAX_LENGTH} caracteres.`,
  },
  startsAt: {
    required: 'A data/hora de início é obrigatória.',
    invalid: 'Informe uma data/hora de início válida.',
  },
  endsAt: {
    required: 'A data/hora de fim é obrigatória.',
    invalid: 'Informe uma data/hora de fim válida.',
    afterStart: 'A data/hora de fim deve ser posterior à de início.',
  },
  description: {
    tooLong: `A descrição deve ter no máximo ${EVENT_DESCRIPTION_MAX_LENGTH} caracteres.`,
  },
} as const;

/**
 * Aceita ISO 8601 (ex.: '2025-01-15T14:30:00.000Z'). Convertido para
 * `Date` no transform para que os callers operem direto com `Date`.
 *
 * Rejeita strings que produzem `Invalid Date` (ex.: '2025-13-99').
 */
const isoDateTime = (messages: { required: string; invalid: string }) =>
  z
    .string({ error: messages.required })
    .min(1, { message: messages.required })
    .refine((value) => !Number.isNaN(Date.parse(value)), {
      message: messages.invalid,
    })
    .transform((value) => new Date(value));

/**
 * Schema base com os campos de um evento. Reaproveitado pelo
 * `createEventSchema` (todos obrigatórios) e pelo `updateEventSchema`
 * (todos opcionais via `.partial()`).
 */
const eventBase = z.object({
  title: z
    .string({ error: EVENT_VALIDATION_MESSAGES.title.required })
    .trim()
    .min(EVENT_TITLE_MIN_LENGTH, {
      message: EVENT_VALIDATION_MESSAGES.title.tooShort,
    })
    .max(EVENT_TITLE_MAX_LENGTH, {
      message: EVENT_VALIDATION_MESSAGES.title.tooLong,
    }),
  startsAt: isoDateTime(EVENT_VALIDATION_MESSAGES.startsAt),
  endsAt: isoDateTime(EVENT_VALIDATION_MESSAGES.endsAt),
  description: z
    .string()
    .trim()
    .max(EVENT_DESCRIPTION_MAX_LENGTH, {
      message: EVENT_VALIDATION_MESSAGES.description.tooLong,
    })
    .optional(),
});

/** Payload de criação — todos os campos obrigatórios. */
export const createEventSchema = eventBase.refine(
  (data) => data.endsAt.getTime() > data.startsAt.getTime(),
  {
    path: ['endsAt'],
    message: EVENT_VALIDATION_MESSAGES.endsAt.afterStart,
  },
);

/**
 * Payload de atualização — todos opcionais. A regra `endsAt > startsAt`
 * só é avaliada quando ambos os campos são fornecidos OU quando um
 * deles é fornecido e o outro existe na entidade. Como o schema não
 * tem acesso ao registro atual, validamos somente o caso "ambos no
 * payload" — a checagem cruzada com o evento persistido fica na rota.
 */
export const updateEventSchema = eventBase.partial().refine(
  (data) => {
    if (data.startsAt && data.endsAt) {
      return data.endsAt.getTime() > data.startsAt.getTime();
    }
    return true;
  },
  {
    path: ['endsAt'],
    message: EVENT_VALIDATION_MESSAGES.endsAt.afterStart,
  },
);

export type CreateEventInput = z.infer<typeof createEventSchema>;
export type UpdateEventInput = z.infer<typeof updateEventSchema>;

/**
 * Schema dos query params de `GET /api/calendar/events`.
 *
 * Aceita `startDate` e `endDate` em ISO 8601. Se ausentes, a rota
 * aplica defaults (mês corrente). Quando ambos presentes, exigimos
 * `startDate <= endDate`.
 */
export const listEventsQuerySchema = z
  .object({
    startDate: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: 'Parâmetro startDate inválido.',
      })
      .transform((value) => new Date(value))
      .optional(),
    endDate: z
      .string()
      .refine((value) => !Number.isNaN(Date.parse(value)), {
        message: 'Parâmetro endDate inválido.',
      })
      .transform((value) => new Date(value))
      .optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate.getTime() >= data.startDate.getTime();
      }
      return true;
    },
    {
      path: ['endDate'],
      message: 'endDate deve ser posterior ou igual a startDate.',
    },
  );

export type ListEventsQueryInput = z.infer<typeof listEventsQuerySchema>;
