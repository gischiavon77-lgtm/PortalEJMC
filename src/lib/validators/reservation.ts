/**
 * Validadores Zod para o módulo Reserva de Computadores — Tasks 17.1, 17.2, 17.8.
 *
 * Cobrem os payloads de:
 *   - `POST /api/reservations` → `createReservationSchema`
 *   - `GET /api/reservations`  → `getReservationsSchema` (query params)
 *
 * Regras de negócio (design.md → Propriedade 17):
 *   a. Data estritamente futura (> hoje)
 *   b. Data dentro dos próximos 7 dias
 *   c. Máximo 1 computador por dia por usuário
 *   d. Sem 3 dias consecutivos de reserva
 *   e. Computador deve estar disponível na data
 */

import { z } from 'zod';

// ─── Constantes ──────────────────────────────────────────────────────

export const MIN_COMPUTER_ID = 1;
export const MAX_COMPUTER_ID = 7;
export const MAX_ADVANCE_DAYS = 7;
export const MAX_CONSECUTIVE_DAYS = 2; // max 2 consecutivos, 3 é proibido

// ─── Mensagens de erro (Task 17.8) ──────────────────────────────────

export const RESERVATION_ERROR_MESSAGES = {
  dateFuture: 'A reserva deve ser feita com pelo menos 1 dia de antecedência.',
  dateWithin7Days: 'A reserva deve estar dentro dos próximos 7 dias.',
  maxOnePerDay: 'Você já possui uma reserva para este dia. Limite: 1 computador por dia.',
  noConsecutive3: 'Não é permitido reservar por 3 dias consecutivos.',
  computerUnavailable: 'Este computador já está reservado para a data selecionada.',
  computerIdInvalid: 'O computador deve ser um número entre 1 e 7.',
  dateInvalid: 'Data inválida.',
  notOwner: 'Você só pode cancelar suas próprias reservas.',
  notFuture: 'Só é possível cancelar reservas futuras.',
  notFound: 'Reserva não encontrada.',
} as const;

// ─── Schemas ─────────────────────────────────────────────────────────

/**
 * Payload de criação de reserva (POST /api/reservations).
 * Valida apenas o formato; regras de negócio são checadas no handler.
 */
export const createReservationSchema = z.object({
  computerId: z
    .number({ message: RESERVATION_ERROR_MESSAGES.computerIdInvalid })
    .int({ message: RESERVATION_ERROR_MESSAGES.computerIdInvalid })
    .min(MIN_COMPUTER_ID, { message: RESERVATION_ERROR_MESSAGES.computerIdInvalid })
    .max(MAX_COMPUTER_ID, { message: RESERVATION_ERROR_MESSAGES.computerIdInvalid }),
  date: z
    .string({ message: RESERVATION_ERROR_MESSAGES.dateInvalid })
    .min(1, { message: RESERVATION_ERROR_MESSAGES.dateInvalid })
    .refine(
      (val) => {
        const d = new Date(val);
        return !isNaN(d.getTime());
      },
      { message: RESERVATION_ERROR_MESSAGES.dateInvalid },
    ),
});

export type CreateReservationInput = z.infer<typeof createReservationSchema>;

/**
 * Query params para GET /api/reservations.
 */
export const getReservationsSchema = z.object({
  startDate: z
    .string()
    .min(1, { message: 'startDate é obrigatório.' })
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'startDate inválido.' }),
  endDate: z
    .string()
    .min(1, { message: 'endDate é obrigatório.' })
    .refine((val) => !isNaN(new Date(val).getTime()), { message: 'endDate inválido.' }),
});

// ─── Helpers de validação de regras de negócio ──────────────────────

/**
 * Retorna o início do dia em UTC (00:00:00.000Z) para uma data string YYYY-MM-DD.
 */
export function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

/**
 * Retorna hoje à meia-noite UTC.
 */
export function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

/**
 * Valida a regra (a): data estritamente futura (> hoje).
 */
export function isDateFuture(date: Date, today: Date): boolean {
  return date.getTime() > today.getTime();
}

/**
 * Valida a regra (b): data dentro dos próximos 7 dias.
 */
export function isDateWithin7Days(date: Date, today: Date): boolean {
  const maxDate = new Date(today);
  maxDate.setUTCDate(maxDate.getUTCDate() + MAX_ADVANCE_DAYS);
  return date.getTime() <= maxDate.getTime();
}

/**
 * Valida a regra (d): verificar se a nova reserva formaria 3+ dias consecutivos.
 * Recebe as datas já reservadas pelo usuário (em UTC midnight) e a nova data.
 * Retorna true se a reserva é permitida (não forma 3 consecutivos).
 */
export function isNotThreeConsecutive(existingDates: Date[], newDate: Date): boolean {
  // Adiciona a nova data ao conjunto
  const allDates = [...existingDates, newDate].map((d) => d.getTime());
  const uniqueSorted = Array.from(new Set(allDates)).sort((a, b) => a - b);

  // Percorre verificando sequências consecutivas
  const ONE_DAY = 24 * 60 * 60 * 1000;
  let consecutive = 1;

  for (let i = 1; i < uniqueSorted.length; i++) {
    if (uniqueSorted[i] - uniqueSorted[i - 1] === ONE_DAY) {
      consecutive++;
      if (consecutive >= 3) return false;
    } else {
      consecutive = 1;
    }
  }

  return true;
}
