/**
 * Validadores Zod para o módulo KPIs — Task 9.2.
 *
 * Cobrem os payloads de:
 *   - `POST   /api/kpis`             → `createKpiSchema` (Admin, Req 10.5)
 *   - `POST   /api/kpis/:id/values`  → `createKpiValueSchema` (Req 10.2)
 *   - `GET    /api/kpis?area=...`    → `listKpisQuerySchema`
 *
 * Regras (Req 10.2, 10.3, 10.5 / Property correspondente):
 *
 *   - `name`        → 1–60 caracteres (após `trim`).
 *   - `unit`        → enum `KpiUnit` (PERCENTAGE | INTEGER | DECIMAL).
 *   - `area`        → enum `Area` ou `null` (KPI global).
 *   - `intervalMin` → opcional, número.
 *   - `intervalMax` → opcional, número; quando ambos definidos, `min ≤ max`.
 *   - `value`       → numérico, máx. 2 casas decimais (Req 10.2),
 *                     respeitando `unit` (PERCENTAGE: 0..100; INTEGER:
 *                     inteiro) e o intervalo `[intervalMin, intervalMax]`
 *                     do KPI quando definido.
 *
 * ─── Por que validar `value` em duas etapas? ────────────────────────
 *
 * O schema base (`createKpiValueSchema`) só consegue checar regras
 * universais — número finito, casas decimais. Restrições dependentes
 * do KPI (unidade, intervalo) só fazem sentido com o KPI já carregado
 * do banco. Por isso expomos uma função auxiliar
 * `validateValueAgainstKpi(value, kpi)` que encapsula essas regras
 * e retorna o conjunto de erros estruturados — a rota chama esta
 * função após o `parse` do schema, gerando uma resposta unificada
 * 400 com `fields` (mesmo formato dos demais validadores do portal).
 *
 * ─── Decimal precision ─────────────────────────────────────────────
 *
 * O schema Prisma persiste `KpiValue.value` como `Decimal(10,2)` —
 * 10 dígitos no total, 2 após o ponto. O schema Zod restringe a
 * "no máximo 2 casas decimais" (Req 10.2) e até 8 dígitos antes do
 * ponto (faixa abundante para qualquer KPI realista; valores
 * absurdos como 10^9 são rejeitados antes de baterem no Postgres).
 */

import { z } from 'zod';

// ─── Constantes de validação ─────────────────────────────────────────

export const KPI_NAME_MIN_LENGTH = 1;
export const KPI_NAME_MAX_LENGTH = 60;

/** Valor absoluto máximo permitido para `value` (10^8 - 0.01). */
export const KPI_VALUE_ABS_MAX = 99999999.99;

/**
 * Conjunto fechado de áreas — espelha o enum `Area` do Prisma. Manter
 * como literal array permite gerar union tipado sem importar runtime
 * do `@prisma/client` aqui (usável em testes/UI client sem Prisma).
 */
export const KPI_AREAS = [
  'VENDAS',
  'PRESIDENCIA',
  'PROJETOS',
  'MARKETING',
  'GESTAO_PESSOAS',
  'ADM_FIN',
] as const;

/** Conjunto fechado de unidades — espelha o enum `KpiUnit`. */
export const KPI_UNITS = ['PERCENTAGE', 'INTEGER', 'DECIMAL'] as const;

export const KPI_VALIDATION_MESSAGES = {
  name: {
    required: 'O nome do KPI é obrigatório.',
    tooShort: 'O nome do KPI não pode ser vazio.',
    tooLong: `O nome deve ter no máximo ${KPI_NAME_MAX_LENGTH} caracteres.`,
  },
  unit: {
    required: 'A unidade de medida é obrigatória.',
    invalid: 'Unidade de medida inválida.',
  },
  area: {
    invalid: 'Área inválida.',
  },
  interval: {
    invalidNumber: 'Limite do intervalo deve ser um número.',
    minGreaterThanMax:
      'O limite mínimo do intervalo deve ser menor ou igual ao máximo.',
  },
  value: {
    required: 'O valor é obrigatório.',
    invalid: 'Informe um número válido.',
    tooManyDecimals: 'O valor deve ter no máximo 2 casas decimais.',
    outOfRange: 'O valor está fora do intervalo permitido.',
    notInteger: 'Este KPI exige um número inteiro.',
    notPercentage: 'KPIs em percentual devem estar entre 0 e 100.',
    tooLarge: 'O valor é grande demais para ser registrado.',
  },
} as const;

