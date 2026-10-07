// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Checkbox from './Checkbox.jsx';

describe('Checkbox', () => {
    it('toda la fila es la etiqueta: pulsar el texto alterna la casilla', async () => {
        const user = userEvent.setup();
        // Controlada: React restaura el DOM tras el evento, así que se lee el valor dentro del manejador.
        const onChange = vi.fn((e) => e.target.checked);
        render(<Checkbox label="Acepto" checked={false} onChange={onChange} />);
        await user.click(screen.getByText('Acepto'));
        expect(onChange).toHaveBeenCalledTimes(1);
        expect(onChange.mock.results[0].value).toBe(true);
    });

    it('acepta el texto como hijos', () => {
        render(
            <Checkbox checked onChange={() => {}}>
                Con hijos
            </Checkbox>,
        );
        expect(screen.getByRole('checkbox', { name: 'Con hijos' })).toBeChecked();
    });

    it('indeterminate se aplica por ref', () => {
        render(<Checkbox label="Todos" checked={false} indeterminate onChange={() => {}} />);
        expect(screen.getByRole('checkbox').indeterminate).toBe(true);
    });

    it('hint se enlaza con aria-describedby', () => {
        render(<Checkbox label="Completa" hint="Rehace el índice entero" checked={false} onChange={() => {}} />);
        const casilla = screen.getByRole('checkbox');
        expect(casilla).toHaveAccessibleDescription('Rehace el índice entero');
    });

    it('error marca aria-invalid, se anuncia como alert y se describe junto a la ayuda', () => {
        render(<Checkbox label="He leído el aviso" hint="Obligatorio" error="Debes aceptar para continuar." checked={false} onChange={() => {}} />);
        const casilla = screen.getByRole('checkbox');
        expect(casilla).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('alert')).toHaveTextContent('Debes aceptar para continuar.');
        expect(casilla).toHaveAccessibleDescription('Obligatorio Debes aceptar para continuar.');
    });

    it('invalid sin mensaje solo marca la casilla; sin error no hay atributos de más', () => {
        const { rerender } = render(<Checkbox label="A" invalid checked={false} onChange={() => {}} />);
        expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.queryByRole('alert')).toBeNull();
        rerender(<Checkbox label="A" checked={false} onChange={() => {}} />);
        expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-invalid');
        expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-describedby');
    });

    it('conserva el aria-describedby externo', () => {
        render(<Checkbox label="A" hint="h" aria-describedby="fuera" checked={false} onChange={() => {}} />);
        expect(screen.getByRole('checkbox').getAttribute('aria-describedby')).toMatch(/^fuera .+-hint$/);
    });

    it('deshabilitada no responde', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Checkbox label="Bloqueada" disabled checked={false} onChange={onChange} />);
        await user.click(screen.getByText('Bloqueada'));
        expect(onChange).not.toHaveBeenCalled();
    });
});
