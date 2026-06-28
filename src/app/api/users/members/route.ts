/**
 * `GET /api/users/members?area=...` — Task 10.1 (Req 11.1, 11.2, 11.3, 11.4).
 *
 * Lista os **membros ativos** do diretório, com filtro opcional por
 * área e ordenação alfabética por nome (`name ASC`, case-insensitive).
 *
 * Cada item do payload contém os campos exibidos pela página
 * `/membros` (Task 10.2): `id`, `name`, `position` (cargo), `area` e
 * `avatarUrl` (consumido pelos cards mobile / linhas desktop).
 *
 * ─── Decisões de design ─────────────────────────────────────────────
 *
 * 1) **`status: ACTIVE` é hardcoded.** Req 11.1 fala explicitamente em
 *    "membros ativos". O endpoint não aceita `?status=` — listar
 *    contas pendentes/inativas é responsabilidade do módulo Admin
 *    (Tasks 19.1, 19.2), que terá rota e permissão próprias. Manter
 *    esse contrato fechado evita que telas operacionais "vazem"
 *    contas em estados administrativos sensíveis.
 *
 * 2) **Ordenação alfabética via `mode: 'insensitive'`.** PostgreSQL
 *    ordena por bytes por padrão; sem `mode` aplicado pelo Prisma,
 *    "Ávila" cairia depois de "Zé". Como pt-BR tem acentos comuns,
 *    usamos `orderBy` simples e deixamos a normalização final por
 *    conta de uma comparação adicional em memória usando
 *    `localeCompare(..., 'pt-BR', { sensitivity: 'base' })`. Custo
 *    irrisório (até ~80 membros, Req escala) e garante a Property
 *    13 (Task 20.14) "lista de membros ordenada alfabeticamente".
 *
 * 3) **Permissão `null` (qualquer sessão autenticada).** Req 11 não
 *    restringe o diretório de membros — qualquer usuário ACTIVE pode
 *    consultar. Usamos `withAuth(null, ...)` para reforçar apenas o
 *    gate de sessão.
 *
 * 4) **`area` opcional** (Task 10.3, Req 11.4). Sem o parâmetro a
 *    rota devolve todos os membros ativos (atalho "Todos"). Com um
 *    valor válido, restringe à área. Áreas desconhecidas geram 400
 *    via `listMembersQuerySchema` — escolha justificada no header
 *    do validador.
 *
 * 5) **Sem paginação por enquanto.** Req 11 não menciona limite por
 *    página (diferente de Comunicados/Projetos). Com 80 usuários
 *    máximos previstos no design, o payload completo (~12KB) é
 *    aceitável. Se precisar paginar no futuro, basta receber
 *    `?page` e `?pageSize`.
 *
 * ─── Formato de resposta ───────────────────────────────────────────
 *
 *   200 OK
 *   {
 *     members: Array<{
 *       id: string;
 *       name: string;
 *       area: Area | null;
 *       position: string | null;
 *       avatarUrl: string | null;
 *     }>;
 *   }
 *
 *   400 Bad Request — `?area` inválido (`code: 'VALIDATION_ERROR'`).
 *   401 Unauthorized — sem sessão (gerado por `withAuth`).
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { Area } from '@prisma/client';
import { ZodError } from 'zod';

import { withAuth } from '@/lib/api-auth';
import { prisma } from '@/lib/prisma';
import { listMembersQuerySchema } from '@/lib/validators/members';

export const runtime = 'nodejs';

interface MemberDto {
  id: string;
  name: string;
  area: Area | null;
  position: string | null;
  avatarUrl: string | null;
  role: import('@prisma/client').UserRole;
}

async function listMembersHandler(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams.entries());

  let parsed: { area?: Area };
  try {
    parsed = listMembersQuerySchema.parse(queryParams);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        {
          error: true,
          code: 'VALIDATION_ERROR',
          message: 'Parâmetros de consulta inválidos.',
          fields: err.issues.map((issue) => ({
            path: issue.path.join('.'),
            message: issue.message,
          })),
        },
        { status: 400 },
      );
    }
    throw err;
  }

  const where: { status: 'ACTIVE'; area?: Area } = { status: 'ACTIVE' };
  if (parsed.area) {
    where.area = parsed.area;
  }

  const dbMembers = await prisma.user.findMany({
    where,
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      area: true,
      position: true,
      avatarUrl: true,
      role: true,
    },
  });

  // Re-ordena com `localeCompare` em pt-BR para que nomes com acentos
  // sigam a ordem natural ("Ávila" < "Bruno" < "Zé"). O `orderBy`
  // do Prisma já entrega quase-ordenado; este pass é O(n log n) com
  // n ≤ 80, custo desprezível.
  const members: MemberDto[] = dbMembers
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
    .map((m) => ({
      id: m.id,
      name: m.name,
      area: m.area,
      position: m.position,
      avatarUrl: m.avatarUrl,
      role: m.role,
    }));

  return NextResponse.json({ members }, { status: 200 });
}

export const GET = withAuth(null, listMembersHandler);