// ─── Helpers ─────────────────────────────────────────────────────────

const kpiUnitEnum = z.enum(KPI_UNITS, {
  error: KPI_VALIDATION_MESSAGES.unit.invalid,
});

const kpiAreaEnum = z.enum(KPI_AREAS, {
  error: KPI_VALIDATION_MESSAGES.area.invalid,
});

/**
 * Valida que um número tem **no máximo** 2 casas decimais. Implementado
 * por arredondamento: se `Math.round(v*100)/100 === v`, então o valor
 * cabe em 2 casas. Tolerante a representações IEEE-754 imperfeitas
 * (ex.: 0.1 + 0.2) através do `Number.EPSILON` aplicado pelo
 * arredondamento — que é equivalente, na prática, a "trim" das casas
 * adicionais quando o ruído é < 10^-9.
 */
function hasAtMostTwoDecimals(value: number): boolean {
  if (!Number.isFinite(value)) return false;
  const rounded = Math.round(value * 100) / 100;
  // Diferença minúscula é tolerada (ruído IEEE-754); diferenças >
  // 10^-9 indicam casas decimais reais.
  return Math.abs(rounded - value) < 1e-9;
}

// ─── Schemas ─────────────────────────────────────────────────────────

/**
 * Schema base de criação de KPI (Admin — Req 10.5).
 *
 * `area` é opcional/nullable: omitido ou `null` cria um KPI global,
 * coerente com o schema Prisma (`area Area?`). Os limites
 * `intervalMin` / `intervalMax` ficam opcionais e, quando ambos
 * definidos, exigimos `min ≤ max` via `superRefine` para emitir o
 * erro no caminho do campo certo.
 */
export const createKpiSchema = z
  .object({
    name: z
      .string({ error: KPI_VALIDATION_MESSAGES.name.required })
      .trim()
      .min(KPI_NAME_MIN_LENGTH, {
        message: KPI_VALIDATION_MESSAGES.name.tooShort,
      })
      .max(KPI_NAME_MAX_LENGTH, {
        message: KPI_VALIDATION_MESSAGES.name.tooLong,
      }),
    unit: kpiUnitEnum,
    /**
     * Aceita o enum, ou explicitamente `null` para KPIs globais.
     * Note: no body JSON, omissão também é válida — preprocessamos
     * `undefined` como `null` no `transform` para uniformizar.
     */
    area: kpiAreaEnum.nullable().optional(),
    intervalMin: z
      .number({ error: KPI_VALIDATION_MESSAGES.interval.invalidNumber })
      .finite({ message: KPI_VALIDATION_MESSAGES.interval.invalidNumber })
      .optional(),
    intervalMax: z
      .number({ error: KPI_VALIDATION_MESSAGES.interval.invalidNumber })
      .finite({ message: KPI_VALIDATION_MESSAGES.interval.invalidNumber })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      typeof data.intervalMin === 'number' &&
      typeof data.intervalMax === 'number' &&
      data.intervalMin > data.intervalMax
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['intervalMin'],
        message: KPI_VALIDATION_MESSAGES.interval.minGreaterThanMax,
      });
    }
  })
  .transform((data) => ({
    ...data,
    area: data.area ?? null,
  }));

export type CreateKpiInput = z.infer<typeof createKpiSchema>;

/**
 * Schema de inserção de valor de KPI (Req 10.2).
 *
 * Restrição universal aqui: número finito com até 2 casas decimais e
 * dentro de um range razoável. As restrições por KPI (unidade,
 * intervalo) são aplicadas pela função `validateValueAgainstKpi`
 * abaixo, que é invocada pela rota após resolver o KPI alvo.
 */
