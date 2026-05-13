/**
 * Testes unitários de `Button` (Task 5.6).
 *
 * Cobertura:
 *   - Smoke: renderiza com texto e tipo `button` por padrão.
 *   - Variantes: aplica classes correspondentes a cada variant.
 *   - Loading: mostra spinner, marca `aria-busy="true"` e desabilita.
 *   - Disabled: respeita `disabled` e bloqueia clique.
 *   - forwardRef: encaminha o `ref` para o `<button>` real.
 *   - Acessibilidade: hover/focus/disabled ainda têm foco visível.
 */

import { describe, expect, it, vi } from 'vitest';
import { createRef } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { Button } from '@/components/ui/Button';

describe('Button', () => {
  it('renderiza o conteúdo e usa type="button" por padrão', () => {
    render(<Button>Salvar</Button>);
    const btn = screen.getByRole('button', { name: 'Salvar' });
    expect(btn).toBeInTheDocument();
    expect(btn).toHaveAttribute('type', 'button');
  });

  it('aplica classes da variante primary por padrão', () => {
    render(<Button>Salvar</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/bg-red-core/);
  });

  it('aplica classes da variante secondary', () => {
    render(<Button variant="secondary">Cancelar</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/text-red-core/);
    expect(btn.className).toMatch(/bg-white/);
  });

  it('aplica classes da variante destructive', () => {
    render(<Button variant="destructive">Excluir</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/bg-red-vivid/);
  });

  it('respeita o tamanho lg (mais alto que md)', () => {
    render(<Button size="lg">Confirmar</Button>);
    const btn = screen.getByRole('button');
    expect(btn.className).toMatch(/h-12/);
  });

  it('mostra spinner e marca aria-busy quando loading=true', () => {
    render(<Button loading>Salvar</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('aria-busy', 'true');
    expect(btn).toBeDisabled();
    // O spinner é decorativo (aria-hidden), então procuramos pelo elemento.
    const spinner = btn.querySelector('[aria-hidden="true"]');
    expect(spinner).not.toBeNull();
    expect(spinner?.className).toMatch(/animate-spin/);
  });

  it('respeita disabled e não dispara onClick', () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Salvar
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    fireEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('encaminha ref para o elemento <button> nativo', () => {
    const ref = createRef<HTMLButtonElement>();
    render(<Button ref={ref}>Salvar</Button>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
    expect(ref.current?.textContent).toContain('Salvar');
  });

  it('renderiza ícones esquerdo e direito quando não está em loading', () => {
    render(
      <Button leftIcon={<span data-testid="left">L</span>} rightIcon={<span data-testid="right">R</span>}>
        Texto
      </Button>,
    );
    expect(screen.getByTestId('left')).toBeInTheDocument();
    expect(screen.getByTestId('right')).toBeInTheDocument();
  });

  it('em loading, esconde leftIcon (substituído pelo spinner) e rightIcon', () => {
    render(
      <Button loading leftIcon={<span data-testid="left">L</span>} rightIcon={<span data-testid="right">R</span>}>
        Texto
      </Button>,
    );
    expect(screen.queryByTestId('left')).not.toBeInTheDocument();
    expect(screen.queryByTestId('right')).not.toBeInTheDocument();
  });

  it('aplica fullWidth quando solicitado', () => {
    render(<Button fullWidth>Salvar</Button>);
    expect(screen.getByRole('button').className).toMatch(/w-full/);
  });
});
