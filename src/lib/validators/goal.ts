/**
 * Validadores Zod para o módulo Metas — Task 8.2.
 *
 * Cobrem os payloads de:
 *   - `POST   /api/goals`          → `createGoalSchema`
 *   - `PATCH  /api/goals/:id`      → `updateProgressSchema`
 *   - `GET    /api/goals?type=...` → `listGoalsQuerySchema`
 *
 * Regras (Req 9.1, 9.3, 9.6 / Property 11):
 *   - `name`        → 1–100 caracteres (após `trim`).
 *   - `description` → 0–500 caracteres (opcional, default vazio).
 *   - `type`        → enum `GENERAL` | `AREA`.
 *   - `area`        → enum de `Area` do Prisma; obrigatório quando
 *                     `type === 'AREA'`, proibido quando `type === 'GENERAL'`.
 *   - `deadline`    → ISO 8601 com a data **estritamente** no futuro
 *                     (rigor "data > agora", coerente com Req 9.1
 *                     "prazo (data futura)" e Req 9.6 "prazo no passado"
 *                     como dado inválido).
 *   - `progress`    → inteiro 0–100, validado pelo `updateProgressSchema`.
 *
 * ─── Por que validar `deadline > agora` aqui (e não no DB)? ───────────
 *   O modelo `Goal` no Prisma não tem CHECK constraint para a regra de
 *   "data futura". Centralizar a validação no schema Zod garante:
 *     1. Mensagens em pt-BR alinhadas ao restante do portal.
 *     2. Rejeição precoce — sem roundtrip ao banco.
 *     3. Reuso entre client (form) e server (API), evitando divergência.
 *
 *   A comparação usa `Date.now()` no momento da validação. Isso significa
 *   que uma meta criada com `deadline = agora + 1ms` passa, mas uma com
 *   `deadline = agora` falha — comportamento consistente com "data
 *   estritamente futura".
 *
 * ─── Sobre o `type`/`area` interdependentes ──────────────────────────
 *   A Req 9.2 exige que `type === 'AREA'` venha acompanhado de uma área
 *   válida. Já `type === 'GENERAL'` (meta da empresa) NÃO deve ter
 *   `area` (caso contrário, o filtro de visibilidade da Req 9.7 não
 *   consegue distinguir uma meta geral de uma "geral mas só pra essa
 *   área"). Modelamos a regra com `.superRefine` para emitir mensagens
 *   no caminho correto (`area`).
 *
 * ─── Compat. Zod 4 ───────────────────────────────────────────────────
 *   `z.enum([...] as const)` aceita um array de literais; usamos isso
 *   para refletir os valores de `Area` e `GoalType` sem importar runtime
 *   do Prisma (mantendo o módulo livre para uso em qualquer camada).
 */

import { z } from 'zod';

// ─── Constantes de validação ─────────────────────────────────────────

export const GOAL_NAME_MIN_LENGTH = 1;
export const GOAL_NAME_MAX_LENGTH = 100;
export const GOAL_DESCRIPTION_MAX_LENGTH = 500;

export const GOAL_PROGRESS_MIN = 0;
export const GOAL_PROGRESS_MAX = 100;

/**
 * Conjunto de áreas conhecidas pelo Portal — espelha o enum `Area` do
 * Prisma (`schema.prisma`). Mantemos como literal array para que o
 * Zod produza um union tipado no `z.infer` sem importar runtime do
 * Prisma neste módulo (preserva ergonomia em testes/UI).
 */
export const GOAL_AREAS = [
  'VENDAS',
  'PRESIDENCIA',
  'PROJETOS',
  'MARKETING',
  'GESTAO_PESSOAS',
  'ADM_FIN',
] as const;

export const GOAL_TYPES = ['GENERAL', 'AREA'] as const;

