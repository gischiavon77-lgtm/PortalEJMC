/**
 * Testes unitários do componente `PortalShell` (Tasks 5.3 e 5.4).
 *
 * Cobertura:
 *   - Estado inicial: drawer fechado (botão `aria-expanded="false"`).
 *   - Abertura via clique no hamburger: `aria-expanded` muda para
 *     "true" e a Sidebar passa a expor `isOpen=true` (refletido em
 *     `aria-controls`/classe `translate-x-0`).
 *   - Fechamento via clique no backdrop.
 *   - Fechamento via tecla `Escape`.
 *   - Fechamento via clique em link da Sidebar (callback `onNavigate`).
 *
 * O foco é o comportamento interativo do layout — a filtragem de
 * itens da Sidebar continua coberta por `Sidebar.test.tsx`.
 *
 * Observação sobre viewports: jsdom não simula media queries do
 * Tailwind, então classes `mobile:*` ficam inertes. Validamos a
 * lógica de estado e ARIA, que é a contratação observável e
 * estável do componente. A renderização visual em mobile/tablet/
 * desktop é validada nos testes E2E da Task 21.4 (Playwright com 3
 * viewports), o local apropriado para checar layout responsivo.
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { Session } from 'next-auth';

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

import { PortalShell } from '@/components/layout/PortalShell';

function makeSession(): Session {
  return {
    user: {
      id: 'user-1',
      name: 'Maria Silva',
      email: 'maria@ejmc.com',
      role: 'MEMBRO',
      area: 'VENDAS',
      status: 'ACTIVE',
    },
    expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  };
}

beforeEach(() => {
  useSessionMock.mockReset();
  usePathnameMock.mockReset();
  signOutMock.mockReset();
  usePathnameMock.mockReturnValue('/dashboard');
  useSessionMock.mockReturnValue({
    data: makeSession(),
    status: 'authenticated',
  });
});

describe('PortalShell — drawer mobile', () => {
  it('inicia com o drawer fechado', () => {
    render(
      <PortalShell>
        <div>conteúdo</div>
      </PortalShell>,
    );

    const trigger = screen.getByRole('button', { name: /abrir menu de navegação/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).toHaveAttribute('aria-controls', 'portal-sidebar');

    // Sidebar fechada tem a classe que a empurra para fora da viewport.
    const sidebar = document.getElementById('portal-sidebar');
    expect(sidebar?.className).toMatch(/-translate-x-full/);
  });

  it('abre o drawer ao clicar no botão hamburger', () => {
    render(
      <PortalShell>
        <div>conteúdo</div>
      </PortalShell>,
    );

    const trigger = screen.getByRole('button', { name: /abrir menu de navegação/i });
    fireEvent.click(trigger);

    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    const sidebar = document.getElementById('portal-sidebar');
    // Aberta: classe que mantém o drawer dentro da viewport.
    expect(sidebar?.className).toMatch(/translate-x-0/);
    expect(sidebar?.className).not.toMatch(/-translate-x-full/);
  });

  it('fecha o drawer ao clicar no backdrop', () => {
    render(
      <PortalShell>
        <div>conteúdo</div>
      </PortalShell>,
    );

    fireEvent.click(screen.getByRole('button', { name: /abrir menu de navegação/i }));

    const backdrop = screen.getByTestId('portal-shell-backdrop');
    fireEvent.click(backdrop);

    const trigger = screen.getByRole('button', { name: /abrir menu de navegação/i });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('fecha o drawer ao pressionar Escape', () => {
    render(
      <PortalShell>
        <div>conteúdo</div>
      </PortalShell>,
    );

    const trigger = screen.getByRole('button', { name: /abrir menu de navegação/i });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(window, { key: 'Escape' });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('fecha o drawer ao clicar em um link da Sidebar', () => {
    render(
      <PortalShell>
        <div>conteúdo</div>
      </PortalShell>,
    );

    const trigger = screen.getByRole('button', { name: /abrir menu de navegação/i });
    fireEvent.click(trigger);

    // Qualquer link do menu deve disparar `onNavigate`. Usamos
    // "Cronograma" porque é um item público e estável no catálogo.
    const link = screen.getByRole('link', { name: /cronograma/i });
    fireEvent.click(link);

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('renderiza o conteúdo passado como children dentro de <main>', () => {
    render(
      <PortalShell>
        <p data-testid="filho">olá</p>
      </PortalShell>,
    );

    const main = screen.getByRole('main');
    expect(main).toContainElement(screen.getByTestId('filho'));
  });
});
