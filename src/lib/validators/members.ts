/**
 * Validadores Zod para o módulo Membros — Task 10.1.
 *
 * Cobre os query params de:
 *   - `GET /api/users/members?area=...`
 *
 * Regras (Req 11.4):
 *   - `area` opcional. Quando presente deve ser um valor do enum `Area`
 *     do Prisma (`VENDAS | PRESIDENCIA | PROJETOS | MARKETING |
 *     GESTAO_PESSOAS | ADM_FIN`) — o atalho "Todos" da UI é
 *     representado pela ausência do parâmetro, não por um literal.
 *
 * ─── Por que rejeitar `area` desconhecidas em vez de ignorar? ────────
 *
 * Aceitar silenciosamente um `?area=INVALIDA` e devolver a lista
 * completa esconde bugs no client (filtro montado errado) e
 * complica testes. Preferimos resposta 400 explícita: o consumidor
 * deve enviar uma área válida ou omitir o parâmetro. O dropdown
 * controlado pelo `MembrosShell` só consegue gerar valores válidos,
 * então essa regra não impacta o fluxo normal.
 */

import { z } from 'zod';

import { KPI_AREAS } from './kpi';

export const MEMBER_VALIDATION_MESSAGES = {
  area: {
    invalid:
      'Área inválida. Selecione uma das áreas cadastradas ou remova o filtro.',
  },
} as const;

const memberAreaEnum = z.enum(KPI_AREAS, {
  error: MEMBER_VALIDATION_MESSAGES.area.invalid,
});

/**
 * Schema dos query params de `GET /api/users/members`.
 *
 * `area` é opcional; quando ausente, a API devolve todos os membros
 * ativos (representação do "Todos" do dropdown — Task 10.3 / Req 11.4).
 */
export const listMembersQuerySchema = z.object({
  area: memberAreaEnum.optional(),
});

export type ListMembersQueryInput = z.infer<typeof listMembersQuerySchema>;
