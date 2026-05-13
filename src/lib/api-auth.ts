/**
 * Helpers de autenticação/autorização para API Routes (Task 4.4).
 *
 * Este módulo é o **complemento server-side** do RBAC central
 * (`@/lib/permissions`). Enquanto o middleware Next.js (Task 4.3) age
 * na borda do request — bloqueia/redireciona acessos a páginas privadas
 * antes mesmo de chegar ao route handler — as próprias API Routes ainda
 * precisam de uma checagem que:
 *
 *   1. Recupere a `Session` autenticada via `auth()` (NextAuth v5).
 *   2. Aplique a matriz de permissões com `hasPermission(user, action, ctx)`.
 *   3. Retorne respostas HTTP padronizadas (`401 UNAUTHORIZED` /
 *      `403 FORBIDDEN`) usando o formato `{ error, code, message }`
 *      definido em `design.md → Tratamento de Erros`.
 *
 * O middleware roda no Edge Runtime e não pode tocar no Prisma, por
 * isso ele só faz o gate "tem sessão? é admin?". A imposição da
 * permissão fina por ação (ex.: `goal:create`, `infraction:delete`,
 * `service:write`) é responsabilidade das próprias APIs — esta camada
 * é a que cumpre `Req 5.2/5.3` ("ações sensíveis exigem checagem
 * server-side") em todos os endpoints de mutação dos módulos 6–19.
 *
 * ─── API exposta ──────────────────────────────────────────────────────
 *
 *   • `requireSession()`        → Promise<Session>; lança
 *                                  `UnauthorizedError` se não houver
 *                                  sessão.
 *   • `requirePermission(action, ctx?)` → Promise<Session>; resolve
 *                                  para a sessão autenticada quando o
 *                                  usuário tem permissão. Lança
 *                                  `UnauthorizedError` se não houver
 *                                  sessão e `ForbiddenError` se
 *                                  `hasPermission` falhar.
 *   • `withAuth(action, handler, getContext?)` → wrapper para handlers
 *                                  do estilo `(req, { session, params }) => Response`.
 *                                  Retorna 401/403 antes de chamar o
 *                                  handler quando aplicável.
 *   • `unauthorizedResponse()` / `forbiddenResponse()` → builders das
 *                                  respostas JSON padronizadas (úteis
 *                                  em handlers que não usam `withAuth`).
 *
 * ─── Decisões de design ──────────────────────────────────────────────
 *
 * 1) **Throw + catch como contrato interno.**
 *    `requireSession`/`requirePermission` lançam erros tipados em vez
 *    de devolver discriminated unions. Isso permite que código de
 *    domínio dentro de um handler escreva:
 *
 *        const session = await requireSession();
 *        // ... lógica feliz, sem `if (result.ok)` em cada chamada.
 *
 *    O `withAuth` faz o catch dos dois tipos e converte em 401/403,
 *    de modo que mesmo handlers que chamam manualmente
 *    `requirePermission` em pontos profundos da pilha herdam o mesmo
 *    formato de erro (sem repetir o try/catch em cada rota).
 *
 *    Erros não-`UnauthorizedError`/`ForbiddenError` são re-lançados —
 *    o objetivo aqui é só centralizar autenticação/autorização, não
 *    capturar qualquer erro do handler (isso seria responsabilidade
 *    de um middleware de logging/observabilidade global, fora do
 *    escopo desta task).
 *
 * 2) **Formato de erro idêntico ao do `register`/middleware.**
 *    `{ error: true, code: 'UNAUTHORIZED' | 'FORBIDDEN', message }`.
 *    Os códigos batem com o `ErrorCode` central documentado em
 *    `design.md`. Mensagens são genéricas e não revelam qual ação ou
 *    recurso o usuário tentou acessar (Property 7 / Req 5.2):
 *      - 401: "Autenticação necessária."
 *      - 403: "Acesso negado."
 *
 * 3) **`getContext` para permissões dependentes do request.**
 *    A matriz de permissões aceita um `PermissionContext` (hoje só
 *    `area` é consumido, ver `permissions.ts`). Algumas ações futuras
 *    precisarão derivar o contexto do request — por exemplo, "permitir
 *    se o `area` do recurso == `area` do usuário" (Req 9.3 — metas por
 *    área). Para isso, `withAuth` aceita uma função opcional
 *    `getContext(req, routeContext)` que constrói o contexto a partir
 *    do `searchParams` ou de `params` da rota. Mantemos `getContext`
 *    opcional para que rotas simples não precisem se preocupar com ele.
 *
 * 4) **`action: Action | null` permite "só sessão".**
 *    Embora a Task 4.4 fale em permissão, vários endpoints autenticados
 *    do portal (perfil, mural de comunicados, listagem de membros)
 *    precisam apenas de sessão válida — qualquer usuário ACTIVE pode
 *    consumi-los. Passar `null` no lugar da ação faz o `withAuth`
 *    pular a checagem de permissão, mantendo somente a guarda 401.
 *    Isso evita criar um segundo wrapper (`withSession`) só para esse
 *    caso, sem comprometer a clareza do call-site.
 *
 * 5) **Tipagem do handler segue o padrão do Next.js App Router.**
 *    No App Router, route handlers são chamados como
 *    `(req: NextRequest, context: { params: ... })`. O wrapper repassa
 *    o `context` recebido do Next, e o handler interno recebe
 *    `{ session, params }`. Assim, rotas como `/api/projects/:id`
 *    ainda têm acesso ao `params.id` sem precisar reler os args.
 */

