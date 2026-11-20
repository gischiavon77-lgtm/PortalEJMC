// @vitest-environment node
/**
 * Testes das rotas que usam o Storage (upload e download).
 *
 * Verificam os quatro requisitos da migração de arquivos para o Storage:
 *   1. upload e download passam pelas rotas e exigem login/permissão;
 *   2. a proposta (PDF) só é baixada por quem tem `project:readProposal`;
 *   3. tipo (pelo conteúdo) e tamanho são validados no servidor antes de
 *      qualquer envio ao Storage;
 *   4. listagem de projetos e uploads de projeto: tests/unit/api-projects.test.ts.
 *
 * Tudo é simulado: `auth()` (sessão), Prisma e o módulo `@/lib/storage`.
 * Nenhum banco e nenhum Storage real são acessados.
 *
 * Ambiente `node` (e não jsdom) para usar `Request`/`FormData`/`File`
 * nativos, que é o que as rotas recebem em produção.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Session } from 'next-auth';

// ─── Sessão ──────────────────────────────────────────────────────────
const { authMock } = vi.hoisted(() => ({ authMock: vi.fn() }));
vi.mock('@/lib/auth', () => ({ auth: (...args: unknown[]) => authMock(...args) }));

// ─── Prisma ──────────────────────────────────────────────────────────
const { db } = vi.hoisted(() => ({
  db: {
    user: { findUnique: vi.fn(), update: vi.fn() },
    albumMember: { findUnique: vi.fn() },
    highlight: { findUnique: vi.fn() },
    project: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  },
}));
vi.mock('@/lib/prisma', () => ({ prisma: db }));

// ─── Storage ─────────────────────────────────────────────────────────
const { storage, StorageNotConfiguredError } = vi.hoisted(() => {
  class StorageNotConfiguredError extends Error {}
  return {
    StorageNotConfiguredError,
    storage: {
      uploadFile: vi.fn(),
      downloadFile: vi.fn(),
      deleteFile: vi.fn(),
    },
  };
});
vi.mock('@/lib/storage', () => ({
  StorageNotConfiguredError,
  uploadFile: (...args: unknown[]) => storage.uploadFile(...args),
  downloadFile: (...args: unknown[]) => storage.downloadFile(...args),
  deleteFile: (...args: unknown[]) => storage.deleteFile(...args),
  newStoragePath: (folder: string, extension: string) => `${folder}/novo-arquivo.${extension}`,
}));

import { GET as getFile } from '@/app/api/files/[kind]/[id]/route';
import { GET as getProposal } from '@/app/api/projects/[id]/proposal/route';
import { PATCH as uploadAvatar } from '@/app/api/users/me/avatar/route';

// ─── Helpers ─────────────────────────────────────────────────────────

function sessionOf(role: Session['user']['role'], id = 'user-1'): Session {
  return {
    user: { id, role, area: 'VENDAS', status: 'ACTIVE' },
    expires: new Date(Date.now() + 3_600_000).toISOString(),
  } as Session;
}

const PNG_BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4]);
const PDF_BYTES = new TextEncoder().encode('%PDF-1.7\nconteudo de teste');
const HTML_BYTES = new TextEncoder().encode('<html><script>alert(1)</script></html>');

type RouteHandler = (req: never, ctx?: never) => Promise<Response>;

function call(handler: unknown, req: Request, params?: Record<string, string>): Promise<Response> {
  return (handler as RouteHandler)(req as never, (params ? { params } : undefined) as never);
}

function getRequest(path: string): Request {
  return new Request(`http://localhost${path}`);
}

function formRequest(path: string, method: string, fields: Record<string, string | File>): Request {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  return new Request(`http://localhost${path}`, { method, body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  authMock.mockReset();
  for (const model of Object.values(db)) {
    for (const fn of Object.values(model)) fn.mockReset();
  }
  storage.uploadFile.mockReset().mockResolvedValue(undefined);
  storage.downloadFile.mockReset();
  storage.deleteFile.mockReset().mockResolvedValue(undefined);
});

// ─── Download de imagens ─────────────────────────────────────────────

describe('GET /api/files/:kind/:id (imagens)', () => {
  it('sem login → 401, sem consultar banco nem Storage', async () => {
    authMock.mockResolvedValue(null);

    const res = await call(getFile, getRequest('/api/files/avatar/user-2'), {
      kind: 'avatar',
      id: 'user-2',
    });

    expect(res.status).toBe(401);
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(storage.downloadFile).not.toHaveBeenCalled();
  });

  it('logado → devolve a imagem, com o caminho lido do banco', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));
    db.user.findUnique.mockResolvedValue({ avatarPath: 'avatars/abc.png' });
    storage.downloadFile.mockResolvedValue({ bytes: PNG_BYTES.buffer, contentType: 'x/y' });

    const res = await call(getFile, getRequest('/api/files/avatar/user-2'), {
      kind: 'avatar',
      id: 'user-2',
    });

    expect(res.status).toBe(200);
    expect(storage.downloadFile).toHaveBeenCalledWith('images', 'avatars/abc.png');
    // Tipo vem da extensão gravada pelo servidor, não do metadado do Storage.
    expect(res.headers.get('Content-Type')).toBe('image/png');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Cache-Control')).toContain('private');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_BYTES);
  });

  it('resolve álbum pelo id do membro e destaque pelo slot', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));
    storage.downloadFile.mockResolvedValue({ bytes: PNG_BYTES.buffer, contentType: 'image/png' });
    db.albumMember.findUnique.mockResolvedValue({ photoPath: 'album/m1.jpg' });
    db.highlight.findUnique.mockResolvedValue({ photoPath: 'destaques/h1.webp' });

    await call(getFile, getRequest('/api/files/album/m1'), { kind: 'album', id: 'm1' });
    await call(getFile, getRequest('/api/files/destaque/trainee'), {
      kind: 'destaque',
      id: 'trainee',
    });

    expect(db.albumMember.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'm1' } }),
    );
    expect(db.highlight.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { slot: 'trainee' } }),
    );
    expect(storage.downloadFile).toHaveBeenCalledWith('images', 'album/m1.jpg');
    expect(storage.downloadFile).toHaveBeenCalledWith('images', 'destaques/h1.webp');
  });

  it('registro sem foto, tipo desconhecido ou arquivo ausente → 404', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));

    db.user.findUnique.mockResolvedValue({ avatarPath: null });
    const semFoto = await call(getFile, getRequest('/api/files/avatar/u'), {
      kind: 'avatar',
      id: 'u',
    });

    const tipoInvalido = await call(getFile, getRequest('/api/files/propostas/x'), {
      kind: 'propostas',
      id: 'x',
    });

    db.user.findUnique.mockResolvedValue({ avatarPath: 'avatars/sumiu.png' });
    storage.downloadFile.mockResolvedValue(null);
    const ausente = await call(getFile, getRequest('/api/files/avatar/u'), {
      kind: 'avatar',
      id: 'u',
    });

    expect(semFoto.status).toBe(404);
    expect(tipoInvalido.status).toBe(404);
    expect(ausente.status).toBe(404);
  });

  it('Storage não configurado → 503', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));
    db.user.findUnique.mockResolvedValue({ avatarPath: 'avatars/abc.png' });
    storage.downloadFile.mockRejectedValue(new StorageNotConfiguredError());

    const res = await call(getFile, getRequest('/api/files/avatar/u'), { kind: 'avatar', id: 'u' });

    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('STORAGE_NOT_CONFIGURED');
  });
});

// ─── Download da proposta ────────────────────────────────────────────

describe('GET /api/projects/:id/proposal (PDF privado)', () => {
  it('sem login → 401', async () => {
    authMock.mockResolvedValue(null);

    const res = await call(getProposal, getRequest('/api/projects/proj-1/proposal'), {
      id: 'proj-1',
    });

    expect(res.status).toBe(401);
    expect(storage.downloadFile).not.toHaveBeenCalled();
  });

  it.each(['MEMBRO', 'COORDENADOR', 'GERENTE'] as const)(
    '%s logado → 403, sem tocar no banco nem no Storage',
    async (role) => {
      authMock.mockResolvedValue(sessionOf(role));

      const res = await call(getProposal, getRequest('/api/projects/proj-1/proposal'), {
        id: 'proj-1',
      });

      expect(res.status).toBe(403);
      expect(db.project.findUnique).not.toHaveBeenCalled();
      expect(storage.downloadFile).not.toHaveBeenCalled();
    },
  );

  it.each(['DIRETOR', 'ADMIN'] as const)('%s → recebe o PDF do bucket privado', async (role) => {
    authMock.mockResolvedValue(sessionOf(role));
    db.project.findUnique.mockResolvedValue({ proposalPath: 'propostas/p1.pdf' });
    storage.downloadFile.mockResolvedValue({
      bytes: PDF_BYTES.buffer,
      contentType: 'application/pdf',
    });

    const res = await call(getProposal, getRequest('/api/projects/proj-1/proposal'), {
      id: 'proj-1',
    });

    expect(res.status).toBe(200);
    expect(storage.downloadFile).toHaveBeenCalledWith('proposals', 'propostas/p1.pdf');
    expect(res.headers.get('Content-Type')).toBe('application/pdf');
    expect(res.headers.get('Cache-Control')).toContain('no-store');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(PDF_BYTES);
  });

  it('projeto sem proposta → 404', async () => {
    authMock.mockResolvedValue(sessionOf('ADMIN'));
    db.project.findUnique.mockResolvedValue({ proposalPath: null });

    const res = await call(getProposal, getRequest('/api/projects/proj-1/proposal'), {
      id: 'proj-1',
    });

    expect(res.status).toBe(404);
  });
});

// Listagem, criação e upload de proposta/banner de projetos: ver
// tests/unit/api-projects.test.ts (Fase 3 da reforma).

// ─── Upload de avatar ────────────────────────────────────────────────

describe('PATCH /api/users/me/avatar (upload de avatar)', () => {
  it('sem login → 401', async () => {
    authMock.mockResolvedValue(null);

    const res = await call(
      uploadAvatar,
      formRequest('/api/users/me/avatar', 'PATCH', {
        avatar: new File([PNG_BYTES], 'a.png', { type: 'image/png' }),
      }),
    );

    expect(res.status).toBe(401);
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('arquivo que diz ser PNG mas não é → 400, nada é enviado', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));

    const res = await call(
      uploadAvatar,
      formRequest('/api/users/me/avatar', 'PATCH', {
        avatar: new File([HTML_BYTES], 'foto.png', { type: 'image/png' }),
      }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_FORMAT');
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('PNG válido → grava o caminho, remove a foto anterior e devolve a URL da rota', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO', 'user-7'));
    db.user.findUnique.mockResolvedValue({ avatarPath: 'avatars/antiga.jpg' });
    db.user.update.mockResolvedValue({});

    const res = await call(
      uploadAvatar,
      formRequest('/api/users/me/avatar', 'PATCH', {
        avatar: new File([PNG_BYTES], 'foto.png', { type: 'image/png' }),
      }),
    );
    const body = (await res.json()) as { avatarUrl: string };

    expect(res.status).toBe(200);
    expect(storage.uploadFile).toHaveBeenCalledWith(
      'images',
      'avatars/novo-arquivo.png',
      expect.anything(),
      'image/png',
    );
    // Só o próprio usuário é atualizado, e só com o caminho.
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-7' },
      data: { avatarPath: 'avatars/novo-arquivo.png' },
    });
    expect(storage.deleteFile).toHaveBeenCalledWith('images', 'avatars/antiga.jpg');
    expect(body.avatarUrl).toMatch(/^\/api\/files\/avatar\/user-7\?v=/);
    expect(body.avatarUrl).not.toContain('avatars/');
  });

  it('Storage não configurado → 503, banco não é alterado', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));
    storage.uploadFile.mockRejectedValue(new StorageNotConfiguredError());

    const res = await call(
      uploadAvatar,
      formRequest('/api/users/me/avatar', 'PATCH', {
        avatar: new File([PNG_BYTES], 'foto.png', { type: 'image/png' }),
      }),
    );

    expect(res.status).toBe(503);
    expect(db.user.update).not.toHaveBeenCalled();
  });
});
