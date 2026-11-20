// @vitest-environment node
/**
 * Testes da tela "Estrutura" (Fase 5 da reforma).
 *
 *   - `getStructurePeople`: só usuários ATIVOS com área; cargo resolvido
 *     (`effectivePosition`); caminho do bucket nunca sai, só a URL.
 *   - páginas `/estrutura` e `/estrutura/<slug>`: renderizadas com o
 *     Prisma e o `auth` falsos; slug desconhecido → 404.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

const { authMock, findMany, notFoundMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  findMany: vi.fn(),
  notFoundMock: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('@/lib/auth', () => ({ auth: () => authMock() }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { findMany } } }));
vi.mock('next/navigation', () => ({
  notFound: notFoundMock,
  redirect: (url: string) => {
    throw new Error(`REDIRECT ${url}`);
  },
}));

import EstruturaPage from '@/app/(portal)/estrutura/page';
import EstruturaAreaPage from '@/app/(portal)/estrutura/[area]/page';
import { getStructurePeople } from '@/lib/structure';

const rows = [
  {
    id: 'u1',
    name: 'Ana Diretora',
    role: 'DIRETOR',
    area: 'VENDAS',
    position: 'Diretora de Vendas',
    avatarPath: 'avatars/abc123.png',
  },
  {
    id: 'u2',
    name: 'Bia',
    role: 'MEMBRO',
    area: 'VENDAS',
    position: 'Assessor(a)',
    avatarPath: null,
  },
  { id: 'u3', name: 'Caio', role: 'MEMBRO', area: 'VENDAS', position: null, avatarPath: null },
  {
    id: 'u4',
    name: 'Duda',
    role: 'COORDENADOR',
    area: 'MARKETING',
    position: null,
    avatarPath: null,
  },
];

beforeEach(() => {
  authMock.mockReset().mockResolvedValue({ user: { id: 'x', role: 'MEMBRO', status: 'ACTIVE' } });
  findMany.mockReset();
  notFoundMock.mockClear();
});

describe('getStructurePeople', () => {
  it('pede só ativos com área e devolve cargo resolvido e URL do avatar', async () => {
    findMany.mockResolvedValue(rows);
    const people = await getStructurePeople();

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE', area: { not: null } } }),
    );
    expect(people.find((p) => p.id === 'u2')?.position).toBe('Assessor(a)');
    expect(people.find((p) => p.id === 'u3')?.position).toBe('Trainee');
    expect(people[0].avatarUrl).toMatch(/^\/api\/files\/avatar\/u1\?v=/);
    expect(JSON.stringify(people)).not.toContain('avatars/');
  });

  it('com área, filtra a consulta por ela', async () => {
    findMany.mockResolvedValue([]);
    await getStructurePeople('PROJETOS');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: 'ACTIVE', area: 'PROJETOS' } }),
    );
  });
});

describe('páginas da Estrutura', () => {
  it('visão geral mostra os números e um card por área com a contagem', async () => {
    findMany.mockResolvedValue(rows);
    const html = renderToStaticMarkup(await EstruturaPage());

    expect(html).toContain('Estrutura');
    expect(html).toContain('href="/estrutura/vendas"');
    expect(html).toContain('3 membros');
    expect(html).toContain('1 membro<');
    expect(html).toContain('0 membros');
    expect(html.match(/data-testid="area-card-/g)).toHaveLength(6);
  });

  it('organograma da área mostra camadas e cargos', async () => {
    findMany.mockResolvedValue(rows.filter((r) => r.area === 'VENDAS'));
    const html = renderToStaticMarkup(await EstruturaAreaPage({ params: { area: 'vendas' } }));

    expect(html).toContain('Vendas');
    expect(html).toContain('data-testid="org-layer-DIRETORIA"');
    expect(html).toContain('data-testid="org-layer-MEMBROS"');
    expect(html).not.toContain('org-layer-GERENCIA');
    expect(html).toContain('Diretora de Vendas');
    expect(html).toContain('Assessor(a)');
    expect(html).toContain('Trainee');
  });

  it('slug desconhecido responde 404', async () => {
    await expect(EstruturaAreaPage({ params: { area: 'financeiro' } })).rejects.toThrow(
      'NEXT_NOT_FOUND',
    );
    expect(findMany).not.toHaveBeenCalled();
  });

  it('sem sessão, manda para o login', async () => {
    authMock.mockResolvedValue(null);
    await expect(EstruturaPage()).rejects.toThrow('REDIRECT /login');
  });
});
