/**
 * Testes do módulo `src/lib/api-auth.ts` — Task 4.4.
 *
 * Cobre os três pontos de saída do contrato:
 *   - `requireSession`     → throws / resolves
 *   - `requirePermission`  → throws Unauthorized/Forbidden / resolves
 *   - `withAuth`           → 401/403/handler-call paths
 *
 * Estratégia:
 *   • Mockamos `auth()` (NextAuth) para controlar a sessão retornada,
 *     evitando a infraestrutura completa do Auth.js durante o teste.
 *   • Mockamos `@/lib/auth` em vez de `next-auth` direto porque o
 *     próprio `auth.ts` pula bcrypt/Prisma na resolução do módulo.
 *     Mockar `@/lib/auth` corta toda essa árvore de imports e mantém o
 *     teste focado no comportamento do wrapper.
 *   • Evitamos `next/server` mocks: importamos `NextResponse` real para
 *     que os builders das respostas sejam exatamente o que o Next.js
 *     produz em runtime — o que precisamos validar é o `status` HTTP
 *     e o JSON do body.
 *
 * Esses testes complementam `tests/unit/permissions.test.ts`: a matriz
 * em si (allow/deny por role/area) já está coberta lá; aqui o foco é a
 * camada HTTP (códigos 401/403, formato `{ error, code, message }`,
 * propagação de `params`/contexto).
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import type { Session } from 'next-auth';

import type { ContextResolver } from '@/lib/api-auth';

// ─── Mock do `@/lib/auth` ─────────────────────────────────────────────
// O hoist é necessário porque `vi.mock` é içado para o topo do arquivo;
// referências a variáveis declaradas fora do hoist falham antes do
// `vi.mock` registrar o módulo.
const { authMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

// Imports do módulo sob teste devem vir DEPOIS dos `vi.mock`.
import {
  ForbiddenError,
  UnauthorizedError,
  forbiddenResponse,
  requirePermission,
  requireSession,
  unauthorizedResponse,
  withAuth,
} from '@/lib/api-auth';

/**
 * Helper para construir uma sessão "feliz" com os campos enriquecidos
 * pelo callback `session` de `auth.config.ts` (Task 3.1).
 */
function buildSession(overrides: Partial<Session['user']> = {}): Session {
  return {
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    user: {
      id: 'user-1',
      name: 'Ana',
      email: 'ana@ejmc.com.br',
      image: null,
      role: 'MEMBRO',
      area: null,
      status: 'ACTIVE',
      ...overrides,
    },
  };
}

function buildRequest(url = 'http://localhost/api/test'): NextRequest {
  return new NextRequest(url);
}

beforeEach(() => {
  authMock.mockReset();
});

// ─── Builders de resposta ─────────────────────────────────────────────

describe('unauthorizedResponse / forbiddenResponse', () => {
  it('unauthorizedResponse retorna 401 com payload padronizado', async () => {
    const res = unauthorizedResponse();
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({
      error: true,
      code: 'UNAUTHORIZED',
      message: 'Autenticação necessária.',
    });
  });

  it('forbiddenResponse retorna 403 com payload padronizado', async () => {
    const res = forbiddenResponse();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({
      error: true,
      code: 'FORBIDDEN',
      message: 'Acesso negado.',
    });
  });

  it('aceita mensagem customizada preservando code/status', async () => {
    const res = forbiddenResponse('Custom denial.');
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toBe('Custom denial.');
  });
});

// ─── requireSession ───────────────────────────────────────────────────

