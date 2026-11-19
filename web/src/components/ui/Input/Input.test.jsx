// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Input, { CONTROL_INVALIDO } from './Input.jsx';
import Select from '../Select/Select.jsx';
import Textarea from '../Textarea/Textarea.jsx';

function Controlado({ inicial = '', ...props }) {
    const [valor, setValor] = useState(inicial);
    return <Input aria-label="campo" value={valor} onChange={(e) => setValor(e.target.value)} {...props} />;
}

describe('Input (base compatible)', () => {
    it('sin extras renderiza solo el <input>, con className en el input', () => {
        const { container } = render(<Input aria-label="x" className="w-40" />);
        expect(container.firstChild.tagName).toBe('INPUT');
        expect(container.firstChild).toHaveClass('w-40', 'border-input');
    });

    it('invalid y aria-invalid ponen el borde destructivo', () => {
        const { rerender } = render(<Input aria-label="x" invalid />);
        expect(screen.getByLabelText('x')).toHaveClass('border-destructive');
        rerender(<Input aria-label="x" aria-invalid="true" />);
        expect(screen.getByLabelText('x')).toHaveClass('border-destructive');
    });

    it('endAdornment envuelve el campo y deja className en el contenedor', () => {
        const { container } = render(<Input aria-label="x" className="max-w-xs" endAdornment={<span>fin</span>} />);
        expect(container.firstChild.tagName).toBe('DIV');
        expect(container.firstChild).toHaveClass('relative', 'max-w-xs');
        expect(screen.getByLabelText('x')).toHaveStyle({ paddingRight: '2.5rem' });
        expect(screen.getByText('fin')).toBeInTheDocument();
    });
});

describe('Input (ampliaciones)', () => {
    it('startAdornment reserva espacio a la izquierda', () => {
        render(<Input aria-label="x" startAdornment={<span data-testid="ini" />} />);
        expect(screen.getByLabelText('x')).toHaveClass('pl-10');
        expect(screen.getByTestId('ini')).toBeInTheDocument();
    });

    it('onClear aparece solo con texto, limpia y devuelve el foco', async () => {
        const user = userEvent.setup();
        const onClear = vi.fn();
        const { rerender } = render(<Input aria-label="x" value="" onChange={() => {}} onClear={onClear} />);
        expect(screen.queryByRole('button', { name: 'Limpiar campo' })).toBeNull();
        rerender(<Input aria-label="x" value="hola" onChange={() => {}} onClear={onClear} clearLabel="Borrar búsqueda" />);
        await user.click(screen.getByRole('button', { name: 'Borrar búsqueda' }));
        expect(onClear).toHaveBeenCalledTimes(1);
        expect(screen.getByLabelText('x')).toHaveFocus();
    });

    it('onClear no aparece en campos deshabilitados o de solo lectura', () => {
        const { rerender } = render(<Input aria-label="x" value="a" onChange={() => {}} onClear={() => {}} disabled />);
        expect(screen.queryByRole('button')).toBeNull();
        rerender(<Input aria-label="x" value="a" onChange={() => {}} onClear={() => {}} readOnly />);
        expect(screen.queryByRole('button')).toBeNull();
    });

    it('showCount muestra n/max dentro del campo y avisa el límite', async () => {
        const user = userEvent.setup();
        render(<Controlado maxLength={4} showCount />);
        expect(screen.getByText('0/4')).toBeInTheDocument();
        await user.type(screen.getByLabelText('campo'), 'abcd');
        expect(screen.getByText('4/4')).toBeInTheDocument();
        expect(screen.getByRole('status')).toHaveTextContent('Límite de 4 caracteres alcanzado.');
    });

    it('showCount no dibuja nada sin maxLength o sin value', () => {
        const { rerender } = render(<Input aria-label="x" value="ab" onChange={() => {}} showCount />);
        expect(screen.queryByText(/\//)).toBeNull();
        rerender(<Input aria-label="x" maxLength={5} showCount />);
        expect(screen.queryByText(/\//)).toBeNull();
    });

    it("transform='upper' se aplica al salir, no al teclear, y llega por onChange", async () => {
        const user = userEvent.setup();
        const onBlur = vi.fn();
        render(<Controlado transform="upper" onBlur={onBlur} />);
        const campo = screen.getByLabelText('campo');
        await user.type(campo, 'e26a');
        expect(campo).toHaveValue('e26a');
        await user.tab();
        expect(campo).toHaveValue('E26A');
        expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it("transform='lower' y 'trim' y las funciones propias", async () => {
        const user = userEvent.setup();
        const { rerender } = render(<Controlado transform="lower" />);
        await user.type(screen.getByLabelText('campo'), 'ANA@UNACH.MX');
        await user.tab();
        expect(screen.getByLabelText('campo')).toHaveValue('ana@unach.mx');

        rerender(<Controlado key="trim" transform="trim" />);
        await user.type(screen.getByLabelText('campo'), '  hola  ');
        await user.tab();
        expect(screen.getByLabelText('campo')).toHaveValue('hola');

        rerender(<Controlado key="fn" transform={(v) => v.replace(/\D/g, '')} />);
        await user.type(screen.getByLabelText('campo'), '12ab34');
        await user.tab();
        expect(screen.getByLabelText('campo')).toHaveValue('1234');
    });

    it('transform sin cambios no emite eventos de más', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Input aria-label="x" defaultValue="YA" transform="upper" onChange={onChange} />);
        await user.click(screen.getByLabelText('x'));
        await user.tab();
        expect(onChange).not.toHaveBeenCalled();
    });

    it('valid pone palomita con texto accesible; invalid manda', () => {
        const { rerender } = render(<Input aria-label="x" valid />);
        expect(screen.getByText('Válido')).toHaveClass('sr-only');
        rerender(<Input aria-label="x" valid invalid />);
        expect(screen.queryByText('Válido')).toBeNull();
    });

    it('conserva el style del consumidor junto al relleno calculado', () => {
        render(<Input aria-label="x" endAdornment={<span />} style={{ color: 'rgb(1, 2, 3)' }} />);
        expect(screen.getByLabelText('x')).toHaveStyle({ color: 'rgb(1, 2, 3)', paddingRight: '2.5rem' });
    });
});

describe('campo inválido con el foco', () => {
    it('conserva el borde rojo y el anillo rojo al enfocar (CONTROL_INVALIDO), en Input, Textarea y Select', () => {
        render(
            <>
                <Input aria-label="i" invalid />
                <Textarea aria-label="t" invalid />
                <Select aria-label="s" invalid options={[{ value: 'a', label: 'A' }]} />
            </>,
        );
        for (const nombre of ['i', 't', 's']) {
            const campo = screen.getByLabelText(nombre);
            expect(campo).toHaveClass('border-destructive', 'focus-visible:border-destructive!', 'focus-visible:ring-destructive/20!');
            expect(campo).toHaveAttribute('aria-invalid', 'true');
        }
        expect(CONTROL_INVALIDO).toContain('focus-visible:border-destructive!');
    });

    it('un campo válido no lleva las clases de error', () => {
        render(<Input aria-label="i" />);
        expect(screen.getByLabelText('i')).not.toHaveClass('border-destructive', 'focus-visible:border-destructive!');
        expect(screen.getByLabelText('i')).toHaveClass('border-input');
    });
});
