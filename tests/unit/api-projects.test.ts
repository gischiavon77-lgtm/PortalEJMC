// @vitest-environment node
/**
 * Testes das rotas de projetos no estilo "Radar" (Fase 3 da reforma).
 *
 *   - GET /api/projects       → listagem e números; nunca preço nem proposta
 *   - GET /api/projects/:id   → preço e proposta só para `project:write`
 *   - POST /api/projects      → permissão, validação (ferramenta, status,
 *                               equipe só de usuários ativos), banner e
 *                               proposta validados pelo conteúdo
 *   - PATCH /api/projects/:id → troca de equipe, remoção de banner
 *   - DELETE /api/projects/:id → remove banner e proposta do Storage
 *   - computeProjectStats     → números do topo
 *
 * Sessão, Prisma e Storage são simulados.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const { db } = vi.hoisted(() => ({
  db: {
    project: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    user: { findMany: vi.fn() },
  },
}));
vi.mock('@/lib/prisma', () => ({ prisma: db }));

const { storage, StorageNotConfiguredError } = vi.hoisted(() => {
  class StorageNotConfiguredError extends Error {}
  return {
    StorageNotConfiguredError,
    storage: { uploadFile: vi.fn(), downloadFile: vi.fn(), deleteFile: vi.fn() },
  };
});
vi.mock('@/lib/storage', () => ({
  StorageNotConfiguredError,
  uploadFile: (...args: unknown[]) => storage.uploadFile(...args),
  downloadFile: (...args: unknown[]) => storage.downloadFile(...args),
  deleteFile: (...args: unknown[]) => storage.deleteFile(...args),
  newStoragePath: (folder: string, extension: string) => `${folder}/novo.${extension}`,
}));

import { GET as listRoute, POST as createRoute } from '@/app/api/projects/route';
import {
  DELETE as deleteRoute,
  GET as detailRoute,
  PATCH as patchRoute,
} from '@/app/api/projects/[id]/route';
import { computeProjectStats } from '@/lib/projects';

// ─── Helpers ─────────────────────────────────────────────────────────

type Role = Session['user']['role'];
function sessionOf(role: Role, id = 'user-1'): Session {
  return {
    user: { id, role, area: 'VENDAS', status: 'ACTIVE' },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  } as Session;
}

type RouteHandler = (req: never, ctx?: never) => Promise<Response>;
function call(handler: unknown, req: Request, params?: Record<string, string>) {
  return (handler as RouteHandler)(req as never, (params ? { params } : undefined) as never);
}

function form(method: string, url: string, fields: Record<string, string | string[] | File>) {
  const body = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    if (Array.isArray(v)) v.forEach((item) => body.append(k, item));
    else body.append(k, v);
  }
  return new Request(`http://localhost${url}`, { method, body });
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const PDF = new TextEncoder().encode('%PDF-1.7\nproposta');
const HTML = new TextEncoder().encode('<html>falso</html>');

function memberRow(id: string, name: string) {
  return { user: { id, name, role: 'MEMBRO', position: null, area: 'PROJETOS', avatarPath: null } };
}

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    name: 'Projeto A',
    ferramenta: 'Indicadores e BI',
    description: 'Painel de vendas',
    status: 'EM_ANDAMENTO',
    bannerPath: 'projetos/banner.png',
    createdAt: new Date('2026-11-01T00:00:00Z'),
    updatedAt: new Date('2026-11-02T00:00:00Z'),
    members: [memberRow('u1', 'Ana'), memberRow('u2', 'Bia')],
    price: 4500,
    proposalPath: 'propostas/segredo.pdf',
    ...overrides,
  };
}

const validFields = {
  name: 'Projeto Novo',
  ferramenta: 'Indicadores e BI',
  description: 'Descrição curta',
  status: 'EM_ANDAMENTO',
};

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset();
  storage.uploadFile.mockReset().mockResolvedValue(undefined);
  storage.deleteFile.mockReset().mockResolvedValue(undefined);
  // Por padrão, todo id de equipe pedido é de usuário ativo.
  db.user.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.map((id) => ({ id })),
  );
  db.project.findUnique.mockResolvedValue(projectRow());
});

// ─── Listagem ────────────────────────────────────────────────────────

describe('GET /api/projects', () => {
  it('sem login → 401', async () => {
    authMock.mockResolvedValue(null);
    expect((await call(listRoute, new Request('http://localhost/api/projects'))).status).toBe(401);
  });

  it('nunca envia preço nem proposta, nem para Admin; traz equipe e banner', async () => {
    authMock.mockResolvedValue(sessionOf('ADMIN'));
    db.project.findMany.mockResolvedValue([projectRow()]);

    const res = await call(listRoute, new Request('http://localhost/api/projects'));
    const text = await res.text();
    const body = JSON.parse(text);

    expect(res.status).toBe(200);
    // A consulta da listagem não pede preço nem proposta ao banco.
    const select = db.project.findMany.mock.calls[0][0].select;
    expect(select.price).toBeUndefined();
    expect(select.proposalPath).toBeUndefined();

    const [project] = body.projects;
    expect(project).not.toHaveProperty('price');
    expect(project).not.toHaveProperty('hasProposal');
    expect(project).not.toHaveProperty('management');
    expect(text).not.toContain('segredo.pdf');
    expect(text).not.toContain('projetos/banner.png');
    expect(project.bannerUrl).toMatch(/^\/api\/files\/projeto\/p1\?v=/);
    expect(project.members.map((m: { name: string }) => m.name)).toEqual(['Ana', 'Bia']);
    expect(project.members[0].position).toBe('Trainee');
  });

  it('a equipe só traz usuários ativos', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));
    db.project.findMany.mockResolvedValue([]);
    await call(listRoute, new Request('http://localhost/api/projects'));
    expect(db.project.findMany.mock.calls[0][0].select.members.where).toEqual({
      user: { status: 'ACTIVE' },
    });
  });

  it('números do topo: em andamento, concluídos e pessoas distintas em andamento', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));
    db.project.findMany.mockResolvedValue([
      projectRow({ id: 'a', members: [memberRow('u1', 'Ana'), memberRow('u2', 'Bia')] }),
      projectRow({ id: 'b', members: [memberRow('u2', 'Bia'), memberRow('u3', 'Caio')] }),
      projectRow({ id: 'c', status: 'CONCLUIDO', members: [memberRow('u9', 'Zé')] }),
    ]);
    const body = await (await call(listRoute, new Request('http://localhost/api/projects'))).json();
    expect(body.stats).toEqual({ inProgress: 2, completed: 1, peopleInvolved: 3 });
  });
});

describe('computeProjectStats', () => {
  it('lista vazia → tudo zero; concluídos não contam pessoas', () => {
    expect(computeProjectStats([])).toEqual({ inProgress: 0, completed: 0, peopleInvolved: 0 });
    expect(computeProjectStats([{ status: 'CONCLUIDO', memberIds: ['a', 'b'] }])).toEqual({
      inProgress: 0,
      completed: 1,
      peopleInvolved: 0,
    });
  });
});

// ─── Detalhes ────────────────────────────────────────────────────────

describe('GET /api/projects/:id', () => {
  const req = () => new Request('http://localhost/api/projects/p1');

  it.each(['MEMBRO', 'COORDENADOR', 'GERENTE'] as const)(
    '%s vê os detalhes sem preço nem proposta',
    async (role) => {
      authMock.mockResolvedValue(sessionOf(role));
      const res = await call(detailRoute, req(), { id: 'p1' });
      const text = await res.text();
      expect(res.status).toBe(200);
      expect(JSON.parse(text).project.management).toBeNull();
      expect(text).not.toContain('4500');
      expect(text).not.toContain('segredo.pdf');
    },
  );

  it.each(['DIRETOR', 'ADMIN'] as const)('%s vê preço e se há proposta', async (role) => {
    authMock.mockResolvedValue(sessionOf(role));
    const body = await (await call(detailRoute, req(), { id: 'p1' })).json();
    expect(body.project.management).toEqual({ price: 4500, hasProposal: true });
    expect(JSON.stringify(body)).not.toContain('segredo.pdf');
  });

  it('projeto inexistente → 404', async () => {
    authMock.mockResolvedValue(sessionOf('ADMIN'));
    db.project.findUnique.mockResolvedValue(null);
    expect((await call(detailRoute, req(), { id: 'p1' })).status).toBe(404);
  });
});

// ─── Criação ─────────────────────────────────────────────────────────

describe('POST /api/projects', () => {
  beforeEach(() => {
    db.project.create.mockResolvedValue({ id: 'p1' });
  });

  it.each(['MEMBRO', 'COORDENADOR', 'GERENTE'] as const)('%s não cria → 403', async (role) => {
    authMock.mockResolvedValue(sessionOf(role));
    const res = await call(createRoute, form('POST', '/api/projects', validFields));
    expect(res.status).toBe(403);
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it('Diretor cria com equipe; ids repetidos viram um só', async () => {
    authMock.mockResolvedValue(sessionOf('DIRETOR'));
    const res = await call(
      createRoute,
      form('POST', '/api/projects', {
        ...validFields,
        memberIds: ['u1', 'u2', 'u1'],
        price: '1500,50',
      }),
    );
    expect(res.status).toBe(201);
    const data = db.project.create.mock.calls[0][0].data;
    expect(data).toMatchObject({
      name: 'Projeto Novo',
      ferramenta: 'Indicadores e BI',
      status: 'EM_ANDAMENTO',
      price: 1500.5,
      bannerPath: null,
      proposalPath: null,
    });
    expect(data.members.create).toEqual([{ userId: 'u1' }, { userId: 'u2' }]);
  });

  it('ferramenta fora da lista, status inválido ou nome vazio → 400', async () => {
    authMock.mockResolvedValue(sessionOf('ADMIN'));
    for (const bad of [
      { ...validFields, ferramenta: 'Inventada' },
      { ...validFields, status: 'CONGELADO' },
      { ...validFields, name: '   ' },
    ]) {
      const res = await call(createRoute, form('POST', '/api/projects', bad));
      expect(res.status).toBe(400);
    }
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it('equipe com usuário inativo ou inexistente → 400, nada é enviado ao Storage', async () => {
    authMock.mockResolvedValue(sessionOf('ADMIN'));
    db.user.findMany.mockResolvedValue([{ id: 'u1' }]); // só u1 está ativo
    const res = await call(
      createRoute,
      form('POST', '/api/projects', {
        ...validFields,
        memberIds: ['u1', 'desativado'],
        banner: new File([PNG], 'b.png', { type: 'image/png' }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).fields[0].path).toBe('memberIds');
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it('banner que diz ser PNG mas não é → 400', async () => {
    authMock.mockResolvedValue(sessionOf('ADMIN'));
    const res = await call(
      createRoute,
      form('POST', '/api/projects', {
        ...validFields,
        banner: new File([HTML], 'b.png', { type: 'image/png' }),
      }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_FORMAT');
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it('banner vai para projetos/ (imagens) e proposta para o bucket privado', async () => {
    authMock.mockResolvedValue(sessionOf('ADMIN'));
    const res = await call(
      createRoute,
      form('POST', '/api/projects', {
        ...validFields,
        banner: new File([PNG], 'b.png', { type: 'image/png' }),
        proposal: new File([PDF], 'p.pdf', { type: 'application/pdf' }),
      }),
    );
    expect(res.status).toBe(201);
    expect(storage.uploadFile).toHaveBeenCalledWith(
      'images',
      'projetos/novo.png',
      expect.anything(),
      'image/png',
    );
    expect(storage.uploadFile).toHaveBeenCalledWith(
      'proposals',
      'propostas/novo.pdf',
      expect.anything(),
      'application/pdf',
    );
    expect(db.project.create.mock.calls[0][0].data).toMatchObject({
      bannerPath: 'projetos/novo.png',
      proposalPath: 'propostas/novo.pdf',
    });
  });

  it('se o banco falhar, banner e proposta enviados são removidos', async () => {
    authMock.mockResolvedValue(sessionOf('ADMIN'));
    db.project.create.mockRejectedValue(new Error('falha no banco'));
    await expect(
      call(
        createRoute,
        form('POST', '/api/projects', {
          ...validFields,
          banner: new File([PNG], 'b.png', { type: 'image/png' }),
          proposal: new File([PDF], 'p.pdf', { type: 'application/pdf' }),
        }),
      ),
    ).rejects.toThrow('falha no banco');
    expect(storage.deleteFile).toHaveBeenCalledWith('images', 'projetos/novo.png');
    expect(storage.deleteFile).toHaveBeenCalledWith('proposals', 'propostas/novo.pdf');
  });
});

// ─── Edição ──────────────────────────────────────────────────────────

describe('PATCH /api/projects/:id', () => {
  beforeEach(() => {
    db.project.update.mockResolvedValue({ id: 'p1' });
  });

  it('MEMBRO não edita → 403', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));
    const res = await call(patchRoute, form('PATCH', '/api/projects/p1', { status: 'CONCLUIDO' }), {
      id: 'p1',
    });
    expect(res.status).toBe(403);
  });

  it('troca a equipe inteira e o status', async () => {
    authMock.mockResolvedValue(sessionOf('DIRETOR'));
    const res = await call(
      patchRoute,
      form('PATCH', '/api/projects/p1', { status: 'CONCLUIDO', memberIds: ['u3'] }),
      { id: 'p1' },
    );
    expect(res.status).toBe(200);
    const data = db.project.update.mock.calls[0][0].data;
    expect(data.status).toBe('CONCLUIDO');
    expect(data.members).toEqual({ deleteMany: {}, create: [{ userId: 'u3' }] });
  });

  it('equipe vazia é aceita quando enviada explicitamente', async () => {
    authMock.mockResolvedValue(sessionOf('DIRETOR'));
    await call(patchRoute, form('PATCH', '/api/projects/p1', { memberIdsSent: '1' }), { id: 'p1' });
    expect(db.project.update.mock.calls[0][0].data.members).toEqual({ deleteMany: {}, create: [] });
  });

  it('removeBanner tira o banner e apaga o arquivo antigo', async () => {
    authMock.mockResolvedValue(sessionOf('ADMIN'));
    const res = await call(patchRoute, form('PATCH', '/api/projects/p1', { removeBanner: '1' }), {
      id: 'p1',
    });
    expect(res.status).toBe(200);
    expect(db.project.update.mock.calls[0][0].data.bannerPath).toBeNull();
    expect(storage.deleteFile).toHaveBeenCalledWith('images', 'projetos/banner.png');
  });

  it('banner novo substitui o antigo, que sai do Storage', async () => {
    authMock.mockResolvedValue(sessionOf('ADMIN'));
    await call(
      patchRoute,
      form('PATCH', '/api/projects/p1', {
        banner: new File([PNG], 'b.png', { type: 'image/png' }),
      }),
      { id: 'p1' },
    );
    expect(db.project.update.mock.calls[0][0].data.bannerPath).toBe('projetos/novo.png');
    expect(storage.deleteFile).toHaveBeenCalledWith('images', 'projetos/banner.png');
  });
});

// ─── Exclusão ────────────────────────────────────────────────────────

describe('DELETE /api/projects/:id', () => {
  const del = () => new Request('http://localhost/api/projects/p1', { method: 'DELETE' });

  it('Admin exclui; banner e proposta saem do Storage', async () => {
    authMock.mockResolvedValue(sessionOf('ADMIN'));
    db.project.delete.mockResolvedValue({});
    const res = await call(deleteRoute, del(), { id: 'p1' });
    expect(res.status).toBe(200);
    expect(storage.deleteFile).toHaveBeenCalledWith('images', 'projetos/banner.png');
    expect(storage.deleteFile).toHaveBeenCalledWith('proposals', 'propostas/segredo.pdf');
  });

  it('GERENTE não exclui → 403', async () => {
    authMock.mockResolvedValue(sessionOf('GERENTE'));
    expect((await call(deleteRoute, del(), { id: 'p1' })).status).toBe(403);
    expect(db.project.delete).not.toHaveBeenCalled();
  });
});