export const GOAL_VALIDATION_MESSAGES = {
  name: {
    required: 'O nome da meta é obrigatório.',
    tooShort: 'O nome da meta não pode ser vazio.',
    tooLong: `O nome deve ter no máximo ${GOAL_NAME_MAX_LENGTH} caracteres.`,
  },
  description: {
    tooLong: `A descrição deve ter no máximo ${GOAL_DESCRIPTION_MAX_LENGTH} caracteres.`,
  },
  type: {
    required: 'O tipo da meta é obrigatório.',
    invalid: 'Tipo de meta inválido.',
  },
  area: {
    requiredForAreaGoal: 'Selecione a área para metas do tipo "Área".',
    forbiddenForGeneralGoal: 'Metas gerais não devem ter área associada.',
    invalid: 'Área inválida.',
  },
  deadline: {
    required: 'O prazo é obrigatório.',
    invalid: 'Informe um prazo válido.',
    notFuture: 'O prazo deve ser uma data futura.',
  },
  progress: {
    required: 'O progresso é obrigatório.',
    invalid: 'O progresso deve ser um número inteiro.',
    outOfRange: `O progresso deve ser um inteiro entre ${GOAL_PROGRESS_MIN} e ${GOAL_PROGRESS_MAX}.`,
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────

/**
 * Aceita ISO 8601 (ex.: '2025-12-31T23:59:00.000Z'); converte para
 * `Date` e exige que seja estritamente posterior a `now()`. Usado
 * apenas no `createGoalSchema` — em PATCH não permitimos editar o
 * prazo (o escopo da Task 8.8 é apenas progresso).
 */
const futureDateTime = z
  .string({ error: GOAL_VALIDATION_MESSAGES.deadline.required })
  .min(1, { message: GOAL_VALIDATION_MESSAGES.deadline.required })
  .refine((value) => !Number.isNaN(Date.parse(value)), {
    message: GOAL_VALIDATION_MESSAGES.deadline.invalid,
  })
  .transform((value) => new Date(value))
  .refine((date) => date.getTime() > Date.now(), {
    message: GOAL_VALIDATION_MESSAGES.deadline.notFuture,
  });

const goalTypeEnum = z.enum(GOAL_TYPES, {
  error: GOAL_VALIDATION_MESSAGES.type.invalid,
});

const goalAreaEnum = z.enum(GOAL_AREAS, {
  error: GOAL_VALIDATION_MESSAGES.area.invalid,
});

// ─── Schemas ─────────────────────────────────────────────────────────

/**
 * Payload de criação de meta. A regra cruzada `type ↔ area` é aplicada
 * via `superRefine` para que possamos emitir o erro no caminho `area`
 * (boa UX em formulários: o erro destaca o campo correto).
 */
export const createGoalSchema = z
  .object({
    name: z
      .string({ error: GOAL_VALIDATION_MESSAGES.name.required })
      .trim()
      .min(GOAL_NAME_MIN_LENGTH, {
        message: GOAL_VALIDATION_MESSAGES.name.tooShort,
      })
      .max(GOAL_NAME_MAX_LENGTH, {
        message: GOAL_VALIDATION_MESSAGES.name.tooLong,
      }),
    description: z
      .string()
      .trim()
      .max(GOAL_DESCRIPTION_MAX_LENGTH, {
        message: GOAL_VALIDATION_MESSAGES.description.tooLong,
      })
      .optional()
      .default(''),
    type: goalTypeEnum,
    /**
     * `area` é opcional no shape; a interdependência com `type` é
     * verificada no `superRefine` abaixo.
     */
    area: goalAreaEnum.optional(),
    deadline: futureDateTime,
  })
  .superRefine((data, ctx) => {
    if (data.type === 'AREA' && !data.area) {
      ctx.addIssue({
        code: 'custom',
        path: ['area'],
        message: GOAL_VALIDATION_MESSAGES.area.requiredForAreaGoal,
      });
    }
    if (data.type === 'GENERAL' && data.area) {
      ctx.addIssue({
        code: 'custom',
        path: ['area'],
        message: GOAL_VALIDATION_MESSAGES.area.forbiddenForGeneralGoal,
      });
    }
  });

export type CreateGoalInput = z.infer<typeof createGoalSchema>;

/**
 * Payload de atualização de progresso. Aceita inteiro 0-100. Não
 * permitimos floats nem strings — o cliente deve converter antes.
 *
 * Property 11 / Req 9.6: "percentual fora do intervalo 0-100" é
 * sempre inválido.
 */
export const updateProgressSchema = z.object({
  progress: z
    .number({
      error: GOAL_VALIDATION_MESSAGES.progress.required,
    })
    .int({ message: GOAL_VALIDATION_MESSAGES.progress.invalid })
    .min(GOAL_PROGRESS_MIN, {
      message: GOAL_VALIDATION_MESSAGES.progress.outOfRange,
    })
    .max(GOAL_PROGRESS_MAX, {
      message: GOAL_VALIDATION_MESSAGES.progress.outOfRange,
    }),
});

export type UpdateProgressInput = z.infer<typeof updateProgressSchema>;

/**
 * Payload de atualização combinada (Task: ajustar prazo da meta).
 *
 * Permite atualizar `progress` e/ou `deadline` em uma única chamada
 * PATCH. Ambos os campos são opcionais, mas ao menos um deve ser
 * informado (caso contrário a requisição não faz sentido).
 *
 *   - `progress` → inteiro 0-100 (mesma regra do `updateProgressSchema`).
 *   - `deadline` → ISO 8601 estritamente no futuro (reusa
 *                  `futureDateTime` — não permitimos remarcar para uma
 *                  data passada, coerente com Req 9.6).
 */
export const updateGoalSchema = z
  .object({
    progress: z
      .number({ error: GOAL_VALIDATION_MESSAGES.progress.required })
      .int({ message: GOAL_VALIDATION_MESSAGES.progress.invalid })
      .min(GOAL_PROGRESS_MIN, {
        message: GOAL_VALIDATION_MESSAGES.progress.outOfRange,
      })
      .max(GOAL_PROGRESS_MAX, {
        message: GOAL_VALIDATION_MESSAGES.progress.outOfRange,
      })
      .optional(),
    deadline: futureDateTime.optional(),
  })
  .refine((data) => data.progress !== undefined || data.deadline !== undefined, {
    message: 'Informe ao menos um campo para atualizar (progresso ou prazo).',
  });

export type UpdateGoalInput = z.infer<typeof updateGoalSchema>;

/**
 * Schema dos query params de `GET /api/goals`. Hoje aceitamos:
 *   - `type=GENERAL|AREA` → restringe à categoria selecionada.
 *   - `area=<Area>`       → restringe à área (em conjunto com a regra
 *                            de visibilidade do Req 9.7).
 *
 * Quando ambos ausentes, a rota retorna o conjunto completo permitido
 * pela visibilidade do usuário (gerais + da sua área, ou todas para
 * Diretor/Admin).
 */
export const listGoalsQuerySchema = z.object({
  type: goalTypeEnum.optional(),
  area: goalAreaEnum.optional(),
});

export type ListGoalsQueryInput = z.infer<typeof listGoalsQuerySchema>;
