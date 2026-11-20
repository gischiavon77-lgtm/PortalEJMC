/**
 * Validadores do módulo de projetos (Fase 3 da reforma, estilo "Radar").
 *
 * Os projetos são enviados como multipart/form-data (por causa do banner e
 * da proposta em PDF). Os campos de texto passam por `projectFieldsSchema`;
 * os arquivos são validados pelo conteúdo em `@/lib/validators/upload`.
 *
 * Campos:
 *   - name        → 1 a 200 caracteres
 *   - ferramenta  → um dos serviços de `PROJECT_TOOLS`
 *   - description → até 2000 caracteres (pode ficar vazia)
 *   - status      → EM_ANDAMENTO | CONCLUIDO
 *   - memberIds   → ids de usuários; a rota confere que existem e estão ativos
 *   - price       → número ≥ 0 com até 2 casas (só gestão)
 *
 * Módulo isomórfico: o formulário reaproveita as constantes e mensagens.
 */

import { z } from 'zod';

/** Serviços do portfólio que podem ser a "ferramenta" de um projeto. */
export const PROJECT_TOOLS = [
  'Branding Innovation',
  'Marketing Estratégico',
  'Plano de Marketing Digital',
  'Apresentação Estratégica',
  'Pesquisa de Mercado',
  'Análise Concorrencial',
  'Análise Setorial',
  'Geomarketing',
  'Estudo de Mercado',
  'Mapeamento de Processos',
  'Mapeamento de Profissionais',
  'Plano de Salários',
  'Base de Dados',
  'Indicadores e BI',
  'Desenvolvimento Web',
  'Viabilidade de Negócios',
  'Plano de Negócios',
  'Estruturação Comercial e CRM',
  'Estruturação de Fluxo de Caixa e DRE',
  'Precificação',
  'Análise de Viabilidade Econômico-Financeira',
  'Reestruturação Financeira',
] as const;

export const PROJECT_STATUSES = ['EM_ANDAMENTO', 'CONCLUIDO'] as const;
export type ProjectStatusValue = (typeof PROJECT_STATUSES)[number];

export const PROJECT_STATUS_LABELS: Record<ProjectStatusValue, string> = {
  EM_ANDAMENTO: 'Em andamento',
  CONCLUIDO: 'Concluído',
};

export const PROJECT_NAME_MAX = 200;
export const PROJECT_DESCRIPTION_MAX = 2000;
export const PROJECT_MEMBERS_MAX = 30;

export const PROJECT_MESSAGES = {
  name: {
    required: 'Nome é obrigatório.',
    tooLong: `Nome deve ter no máximo ${PROJECT_NAME_MAX} caracteres.`,
  },
  ferramenta: { invalid: 'Escolha uma ferramenta da lista.' },
  description: {
    tooLong: `A descrição deve ter no máximo ${PROJECT_DESCRIPTION_MAX} caracteres.`,
  },
  status: { invalid: 'Status inválido.' },
  members: {
    tooMany: `A equipe pode ter no máximo ${PROJECT_MEMBERS_MAX} pessoas.`,
    invalid: 'A equipe só pode ter usuários ativos cadastrados.',
  },
  price: { invalid: 'Preço deve ser um número positivo com até 2 casas decimais.' },
} as const;

const name = z
  .string({ error: PROJECT_MESSAGES.name.required })
  .trim()
  .min(1, { message: PROJECT_MESSAGES.name.required })
  .max(PROJECT_NAME_MAX, { message: PROJECT_MESSAGES.name.tooLong });

const ferramenta = z.enum(PROJECT_TOOLS, { error: PROJECT_MESSAGES.ferramenta.invalid });

const description = z
  .string()
  .trim()
  .max(PROJECT_DESCRIPTION_MAX, { message: PROJECT_MESSAGES.description.tooLong });

const status = z.enum(PROJECT_STATUSES, { error: PROJECT_MESSAGES.status.invalid });

const memberIds = z
  .array(z.string().trim().min(1).max(64))
  .max(PROJECT_MEMBERS_MAX, { message: PROJECT_MESSAGES.members.tooMany })
  .transform((ids) => Array.from(new Set(ids)));

const price = z
  .string()
  .trim()
  .transform((v) => (v === '' ? 0 : Number(v.replace(',', '.'))))
  .refine((v) => Number.isFinite(v) && v >= 0 && Math.round(v * 100) === v * 100, {
    message: PROJECT_MESSAGES.price.invalid,
  });

/** Criação: nome e ferramenta obrigatórios; o resto tem padrão. */
export const createProjectSchema = z.object({
  name,
  ferramenta,
  description: description.default(''),
  status: status.default('EM_ANDAMENTO'),
  memberIds: memberIds.default([]),
  price: price.optional(),
});

/** Edição: todos os campos opcionais; só os enviados são alterados. */
export const updateProjectSchema = z.object({
  name: name.optional(),
  ferramenta: ferramenta.optional(),
  description: description.optional(),
  status: status.optional(),
  memberIds: memberIds.optional(),
  price: price.optional(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

/**
 * Lê os campos de texto do FormData no formato dos schemas. `memberIds`
 * chega como vários campos de mesmo nome; o campo `memberIdsSent` indica
 * que a equipe foi enviada (permite salvar equipe vazia na edição).
 * Campos ausentes ficam `undefined`.
 */
export function readProjectForm(form: FormData): Record<string, unknown> {
  const text = (key: string) => {
    const v = form.get(key);
    return typeof v === 'string' ? v : undefined;
  };
  const sentMembers = form.has('memberIds') || form.get('memberIdsSent') === '1';
  return {
    name: text('name'),
    ferramenta: text('ferramenta'),
    description: text('description'),
    status: text('status'),
    memberIds: sentMembers
      ? form.getAll('memberIds').filter((v): v is string => typeof v === 'string')
      : undefined,
    price: text('price'),
  };
}