export const createKpiValueSchema = z.object({
  value: z
    .number({ error: KPI_VALIDATION_MESSAGES.value.required })
    .finite({ message: KPI_VALIDATION_MESSAGES.value.invalid })
    .refine((v) => Math.abs(v) <= KPI_VALUE_ABS_MAX, {
      message: KPI_VALIDATION_MESSAGES.value.tooLarge,
    })
    .refine((v) => hasAtMostTwoDecimals(v), {
      message: KPI_VALIDATION_MESSAGES.value.tooManyDecimals,
    }),
});

export type CreateKpiValueInput = z.infer<typeof createKpiValueSchema>;

/**
 * Schema dos query params de `GET /api/kpis`. Hoje aceitamos:
 *   - `area=<Area>`  → restringe à área (em conjunto com regra de
 *                      visibilidade aplicada pela rota).
 *   - `area=GLOBAL`  → atalho para "apenas KPIs sem área".
 *
 * Quando ausente, a rota retorna o conjunto completo permitido pela
 * sessão (todos os KPIs visíveis ao usuário).
 */
export const listKpisQuerySchema = z.object({
  area: z
    .union([kpiAreaEnum, z.literal('GLOBAL')])
    .optional(),
});

export type ListKpisQueryInput = z.infer<typeof listKpisQuerySchema>;

// ─── Validação cruzada (KPI + valor) ─────────────────────────────────

/**
 * Forma mínima do KPI consumida por `validateValueAgainstKpi`. Inclui
 * apenas os campos necessários para impor unidade e intervalo —
 * mantemos um shape estrutural para que tanto registros do Prisma
 * quanto DTOs serializados possam ser passados.
 */
export interface KpiValidationShape {
  unit: 'PERCENTAGE' | 'INTEGER' | 'DECIMAL';
  intervalMin: number | null;
  intervalMax: number | null;
}

/**
 * Erro estruturado retornado por `validateValueAgainstKpi`. Segue o
 * mesmo formato `{ path, message }` usado pelo serializador de
 * `ZodError` em todas as rotas do portal.
 */
export interface KpiValueValidationError {
  path: string;
  message: string;
}

/**
 * Aplica as regras dependentes do KPI sobre `value`:
 *
 *   - `INTEGER`    → exige `Number.isInteger(value)`.
 *   - `PERCENTAGE` → 0 ≤ value ≤ 100 (sem mais regras de unidade — o
 *                    intervalo customizado, se definido, ainda
 *                    refina).
 *   - intervalo custom → quando o KPI define `intervalMin`/`intervalMax`,
 *                        o valor deve estar dentro de `[min, max]`
 *                        (inclusive). A configuração com apenas um
 *                        dos limites também é respeitada.
 *
 * Retorna a lista de erros encontrados (vazia quando o valor é
 * válido). A rota concatena com os erros do schema base e devolve
 * 400 quando há qualquer item.
 */
export function validateValueAgainstKpi(
  value: number,
  kpi: KpiValidationShape,
): KpiValueValidationError[] {
  const errors: KpiValueValidationError[] = [];

  if (kpi.unit === 'INTEGER' && !Number.isInteger(value)) {
    errors.push({
      path: 'value',
      message: KPI_VALIDATION_MESSAGES.value.notInteger,
    });
  }

  if (kpi.unit === 'PERCENTAGE' && (value < 0 || value > 100)) {
    errors.push({
      path: 'value',
      message: KPI_VALIDATION_MESSAGES.value.notPercentage,
    });
  }

  if (typeof kpi.intervalMin === 'number' && value < kpi.intervalMin) {
    errors.push({
      path: 'value',
      message: KPI_VALIDATION_MESSAGES.value.outOfRange,
    });
  }

  if (typeof kpi.intervalMax === 'number' && value > kpi.intervalMax) {
    errors.push({
      path: 'value',
      message: KPI_VALIDATION_MESSAGES.value.outOfRange,
    });
  }

  return errors;
}
