/**
 * Testes unitários do componente `Sidebar` (Task 5.1).
 *
 * Foco: filtragem de itens por permissão, com base na sessão do
 * usuário autenticado. A correção da matriz RBAC em si é coberta por
 * `tests/unit/permissions.test.ts`; aqui validamos que o componente
 * **delegou** corretamente a decisão e renderizou só o que devia
 * (Property 8 / Req 5.3).
 *
 * Estratégia de mocks (alinhada com `usePermission.test.tsx`):
 *   - `useSession()` é mockado via `vi.hoisted` + `vi.mock`, devolvendo
 *     sessões controladas. Isso isola o componente do runtime do
 *     NextAuth (que não roda em jsdom sem servidor).
 *   - `usePathname()` é mockado para sempre devolver `/dashboard`,
 *     garantindo que o realce do item ativo seja determinístico (e que
 *     o teste não dependa de variáveis globais do Next).
 *   - `signOut` é mockado como noop — o teste não exercita o fluxo de
 *     logout (coberto indiretamente pelos testes da página `/403`).
 *   - `next/image` é renderizado como `<img>` simples. O componente
 *     real depende do servidor de imagens do Next, que não existe
 *     no jsdom; esse mock evita erros de runtime no teste.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Session } from 'next-auth';

// Mocks hoisted: vi.mock é içado para o topo do módulo, então as
// referências precisam existir antes via `vi.hoisted`.
const { useSessionMock, usePathnameMock, signOutMock } = vi.hoisted(() => ({
  useSessionMock: vi.fn(),
  usePathnameMock: vi.fn(),
  signOutMock: vi.fn(),
}));

vi.mock('next-auth/react', () => ({
  useSession: useSessionMock,
  signOut: signOutMock,
}));

vi.mock('next/navigation', () => ({
  usePathname: usePathnameMock,
}));

// `next/image` precisa de runtime do Next; substituímos por <img> neutro.
// Removemos a prop `priority` (boolean específica do next/image) antes
// de repassar — caso contrário o React reclama em runtime no jsdom.
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { priority: _priority, ...rest } = props as { priority?: unknown } & Record<
      string,
      unknown
    >;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...(rest as Record<string, never>)} />;
  },
}));

import { Sidebar } from '@/components/layout/Sidebar';
import { MENU_ITEMS } from '@/components/layout/sidebar-items';

/**
 * Helper para construir uma sessão mínima válida com defaults.
 * `expires` tem que ser um ISO string para casar com o tipo `Session`.
 */
function makeSession(overrides: Partial<Session['user']> = {}): Session {
  return {
    user: {
      id: 'user-1',
      name: 'Maria Silva',
      email: 'maria@ejmc.com',
      role: 'MEMBRO',
      area: 'VENDAS',
      status: 'ACTIVE',
      ...overrides,
    },
    expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };
}

beforeEach(() => {
  useSessionMock.mockReset();
  usePathnameMock.mockReset();
  signOutMock.mockReset();
  // Default: rota inicial ativa não importa para a maioria dos testes.
  usePathnameMock.mockReturnValue('/dashboard');
});

describe('Sidebar — filtragem por permissão', () => {
  it('mostra o item Admin quando o usuário tem papel ADMIN', () => {
    useSessionMock.mockReturnValue({
      data: makeSession({ role: 'ADMIN', area: null }),
      status: 'authenticated',
    });

    render(<Sidebar />);

    // `aria-label="Menu principal"` é exposto pelo <aside>.
    const nav = screen.getByRole('navigation', { name: /navegação principal/i });
    expect(nav).toBeInTheDocument();

    // O link "Admin" deve aparecer porque o usuário satisfaz `admin:access`.
    expect(screen.getByRole('link', { name: /admin/i })).toBeInTheDocument();
  });

  it('oculta o item Admin para um Membro comum', () => {
    useSessionMock.mockReturnValue({
      data: makeSession({ role: 'MEMBRO', area: 'VENDAS' }),
      status: 'authenticated',
    });

    render(<Sidebar />);

    // Admin é o único item com `requiredAction` no catálogo atual.
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
  });

  it('renderiza todos os itens não restritos a um Membro autenticado', () => {
    useSessionMock.mockReturnValue({
      data: makeSession({ role: 'MEMBRO', area: 'VENDAS' }),
      status: 'authenticated',
    });

    render(<Sidebar />);

    // Conferimos que cada item público de `MENU_ITEMS` está presente.
    // A nomenclatura `requiredAction` é a única que distingue itens
    // restritos — usamos o próprio catálogo como referência para que
    // o teste continue válido se a lista crescer.
    const publicItems = MENU_ITEMS.filter((item) => !item.requiredAction);
    for (const item of publicItems) {
      // Cada link é referenciado pelo seu rótulo. Usamos `getAllByText`
      // porque o rodapé pode conter o nome do usuário e outros textos;
      // confiamos no `role: 'link'` para a verificação semântica.
      const link = screen.getByRole('link', { name: new RegExp(item.label, 'i') });
      expect(link).toHaveAttribute('href', item.href);
    }
  });

  it('marca o item correspondente à rota atual com aria-current="page"', () => {
    usePathnameMock.mockReturnValue('/metas');
    useSessionMock.mockReturnValue({
      data: makeSession({ role: 'MEMBRO', area: 'VENDAS' }),
      status: 'authenticated',
    });

    render(<Sidebar />);

    const metasLink = screen.getByRole('link', { name: /metas/i });
    expect(metasLink).toHaveAttribute('aria-current', 'page');

    // Outros itens não devem estar marcados como página atual.
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).not.toHaveAttribute('aria-current');
  });
});

describe('Sidebar — estados sem sessão', () => {
  it('esconde itens com requiredAction enquanto a sessão carrega', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'loading' });

    render(<Sidebar />);

    // Itens públicos ainda aparecem (skeleton-friendly), mas Admin não.
    expect(screen.getByRole('link', { name: /dashboard/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /admin/i })).not.toBeInTheDocument();
  });

  it('mostra mensagem de "sessão não disponível" sem usuário autenticado', () => {
    useSessionMock.mockReturnValue({ data: null, status: 'unauthenticated' });

    render(<Sidebar />);

    expect(screen.getByText(/sessão não disponível/i)).toBeInTheDocument();
  });
});

describe('Sidebar — perfil do usuário no rodapé', () => {
  it('exibe nome e área formatada para um Membro', () => {
    useSessionMock.mockReturnValue({
      data: makeSession({
        name: 'Maria Silva',
        area: 'GESTAO_PESSOAS',
        role: 'MEMBRO',
      }),
      status: 'authenticated',
    });

    render(<Sidebar />);

    expect(screen.getByText('Maria Silva')).toBeInTheDocument();
    expect(screen.getByText(/gestão de pessoas/i)).toBeInTheDocument();
  });

  it('rotula área como "Administração" para usuários sem área', () => {
    useSessionMock.mockReturnValue({
      data: makeSession({ name: 'Admin Root', area: null, role: 'ADMIN' }),
      status: 'authenticated',
    });

    render(<Sidebar />);

    expect(screen.getByText(/administração/i)).toBeInTheDocument();
  });
});
