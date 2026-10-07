// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import SegmentedControl from './SegmentedControl.jsx';

const ESTATUS = [
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
    { value: 'mantenimiento', label: 'Mantenimiento' },
];

const ESTADOS = [
    { value: 'presente', label: 'Presente', tone: 'presente' },
    { value: 'retardo', label: 'Retardo', tone: 'retardo' },
    { value: 'ausente', label: 'Ausente', tone: 'ausente' },
];

function Controlado({ inicial = 'activo', items = ESTATUS, ...props }) {
    const [valor, setValor] = useState(inicial);
    return <SegmentedControl label="Estatus" items={items} value={valor} onChange={setValor} {...props} />;
}

describe('SegmentedControl', () => {
    it('es un radiogroup con un radio por opción y aria-checked en la elegida', () => {
        render(<Controlado />);
        expect(screen.getByRole('radiogroup', { name: 'Estatus' })).toBeInTheDocument();
        const radios = screen.getAllByRole('radio');
        expect(radios.map((r) => r.textContent)).toEqual(['Activo', 'Inactivo', 'Mantenimiento']);
        expect(screen.getByRole('radio', { name: 'Activo' })).toBeChecked();
        expect(screen.getByRole('radio', { name: 'Inactivo' })).not.toBeChecked();
    });

    it('al pulsar llama a onChange con el valor (no con un evento) y no repite la elegida', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<SegmentedControl label="Estatus" items={ESTATUS} value="activo" onChange={onChange} />);
        await user.click(screen.getByRole('radio', { name: 'Inactivo' }));
        expect(onChange).toHaveBeenCalledWith('inactivo');
        await user.click(screen.getByRole('radio', { name: 'Activo' }));
        expect(onChange).toHaveBeenCalledTimes(1);
    });

    it('solo la elegida es tabulable (roving tabindex)', () => {
        render(<Controlado inicial="inactivo" />);
        expect(screen.getByRole('radio', { name: 'Inactivo' })).toHaveAttribute('tabindex', '0');
        expect(screen.getByRole('radio', { name: 'Activo' })).toHaveAttribute('tabindex', '-1');
    });

    it('sin valor elegido la primera opción habilitada recibe el tabulador', () => {
        render(<Controlado inicial="" items={[{ value: 'a', label: 'A', disabled: true }, { value: 'b', label: 'B' }]} />);
        expect(screen.getByRole('radio', { name: 'B' })).toHaveAttribute('tabindex', '0');
    });

    it('las flechas mueven el foco Y eligen, con vuelta al principio', async () => {
        const user = userEvent.setup();
        render(<Controlado />);
        await user.tab();
        expect(screen.getByRole('radio', { name: 'Activo' })).toHaveFocus();
        await user.keyboard('{ArrowRight}');
        expect(screen.getByRole('radio', { name: 'Inactivo' })).toHaveFocus();
        expect(screen.getByRole('radio', { name: 'Inactivo' })).toBeChecked();
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('radio', { name: 'Mantenimiento' })).toBeChecked();
        await user.keyboard('{ArrowRight}');
        expect(screen.getByRole('radio', { name: 'Activo' })).toBeChecked();
        await user.keyboard('{ArrowLeft}');
        expect(screen.getByRole('radio', { name: 'Mantenimiento' })).toBeChecked();
        await user.keyboard('{Home}');
        expect(screen.getByRole('radio', { name: 'Activo' })).toBeChecked();
        await user.keyboard('{End}');
        expect(screen.getByRole('radio', { name: 'Mantenimiento' })).toBeChecked();
    });

    it('las opciones deshabilitadas se saltan con flechas y no se eligen con clic', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        const items = [{ value: 'a', label: 'A' }, { value: 'b', label: 'B', disabled: true }, { value: 'c', label: 'C' }];
        render(<SegmentedControl label="x" items={items} value="a" onChange={onChange} />);
        await user.click(screen.getByRole('radio', { name: 'B' }));
        expect(onChange).not.toHaveBeenCalled();
        screen.getByRole('radio', { name: 'A' }).focus();
        await user.keyboard('{ArrowRight}');
        expect(onChange).toHaveBeenCalledWith('c');
    });

    it('con tonos, toda opción conserva su texto: punto de color si no está elegida y palomita si lo está', () => {
        const { container } = render(<Controlado inicial="retardo" items={ESTADOS} label="Estado" />);
        expect(screen.getByRole('radio', { name: 'Presente' })).toHaveTextContent('Presente');
        const elegida = screen.getByRole('radio', { name: 'Retardo' });
        expect(elegida).toHaveClass('text-retardo', 'bg-retardo-bg');
        expect(elegida.querySelector('svg')).not.toBeNull(); // Check de Lucide
        expect(screen.getByRole('radio', { name: 'Presente' }).querySelector('svg')).toBeNull();
        expect(container.querySelectorAll('[aria-hidden="true"].bg-presente, [aria-hidden="true"].bg-ausente')).toHaveLength(2);
    });

    it('size y fullWidth cambian las clases sin cambiar el DOM semántico', () => {
        const { rerender } = render(<Controlado size="sm" fullWidth />);
        expect(screen.getByRole('radiogroup')).toHaveClass('flex', 'w-full');
        expect(screen.getByRole('radio', { name: 'Activo' })).toHaveClass('min-h-9', 'flex-auto');
        rerender(<Controlado size="md" />);
        expect(screen.getByRole('radiogroup')).toHaveClass('inline-flex');
        expect(screen.getByRole('radio', { name: 'Activo' })).toHaveClass('min-h-11');
    });

    it('a ancho completo reparte con flex-auto, min-w-0 y menos relleno para que «Mantenimiento» no se salga de su segmento a 360 px', () => {
        const { rerender } = render(<Controlado fullWidth />);
        const larga = screen.getByRole('radio', { name: 'Mantenimiento' });
        expect(larga).toHaveClass('flex-auto', 'min-w-0', 'break-words', 'whitespace-normal', 'px-2.5');
        expect(larga).not.toHaveClass('px-4', 'flex-1');
        rerender(<Controlado fullWidth size="sm" />);
        expect(screen.getByRole('radio', { name: 'Mantenimiento' })).toHaveClass('px-2');
        // Sin fullWidth conserva el relleno holgado y no parte el texto.
        rerender(<Controlado />);
        expect(screen.getByRole('radio', { name: 'Mantenimiento' })).toHaveClass('px-4', 'whitespace-nowrap');
        expect(screen.getByRole('radio', { name: 'Mantenimiento' })).not.toHaveClass('flex-auto');
    });

    it('con name marca el grupo con data-campo-nombre, para que useFormulario le lleve el foco; sin name no lo escribe', () => {
        const { rerender } = render(<Controlado name="estatus" />);
        expect(screen.getByRole('radiogroup')).toHaveAttribute('data-campo-nombre', 'estatus');
        rerender(<Controlado />);
        expect(screen.getByRole('radiogroup')).not.toHaveAttribute('data-campo-nombre');
    });

    it('deshabilitado completo: sin tabulador y sin respuesta', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<SegmentedControl label="x" items={ESTATUS} value="activo" onChange={onChange} disabled />);
        await user.click(screen.getByRole('radio', { name: 'Inactivo' }));
        expect(onChange).not.toHaveBeenCalled();
        expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-disabled', 'true');
    });

    it('muestra iconos de Lucide decorativos, acepta aria-labelledby y escribe el campo oculto', () => {
        const Icono = (props) => <svg data-testid="icono" {...props} />;
        const { container } = render(
            <>
                <span id="titulo">Tipo de cámara</span>
                <SegmentedControl aria-labelledby="titulo" name="tipo" items={[{ value: 'ip', label: 'IP', icon: Icono }, { value: 'web', label: 'Navegador' }]} value="ip" onChange={() => {}} />
            </>,
        );
        expect(screen.getByRole('radiogroup', { name: 'Tipo de cámara' })).toBeInTheDocument();
        expect(screen.getByTestId('icono')).toHaveAttribute('aria-hidden', 'true');
        expect(container.querySelector('input[type="hidden"][name="tipo"]')).toHaveValue('ip');
    });

    it('aria-invalid va en el grupo', () => {
        render(<SegmentedControl label="x" items={ESTATUS} value="" onChange={() => {}} aria-invalid="true" />);
        expect(screen.getByRole('radiogroup')).toHaveAttribute('aria-invalid', 'true');
    });
});