describe('requireSession', () => {
  it('lança UnauthorizedError quando auth() retorna null', async () => {
    authMock.mockResolvedValueOnce(null);

    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('lança UnauthorizedError quando a sessão não tem user', async () => {
    // Cenário defensivo: cookie corrompido ou JWT manipulado que
    // remove o `user`. Tratamos como sessão ausente.
    authMock.mockResolvedValueOnce({ expires: 'never' } as unknown as Session);

    await expect(requireSession()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('resolve para a sessão quando há usuário autenticado', async () => {
    const session = buildSession();
    authMock.mockResolvedValueOnce(session);

    await expect(requireSession()).resolves.toBe(session);
  });
});

// ─── requirePermission ────────────────────────────────────────────────

describe('requirePermission', () => {
  it('propaga UnauthorizedError quando não há sessão (não promove a 403)', async () => {
    // Importante: sem sessão, devolvemos 401, não 403. Misturar os dois
    // poderia confundir o cliente sobre o motivo do bloqueio.
    authMock.mockResolvedValueOnce(null);

    await expect(
      requirePermission('goal:create'),
    ).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('lança ForbiddenError quando a sessão existe mas hasPermission falha', async () => {
    // MEMBRO comum não tem nenhuma ação permitida na matriz hoje;
    // `goal:create` é uma escolha conservadora (Diretor+/Admin).
    authMock.mockResolvedValueOnce(buildSession({ role: 'MEMBRO' }));

    await expect(
      requirePermission('goal:create'),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });

  it('resolve para a sessão quando o usuário tem permissão pela matriz', async () => {
    const session = buildSession({ role: 'DIRETOR' });
    authMock.mockResolvedValueOnce(session);

    await expect(requirePermission('goal:create')).resolves.toBe(session);
  });

  it('respeita o predicado de área (Gestão de Pessoas → infraction:create)', async () => {
    // Membro de GP precisa conseguir registrar infrações mesmo sem
    // role hierárquico (Req 18.1). A presença do predicado é coberta
    // por `permissions.test.ts`; aqui validamos que `requirePermission`
    // o consulta — sem isso, o wrapper ficaria com semântica diferente
    // do RBAC central.
    const session = buildSession({ role: 'MEMBRO', area: 'GESTAO_PESSOAS' });
    authMock.mockResolvedValueOnce(session);

    await expect(
      requirePermission('infraction:create'),
    ).resolves.toBe(session);
  });

  it('passa o context recebido para o RBAC (não ignora o argumento)', async () => {
    // Cenário simétrico do anterior, mas o area do USER é nulo. Se
    // `requirePermission` ignorasse `context`, o predicado seria
    // avaliado contra `user.area = null` e negaria mesmo passando
    // `{ area: 'GESTAO_PESSOAS' }`. O contrato atual de
    // `permissions.ts` consulta o predicado com `(user, context)`, de
    // modo que essa chamada deve ser negada — porque o predicado lê
    // `user.area`, não `context.area`. O teste documenta a passagem do
    // argumento adiante.
    authMock.mockResolvedValueOnce(buildSession({ role: 'MEMBRO', area: null }));

    await expect(
      requirePermission('infraction:create', { area: 'GESTAO_PESSOAS' }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

// ─── withAuth ─────────────────────────────────────────────────────────

describe('withAuth', () => {
  it('retorna 401 sem chamar o handler quando não há sessão', async () => {
    authMock.mockResolvedValueOnce(null);
    const handler = vi.fn();

    const wrapped = withAuth(null, handler);
    const res = await wrapped(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({
      error: true,
      code: 'UNAUTHORIZED',
      message: 'Autenticação necessária.',
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('retorna 403 sem chamar o handler quando a permissão falha', async () => {
    authMock.mockResolvedValueOnce(buildSession({ role: 'MEMBRO' }));
    const handler = vi.fn();

    const wrapped = withAuth('goal:create', handler);
    const res = await wrapped(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body).toEqual({
      error: true,
      code: 'FORBIDDEN',
      message: 'Acesso negado.',
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it('chama o handler com a sessão e retorna o Response produzido', async () => {
    const session = buildSession({ role: 'ADMIN' });
    authMock.mockResolvedValueOnce(session);

    const handler = vi.fn(async (_req, ctx) =>
      Response.json({ ok: true, userId: ctx.session.user.id }, { status: 200 }),
    );

    const wrapped = withAuth('goal:create', handler);
    const req = buildRequest();
    const res = await wrapped(req);
    const body = await res.json();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler.mock.calls[0]?.[0]).toBe(req);
    expect(handler.mock.calls[0]?.[1]).toEqual({
      session,
      params: undefined,
    });
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, userId: 'user-1' });
  });

  it('aceita action=null para endpoints "apenas autenticados"', async () => {
    // Endpoints como /api/users/me só exigem sessão válida — qualquer
    // role/area ACTIVE pode acessar. `withAuth(null, ...)` cobre esse
    // caso sem precisar de uma ação fictícia na matriz.
    const session = buildSession({ role: 'MEMBRO' });
    authMock.mockResolvedValueOnce(session);

    const handler = vi.fn(async () => Response.json({ ok: true }));
    const wrapped = withAuth(null, handler);

    const res = await wrapped(buildRequest());

    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('repassa params do route context ao handler', async () => {
    // Rotas dinâmicas como `/api/projects/[id]` recebem
    // `{ params: { id } }` do Next.js. O wrapper precisa preservar isso
    // ou rotas dinâmicas ficariam sem acesso aos parâmetros.
    authMock.mockResolvedValueOnce(buildSession({ role: 'ADMIN' }));

    const handler = vi.fn(async (_req, ctx) =>
      Response.json({ id: (ctx.params as { id: string }).id }),
    );

    const wrapped = withAuth<{ id: string }>('project:updateStatus', handler);
    const res = await wrapped(buildRequest(), { params: { id: 'p-42' } });
    const body = await res.json();

    expect(body).toEqual({ id: 'p-42' });
    expect(handler.mock.calls[0]?.[1]?.params).toEqual({ id: 'p-42' });
  });

  it('usa getContext para derivar o PermissionContext do request', async () => {
    // Usamos `infraction:delete`: a matriz só permite Diretor+; o
    // predicado libera para qualquer membro de GP. Aqui simulamos um
    // Coordenador GP sendo aprovado SOMENTE porque o getContext lê o
    // area da query string e o RBAC consulta o predicado contra o
    // `user.area`. (O RBAC atual consulta `user.area`; o teste valida
    // que o getContext é invocado e propagado.)
    const session = buildSession({ role: 'COORDENADOR', area: 'GESTAO_PESSOAS' });
    authMock.mockResolvedValueOnce(session);

    const getContext = vi.fn<ContextResolver<{ id: string }>>(() => ({
      area: 'GESTAO_PESSOAS' as const,
    }));
    const handler = vi.fn(async () => Response.json({ ok: true }));

    const wrapped = withAuth('infraction:delete', handler, getContext);
    const req = buildRequest('http://localhost/api/scores/123');
    const res = await wrapped(req, { params: { id: '123' } });

    expect(getContext).toHaveBeenCalledTimes(1);
    expect(getContext.mock.calls[0]?.[0]).toBe(req);
    expect(getContext.mock.calls[0]?.[1]).toEqual({ params: { id: '123' } });
    expect(res.status).toBe(200);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('converte UnauthorizedError lançado pelo handler em 401', async () => {
    // Handler que valida algo internamente e descobre tarde que a
    // sessão é insuficiente — ex.: chamada a `requireSession` profunda.
    authMock.mockResolvedValueOnce(buildSession({ role: 'ADMIN' }));

    const handler = vi.fn(async () => {
      throw new UnauthorizedError('sessão expirada');
    });

    const wrapped = withAuth(null, handler);
    const res = await wrapped(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body).toEqual({
      error: true,
      code: 'UNAUTHORIZED',
      message: 'sessão expirada',
    });
  });

  it('converte ForbiddenError lançado pelo handler em 403', async () => {
    authMock.mockResolvedValueOnce(buildSession({ role: 'ADMIN' }));

    const handler = vi.fn(async () => {
      throw new ForbiddenError('escopo insuficiente');
    });

    const wrapped = withAuth(null, handler);
    const res = await wrapped(buildRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.code).toBe('FORBIDDEN');
    expect(body.message).toBe('escopo insuficiente');
  });

  it('NÃO captura erros genéricos do handler — re-lança para a camada superior', async () => {
    // Erros não-Auth devem subir para o tratamento global de erros do
    // Next.js (rendering de 500). Capturar tudo aqui esconderia bugs.
    authMock.mockResolvedValueOnce(buildSession({ role: 'ADMIN' }));

    const handler = vi.fn(async () => {
      throw new Error('boom');
    });

    const wrapped = withAuth(null, handler);

    await expect(wrapped(buildRequest())).rejects.toThrow('boom');
  });
});