import { NextResponse, type NextRequest } from 'next/server';
import type { Session } from 'next-auth';

import { auth } from '@/lib/auth';
import {
  hasPermission,
  type Action,
  type PermissionContext,
} from '@/lib/permissions';

/**
 * Lançado por `requireSession`/`requirePermission` quando o request
 * não tem sessão autenticada. Capturado por `withAuth` e convertido em
 * Response 401. Pode também ser usado manualmente por handlers
 * customizados (ex.: validação que descobre só no meio da pilha que a
 * sessão é insuficiente).
 */
export class UnauthorizedError extends Error {
  /** Código consumido pelo cliente (mapeado a partir do design.md). */
  readonly code = 'UNAUTHORIZED' as const;
  constructor(message = 'Autenticação necessária.') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/**
 * Lançado por `requirePermission` quando há sessão mas
 * `hasPermission(user, action, ctx)` retorna `false`. Capturado por
 * `withAuth` e convertido em Response 403.
 */
export class ForbiddenError extends Error {
  readonly code = 'FORBIDDEN' as const;
  constructor(message = 'Acesso negado.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

/**
 * Constrói a resposta 401 JSON no formato unificado do design.
 * Exportada para handlers que preferem o estilo retorno-direto em vez
 * do throw — a forma do payload é a mesma usada por `withAuth`.
 */
export function unauthorizedResponse(
  message = 'Autenticação necessária.',
): NextResponse {
  return NextResponse.json(
    { error: true, code: 'UNAUTHORIZED', message },
    { status: 401 },
  );
}

/**
 * Constrói a resposta 403 JSON no formato unificado do design.
 */
export function forbiddenResponse(
  message = 'Acesso negado.',
): NextResponse {
  return NextResponse.json(
    { error: true, code: 'FORBIDDEN', message },
    { status: 403 },
  );
}

/**
 * Garante que o request atual tem sessão autenticada e devolve a
 * `Session` enriquecida (id/role/area/status — Task 3.1).
 *
 * Usa o singleton `auth()` exportado por `@/lib/auth`, que já aplica o
 * guard de inatividade de 8h via callback `jwt` (Task 3.4). Em
 * cenários onde `auth()` retorna `null` (sem cookie, cookie expirado,
 * JWT inválido), lançamos `UnauthorizedError`.
 */
export async function requireSession(): Promise<Session> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError();
  }
  return session;
}

/**
 * Versão "com permissão" de `requireSession`. Recupera a sessão e
 * delega a decisão de autorização ao RBAC central.
 *
 * - Lança `UnauthorizedError` (→ 401) se não houver sessão.
 * - Lança `ForbiddenError`     (→ 403) se a sessão existe mas
 *   `hasPermission(user, action, context)` retorna `false`.
 *
 * Resolve para a `Session` quando o usuário pode prosseguir,
 * permitindo que o chamador use `session.user.id`, `session.user.role`,
 * etc. logo em seguida.
 */
export async function requirePermission(
  action: Action,
  context?: PermissionContext,
): Promise<Session> {
  const session = await requireSession();
  if (!hasPermission(session.user, action, context)) {
    throw new ForbiddenError();
  }
  return session;
}

/**
 * Forma do segundo argumento que o handler interno do `withAuth`
 * recebe. Repassamos `params` quando o Next informa (rotas dinâmicas
 * tipo `/api/projects/[id]/route.ts`).
 */
export interface AuthHandlerContext<P = unknown> {
  session: Session;
  params?: P;
}

/**
 * Tipo do handler que `withAuth` envolve. Mantido genérico em `P` para
 * que rotas dinâmicas tipem o `params` da forma esperada pelo Next.js.
 */
export type AuthenticatedHandler<P = unknown> = (
  req: NextRequest,
  ctx: AuthHandlerContext<P>,
) => Response | Promise<Response>;

/**
 * Forma do `routeContext` que o Next.js passa para o handler. No App
 * Router, a assinatura é `(req, { params })` — `params` pode ser
 * `undefined` em rotas estáticas e é uma `Promise<Record<...>>` em
 * Next 15+, mas mantemos genérico para não acoplar a uma versão.
 */
export interface NextRouteContext<P = unknown> {
  params?: P;
}

/**
 * Função opcional que extrai um `PermissionContext` a partir do
 * request e do `routeContext`. Útil quando a permissão depende de
 * dados da URL (ex.: `?area=VENDAS`) ou de parâmetros de rota
 * (`/api/areas/:area/...`). Pode ser síncrona ou retornar uma Promise
 * — útil quando o contexto exige uma consulta auxiliar (mas evite I/O
 * pesado aqui; prefira fazer dentro do handler com `requirePermission`).
 */
export type ContextResolver<P = unknown> = (
  req: NextRequest,
  routeContext: NextRouteContext<P>,
) => PermissionContext | undefined | Promise<PermissionContext | undefined>;

/**
 * Higher-order function que protege um route handler com checagens de
 * autenticação e autorização.
 *
 * Comportamento:
 *   1. Resolve a sessão via `auth()`. Sem sessão → 401.
 *   2. Se `action !== null`, resolve o `PermissionContext` (via
 *      `getContext`, se fornecido) e chama `hasPermission`. Falha → 403.
 *   3. Caso aprovado, chama o handler com `(req, { session, params })`.
 *   4. Captura `UnauthorizedError`/`ForbiddenError` lançados pelo
 *      handler ou por chamadas internas a `requireSession`/
 *      `requirePermission`, convertendo-os no Response 401/403 padrão.
 *
 * Permitir `action = null` deixa o wrapper utilizável em endpoints
 * "qualquer usuário autenticado pode consumir" sem precisar criar um
 * `withSession` separado — ver decisão 4 no cabeçalho do módulo.
 */
export function withAuth<P = unknown>(
  action: Action | null,
  handler: AuthenticatedHandler<P>,
  getContext?: ContextResolver<P>,
): (
  req: NextRequest,
  routeContext?: NextRouteContext<P>,
) => Promise<Response> {
  return async (req, routeContext) => {
    const ctx: NextRouteContext<P> = routeContext ?? {};

    try {
      const session = await auth();
      if (!session?.user) {
        return unauthorizedResponse();
      }

      if (action !== null) {
        const permissionContext = getContext
          ? await getContext(req, ctx)
          : undefined;
        if (!hasPermission(session.user, action, permissionContext)) {
          return forbiddenResponse();
        }
      }

      return await handler(req, { session, params: ctx.params });
    } catch (err) {
      // Erros explícitos do nosso contrato → respostas HTTP padronizadas.
      if (err instanceof UnauthorizedError) {
        return unauthorizedResponse(err.message);
      }
      if (err instanceof ForbiddenError) {
        return forbiddenResponse(err.message);
      }
      // Qualquer outro erro é responsabilidade do handler / camada de
      // observabilidade global. Re-lançamos para preservar stack trace.
      throw err;
    }
  };
}
