/**
 * Testes unitários de `Input` (Task 5.6).
 *
 * Foco em acessibilidade e contrato visual:
 *   - Label e input ficam associados via `htmlFor`/`id`.
 *   - `error` marca `aria-invalid` e vira `aria-describedby` com a
 *     mensagem; `helperText` cumpre o mesmo papel quando não há erro.
 *   - `required` reflete `aria-required` e mostra o asterisco visual.
 *   - `forwardRef` encaminha para o `<input>` real.
 *   - Mudanças do usuário (`fireEvent.change`) chegam ao handler.
 */

import { describe, expect, it, vi } from 'vitest';
import { createRef, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';

import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('associa o label ao input via htmlFor/id', () => {
    render(<Input label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toBeInTheDocument();
    expect(input.tagName).toBe('INPUT');
  });

  it('respeita um id customizado quando fornecido', () => {
    render(<Input id="custom-email" label="Email" />);
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('id', 'custom-email');
  });

  it('exibe helperText quando não há erro', () => {
    render(<Input label="Email" helperText="Use seu email institucional" />);
    expect(screen.getByText('Use seu email institucional')).toBeInTheDocument();
    const input = screen.getByLabelText('Email');
    expect(input).not.toHaveAttribute('aria-invalid');
    expect(input).toHaveAttribute('aria-describedby');
  });

  it('em erro, marca aria-invalid e usa a mensagem de erro como descrição', () => {
    render(
      <Input
        label="Email"
        helperText="Use seu email institucional"
        error="Email inválido"
      />,
    );
    const input = screen.getByLabelText('Email');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    // O helperText cede lugar ao erro.
    expect(screen.queryByText('Use seu email institucional')).not.toBeInTheDocument();
    const errorEl = screen.getByText('Email inválido');
    expect(errorEl).toBeInTheDocument();

    // aria-describedby aponta para o id do erro.
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    expect(errorEl).toHaveAttribute('id', describedBy!);
  });

  it('quando required, reflete aria-required e mostra o asterisco', () => {
    render(<Input label="Senha" required />);
    const input = screen.getByLabelText(/Senha/);
    expect(input).toHaveAttribute('aria-required', 'true');
    expect(input).toBeRequired();
    // Asterisco visível como decoração.
    const asterisk = screen.getByText('*');
    expect(asterisk).toBeInTheDocument();
    expect(asterisk).toHaveAttribute('aria-hidden', 'true');
  });

  it('encaminha ref para o <input> nativo', () => {
    const ref = createRef<HTMLInputElement>();
    render(<Input ref={ref} label="Email" />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('dispara onChange ao digitar', () => {
    function Wrapper() {
      const [value, setValue] = useState('');
      return (
        <Input
          label="Email"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
      );
    }

    render(<Wrapper />);
    const input = screen.getByLabelText('Email') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'maria@ejmc.com' } });
    expect(input.value).toBe('maria@ejmc.com');
  });

  it('hideLabel mantém o label disponível para leitores de tela', () => {
    render(<Input label="Buscar" hideLabel />);
    const input = screen.getByLabelText('Buscar');
    expect(input).toBeInTheDocument();
    // O texto do label existe no DOM mas com sr-only.
    const label = document.querySelector('label');
    expect(label?.className).toMatch(/sr-only/);
  });

  it('aplica classes de erro à borda quando há erro', () => {
    render(<Input label="Email" error="Inválido" />);
    const input = screen.getByLabelText('Email');
    expect(input.className).toMatch(/border-red-vivid/);
  });

  it('renderiza ícone esquerdo com pl maior no input', () => {
    render(
      <Input
        label="Buscar"
        leftIcon={<span data-testid="search-icon">🔍</span>}
      />,
    );
    expect(screen.getByTestId('search-icon')).toBeInTheDocument();
    const input = screen.getByLabelText('Buscar');
    expect(input.className).toMatch(/pl-9/);
  });

  it('chama onBlur quando o usuário sai do campo', () => {
    const onBlur = vi.fn();
    render(<Input label="Email" onBlur={onBlur} />);
    const input = screen.getByLabelText('Email');
    fireEvent.focus(input);
    fireEvent.blur(input);
    expect(onBlur).toHaveBeenCalledTimes(1);
  });
});
