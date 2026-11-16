// @vitest-environment node
/**
 * Testes das rotas que usam o Storage (upload e download).
 *
 * Verificam os quatro requisitos da migração de arquivos para o Storage:
 *   1. upload e download passam pelas rotas e exigem login/permissão;
 *   2. a proposta (PDF) só é baixada por quem tem `project:readProposal`;
 *   3. tipo (pelo conteúdo) e tamanho são validados no servidor antes de
 *      qualquer envio ao Storage;
 *   4. a listagem de projetos não envia o conteúdo nem o caminho do PDF.
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
import { GET as listProjects, POST as createProject } from '@/app/api/projects/route';
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

function projectRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'proj-1',
    name: 'Projeto A',
    ferramenta: 'Power BI',
    progress: 40,
    team: 'Ana, Bia',
    price: 1500,
    proposalPath: null,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-02T00:00:00Z'),
    ...overrides,
  };
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

// ─── Listagem de projetos ────────────────────────────────────────────

describe('GET /api/projects (listagem)', () => {
  it('não envia o conteúdo nem o caminho do PDF, só hasProposal', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));
    db.project.findMany.mockResolvedValue([
      projectRow({ id: 'p1', proposalPath: 'propostas/segredo.pdf' }),
      projectRow({ id: 'p2', proposalPath: null }),
    ]);

    const res = await call(listProjects, getRequest('/api/projects'));
    const text = await res.text();
    const body = JSON.parse(text) as { projects: Array<Record<string, unknown>> };

    expect(res.status).toBe(200);
    expect(body.projects.map((p) => p.hasProposal)).toEqual([true, false]);
    for (const project of body.projects) {
      expect(project).not.toHaveProperty('proposalPath');
      expect(project).not.toHaveProperty('proposalUrl');
    }
    expect(text).not.toContain('segredo.pdf');
    expect(text).not.toContain('base64');
  });
});

// ─── Upload de proposta ──────────────────────────────────────────────

describe('POST /api/projects (upload de proposta)', () => {
  const fields = { name: 'Projeto Novo', ferramenta: 'Excel', progress: '10', price: '100' };

  it('membro sem permissão → 403, nada é enviado ao Storage', async () => {
    authMock.mockResolvedValue(sessionOf('MEMBRO'));

    const res = await call(
      createProject,
      formRequest('/api/projects', 'POST', {
        ...fields,
        proposal: new File([PDF_BYTES], 'proposta.pdf', { type: 'application/pdf' }),
      }),
    );

    expect(res.status).toBe(403);
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it('arquivo que diz ser PDF mas não é → 400, nada é enviado nem gravado', async () => {
    authMock.mockResolvedValue(sessionOf('DIRETOR'));

    const res = await call(
      createProject,
      formRequest('/api/projects', 'POST', {
        ...fields,
        // Nome e tipo declarados de PDF, conteúdo HTML.
        proposal: new File([HTML_BYTES], 'proposta.pdf', { type: 'application/pdf' }),
      }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('INVALID_FORMAT');
    expect(storage.uploadFile).not.toHaveBeenCalled();
    expect(db.project.create).not.toHaveBeenCalled();
  });

  it('PDF acima de 4 MB → 400, nada é enviado', async () => {
    authMock.mockResolvedValue(sessionOf('DIRETOR'));
    const big = new Uint8Array(4 * 1024 * 1024 + 10);
    big.set(PDF_BYTES);

    const res = await call(
      createProject,
      formRequest('/api/projects', 'POST', {
        ...fields,
        proposal: new File([big], 'grande.pdf', { type: 'application/pdf' }),
      }),
    );

    expect(res.status).toBe(400);
    expect((await res.json()).code).toBe('FILE_TOO_LARGE');
    expect(storage.uploadFile).not.toHaveBeenCalled();
  });

  it('PDF válido → vai para o bucket privado e o banco guarda só o caminho', async () => {
    authMock.mockResolvedValue(sessionOf('DIRETOR'));
    db.project.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) =>
      projectRow({ ...data, id: 'novo' }),
    );

    const res = await call(
      createProject,
      formRequest('/api/projects', 'POST', {
        ...fields,
        proposal: new File([PDF_BYTES], 'Proposta Cliente X.pdf', { type: 'application/pdf' }),
      }),
    );
    const body = (await res.json()) as { project: Record<string, unknown> };

    expect(res.status).toBe(201);
    expect(storage.uploadFile).toHaveBeenCalledTimes(1);
    const [bucket, path, bytes, contentType] = storage.uploadFile.mock.calls[0];
    expect(bucket).toBe('proposals');
    // Caminho gerado pelo servidor; o nome original do arquivo não entra.
    expect(path).toBe('propostas/novo-arquivo.pdf');
    expect(contentType).toBe('application/pdf');
    expect(new Uint8Array(bytes as Uint8Array)).toEqual(PDF_BYTES);

    expect(db.project.create.mock.calls[0][0].data.proposalPath).toBe('propostas/novo-arquivo.pdf');
    expect(body.project.hasProposal).toBe(true);
    expect(body.project).not.toHaveProperty('proposalPath');
  });

  it('se o banco falhar depois do upload, o PDF enviado é removido', async () => {
    authMock.mockResolvedValue(sessionOf('DIRETOR'));
    db.project.create.mockRejectedValue(new Error('falha no banco'));

    await expect(
      call(
        createProject,
        formRequest('/api/projects', 'POST', {
          ...fields,
          proposal: new File([PDF_BYTES], 'p.pdf', { type: 'application/pdf' }),
        }),
      ),
    ).rejects.toThrow('falha no banco');

    expect(storage.deleteFile).toHaveBeenCalledWith('proposals', 'propostas/novo-arquivo.pdf');
  });
});

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
