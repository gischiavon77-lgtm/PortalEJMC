// @vitest-environment node
/**
 * Testes das rotas do feed da página inicial (Fase 2 da reforma).
 *
 *   - GET  /api/posts            → paginação por cursor, formato público
 *   - POST /api/posts            → permissão post:create, validação de
 *                                  texto e de imagem (pelo conteúdo)
 *   - DELETE /api/posts/:id      → autor, Diretor e Admin podem; outros não
 *   - POST/DELETE /api/posts/:id/like → curtir/descurtir idempotentes
 *
 * Sessão, Prisma e Storage são simulados; nenhum banco ou Storage real.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';

const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => authMock(...args) }));

const { db } = vi.hoisted(() => ({
  db: {
    post: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
    postLike: { upsert: vi.fn(), deleteMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
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
  newStoragePath: (folder: string, extension: string) => `${folder}/novo-arquivo.${extension}`,
}));

import { GET as listRoute, POST as createRoute } from '@/app/api/posts/route';
import { DELETE as deleteRoute } from '@/app/api/posts/[id]/route';
import { DELETE as unlikeRoute, POST as likeRoute } from '@/app/api/posts/[id]/like/route';

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

function formRequest(fields: Record<string, string | File>): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return new Request('http://localhost/api/posts', { method: 'POST', body: form });
}

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const HTML = new TextEncoder().encode('<html>nao sou imagem</html>');

function postRow(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    content: `Publicação ${id}`,
    imagePath: null,
    createdAt: new Date('2026-11-20T12:00:00Z'),
    author: {
      id: 'autor-1',
      name: 'Ana Souza',
      role: 'COORDENADOR',
      position: 'Coordenadora de Vendas',
      area: 'VENDAS',
      avatarPath: null,
    },
    _count: { likes: 2 },
    likes: [],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  for (const model of Object.values(db)) for (const fn of Object.values(model)) fn.mockReset();
  storage.uploadFile.mockReset().mockResolvedValue(undefined);
  storage.deleteFile.mockReset().mockResolvedValue(undefined);
});

// ─── GET /api/posts ──────────────────────────────────────────────────

describe('GET /api/posts', () => {
  it('sem login → 401', async () => {
    authMock.mockResolvedValue(null);
    const res = await call(listRoute, new Request('http://localhost/api/posts'));
    expect(res.status).toBe(401);
  });

  it('devolve a página e o cursor da próxima quando há mais publicações', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO', 'leitor'));
    // limit=2 → a rota pede 3; a sobra indica que há próxima página.
    db.post.findMany.mockResolvedValue([postRow('p3'), postRow('p2'), postRow('p1')]);

    const res = await call(listRoute, new Request('http://localhost/api/posts?limit=2'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.posts.map((p: { id: string }) => p.id)).toEqual(['p3', 'p2']);
    expect(body.nextCursor).toBe('p2');
    expect(db.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 3,
      }),
    );
  });

  it('última página → nextCursor null; cursor é repassado ao banco', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO', 'leitor'));
    db.post.findUnique.mockResolvedValue({ id: 'p2' });
    db.post.findMany.mockResolvedValue([postRow('p1')]);

    const res = await call(listRoute, new Request('http://localhost/api/posts?cursor=p2'));
    const body = await res.json();

    expect(body.nextCursor).toBeNull();
    expect(db.post.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: 'p2' }, skip: 1 }),
    );
  });

  it('formato público: autor com cargo e área, curtidas e sem caminho do Storage', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO', 'leitor'));
    db.post.findMany.mockResolvedValue([
      postRow('p1', { imagePath: 'posts/segredo.png', likes: [{ userId: 'leitor' }] }),
    ]);

    const res = await call(listRoute, new Request('http://localhost/api/posts'));
    const text = await res.text();
    const [post] = JSON.parse(text).posts;

    expect(post.author).toMatchObject({
      name: 'Ana Souza',
      position: 'Coordenadora de Vendas',
      area: 'VENDAS',
    });
    expect(post.likeCount).toBe(2);
    expect(post.likedByMe).toBe(true);
    expect(post.imageUrl).toMatch(/^\/api\/files\/post\/p1\?v=/);
    expect(text).not.toContain('posts/segredo.png');
    // Membro comum vendo publicação de outra pessoa não pode apagar.
    expect(post.canDelete).toBe(false);
  });

  it('cursor de publicação apagada → 400 para o cliente recomeçar', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));
    db.post.findUnique.mockResolvedValue(null);

    const res = await call(listRoute, new Request('http://localhost/api/posts?cursor=sumiu'));
    expect(res.status).toBe(400);
    expect(db.post.findMany).not.toHaveBeenCalled();
  });
});

// ─── POST /api/posts ─────────────────────────────────────────────────

describe('POST /api/posts', () => {
  beforeEach(() => {
    db.post.create.mockResolvedValue({ id: 'novo' });
    db.post.findUnique.mockImplementation(async () => postRow('novo'));
  });

  it('MEMBRO não pode publicar → 403, nada é criado', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));
    const res = await call(createRoute, formRequest({ content: 'Olá' }));
    expect(res.status).toBe(403);
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it.each(['COORDENADOR', 'GERENTE', 'DIRETOR', 'ADMIN'] as const)(
    '%s pode publicar só com texto',
    async (role) => {
      authMock.mockResolvedValue(sessionOf(role, 'autor-1'));
      const res = await call(createRoute, formRequest({ content: '  Bom dia, EJMC!  ' }));
      expect(res.status).toBe(201);
      expect(db.post.create).toHaveBeenCalledWith({
        data: { content: 'Bom dia, EJMC!', imagePath: null, authorId: 'autor-1' },
        select: { id: true },
      });
      expect(storage.uploadFile).not.toHaveBeenCalled();
    },
  );

  it('texto vazio ou acima de 2000 caracteres → 400', async () => {
    authMock.mockResolvedValue(sessionOf('COORDENADOR'));
    const vazio = await call(createRoute, formRequest({ content: '   ' }));
    const longo = await call(createRoute, formRequest({ content: 'a'.repeat(2001) }));
    expect(vazio.status).toBe(400);
    expect(longo.status).toBe(400);
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it('imagem que diz ser PNG mas não é → 400, nada é enviado nem criado', async () => {
    authMock.mockResolvedValue(sessionOf('COORDENADOR'));
    const res = await call(
      createRoute,
      formRequest({ content: 'Foto', image: new File([HTML], 'foto.png', { type: 'image/png' }) }),
    );
    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_FORMAT');
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it('imagem válida vai para posts/ no bucket de imagens; banco guarda só o caminho', async () => {
    authMock.mockResolvedValue(sessionOf('DIRETOR', 'autor-1'));
    const res = await call(
      createRoute,
      formRequest({ content: 'Foto', image: new File([PNG], 'foto.png', { type: 'image/png' }) }),
    );
    expect(res.status).toBe(201);
    expect(storage.uploadFile).toHaveBeenCalledWith(
      'images',
      'posts/novo-arquivo.png',
      expect.anything(),
      'image/png',
    );
    expect(db.post.create.mock.calls[0][0].data.imagePath).toBe('posts/novo-arquivo.png');
  });

  it('se o banco falhar depois do upload, a imagem enviada é removida', async () => {
    authMock.mockResolvedValue(sessionOf('DIRETOR'));
    db.post.create.mockRejectedValue(new Error('falha no banco'));
    await expect(
      call(
        createRoute,
        formRequest({ content: 'Foto', image: new File([PNG], 'f.png', { type: 'image/png' }) }),
      ),
    ).rejects.toThrow('falha no banco');
    expect(storage.deleteFile).toHaveBeenCalledWith('images', 'posts/novo-arquivo.png');
  });
});

// ─── DELETE /api/posts/:id ───────────────────────────────────────────

describe('DELETE /api/posts/:id', () => {
  const del = () => new Request('http://localhost/api/posts/p1', { method: 'DELETE' });

  beforeEach(() => {
    db.post.findUnique.mockResolvedValue({
      id: 'p1',
      authorId: 'autor-1',
      imagePath: 'posts/x.png',
    });
    db.post.delete.mockResolvedValue({});
  });

  it('o próprio autor (mesmo sendo Coordenador) pode apagar; a imagem também sai', async () => {
    authMock.mockResolvedValue(sessionOf('COORDENADOR', 'autor-1'));
    const res = await call(deleteRoute, del(), { id: 'p1' });
    expect(res.status).toBe(200);
    expect(db.post.delete).toHaveBeenCalledWith({ where: { id: 'p1' } });
    expect(storage.deleteFile).toHaveBeenCalledWith('images', 'posts/x.png');
  });

  it.each(['DIRETOR', 'ADMIN'] as const)('%s apaga publicação de outra pessoa', async (role) => {
    authMock.mockResolvedValue(sessionOf(role, 'outra-pessoa'));
    const res = await call(deleteRoute, del(), { id: 'p1' });
    expect(res.status).toBe(200);
  });

  it.each(['MEMBRO', 'COORDENADOR', 'GERENTE'] as const)(
    '%s não apaga publicação de outra pessoa → 403',
    async (role) => {
      authMock.mockResolvedValue(sessionOf(role, 'outra-pessoa'));
      const res = await call(deleteRoute, del(), { id: 'p1' });
      expect(res.status).toBe(403);
      expect(db.post.delete).not.toHaveBeenCalled();
    },
  );

  it('publicação inexistente → 404', async () => {
    authMock.mockResolvedValue(sessionOf('ADMIN'));
    db.post.findUnique.mockResolvedValue(null);
    const res = await call(deleteRoute, del(), { id: 'p1' });
    expect(res.status).toBe(404);
  });
});

// ─── Curtidas ────────────────────────────────────────────────────────

describe('POST/DELETE /api/posts/:id/like', () => {
  const req = (method: string) => new Request('http://localhost/api/posts/p1/like', { method });

  beforeEach(() => {
    db.post.findUnique.mockResolvedValue({ id: 'p1' });
  });

  it('qualquer membro curte; a curtida é única por pessoa (upsert)', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO', 'leitor'));
    db.postLike.count.mockResolvedValue(3);
    db.postLike.findUnique.mockResolvedValue({ postId: 'p1' });

    const res = await call(likeRoute, req('POST'), { id: 'p1' });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ likeCount: 3, likedByMe: true });
    expect(db.postLike.upsert).toHaveBeenCalledWith({
      where: { postId_userId: { postId: 'p1', userId: 'leitor' } },
      create: { postId: 'p1', userId: 'leitor' },
      update: {},
    });
  });

  it('descurtir remove só a curtida de quem pediu', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO', 'leitor'));
    db.postLike.count.mockResolvedValue(2);
    db.postLike.findUnique.mockResolvedValue(null);

    const res = await call(unlikeRoute, req('DELETE'), { id: 'p1' });

    expect(await res.json()).toEqual({ likeCount: 2, likedByMe: false });
    expect(db.postLike.deleteMany).toHaveBeenCalledWith({
      where: { postId: 'p1', userId: 'leitor' },
    });
  });

  it('sem login → 401; publicação inexistente → 404', async () => {
    authMock.mockResolvedValue(null);
    expect((await call(likeRoute, req('POST'), { id: 'p1' })).status).toBe(401);

    authMock.mockResolvedValue(sessionOf('MEMBRO'));
    db.post.findUnique.mockResolvedValue(null);
    expect((await call(likeRoute, req('POST'), { id: 'p1' })).status).toBe(404);
    expect(db.postLike.upsert).not.toHaveBeenCalled();
  });
});
