// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Wifi } from 'lucide-react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Field from '../Field/Field.jsx';
import TarjetaOpcion from './TarjetaOpcion.jsx';

const OPCIONES = [
    { value: 'ip', titulo: 'Cámara IP', descripcion: 'RTSP o HTTP en la red del plantel', icono: Wifi },
    { value: 'navegador', titulo: 'Cámara del navegador', descripcion: 'La del equipo del docente' },
    { value: 'otra', titulo: 'Otra', disabled: true },
];

function Controlada({ inicial = '', ...props }) {
    const [valor, setValor] = useState(inicial);
    return <TarjetaOpcion label="Tipo de cámara" opciones={OPCIONES} value={valor} onChange={setValor} {...props} />;
}

describe('TarjetaOpcion', () => {
    it('es un radiogroup de radios nativos con nombre = título y descripción = texto de apoyo', () => {
        render(<Controlada />);
        expect(screen.getByRole('radiogroup', { name: 'Tipo de cámara' })).toBeInTheDocument();
        const ip = screen.getByRole('radio', { name: 'Cámara IP' });
        expect(ip).toHaveAccessibleDescription('RTSP o HTTP en la red del plantel');
        expect(screen.getAllByRole('radio')).toHaveLength(3);
        expect(screen.getByRole('radio', { name: 'Otra' })).toBeDisabled();
    });

    it('al pulsar la tarjeta llama a onChange con el valor y marca el radio', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TarjetaOpcion label="x" opciones={OPCIONES} value="" onChange={onChange} />);
        await user.click(screen.getByText('Cámara del navegador'));
        expect(onChange).toHaveBeenCalledWith('navegador');
        await user.click(screen.getByText('La del equipo del docente'));
        expect(onChange).toHaveBeenCalledTimes(2);
    });

    it('las flechas cambian de opción (radios con el mismo name) y se salta la deshabilitada', async () => {
        const user = userEvent.setup();
        render(<Controlada inicial="ip" />);
        screen.getByRole('radio', { name: 'Cámara IP' }).focus();
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('radio', { name: 'Cámara del navegador' })).toBeChecked();
        await user.keyboard('{ArrowDown}');
        expect(screen.getByRole('radio', { name: 'Cámara IP' })).toBeChecked();
    });

    it('el contenido extra aparece solo en la tarjeta elegida y queda fuera de la etiqueta', async () => {
        const user = userEvent.setup();
        render(
            <Controlada
                renderExtra={(valor) =>
                    valor === 'ip' ? (
                        <label>
                            Dirección IP
                            <input />
                        </label>
                    ) : null
                }
            />,
        );
        expect(screen.queryByLabelText('Dirección IP')).toBeNull();
        await user.click(screen.getByText('Cámara IP'));
        const campo = screen.getByLabelText('Dirección IP');
        expect(campo).toBeInTheDocument();
        const radio = screen.getByRole('radio', { name: 'Cámara IP' });
        expect(campo.closest('label').contains(radio)).toBe(false);
        expect(radio.closest('label').contains(campo)).toBe(false);
        // escribir en el campo extra no cambia la selección
        await user.type(campo, '10.0.0.1');
        expect(screen.getByRole('radio', { name: 'Cámara IP' })).toBeChecked();
        await user.click(screen.getByText('Cámara del navegador'));
        expect(screen.queryByLabelText('Dirección IP')).toBeNull();
    });

    it('también acepta `extra` por opción', () => {
        render(<TarjetaOpcion label="x" opciones={[{ value: 'a', titulo: 'A', extra: <p>detalle de A</p> }, { value: 'b', titulo: 'B', extra: <p>detalle de B</p> }]} value="b" onChange={() => {}} />);
        expect(screen.getByText('detalle de B')).toBeInTheDocument();
        expect(screen.queryByText('detalle de A')).toBeNull();
    });

    it('columnas apila en teléfono y reparte desde sm', () => {
        const { rerender } = render(<Controlada columnas={3} />);
        expect(screen.getByRole('radiogroup')).toHaveClass('grid-cols-1', 'sm:grid-cols-3');
        rerender(<Controlada columnas={1} />);
        expect(screen.getByRole('radiogroup')).toHaveClass('grid-cols-1');
        expect(screen.getByRole('radiogroup')).not.toHaveClass('sm:grid-cols-3');
    });

    it('invalid y required se declaran en el grupo', () => {
        render(<Controlada invalid required />);
        const grupo = screen.getByRole('radiogroup');
        expect(grupo).toHaveAttribute('aria-invalid', 'true');
        expect(grupo).toHaveAttribute('aria-required', 'true');
    });

    it('deshabilitada completa: nada responde', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<TarjetaOpcion label="x" opciones={OPCIONES} value="" onChange={onChange} disabled />);
        await user.click(screen.getByText('Cámara IP'));
        expect(onChange).not.toHaveBeenCalled();
    });

    it('con Field as="fieldset" la leyenda nombra el grupo', () => {
        render(
            <Field as="fieldset" label="Tipo de cámara" error="Elige un tipo">
                <TarjetaOpcion opciones={OPCIONES} value="" onChange={() => {}} />
            </Field>,
        );
        expect(screen.getByRole('group', { name: /Tipo de cámara/ })).toHaveAccessibleDescription('Elige un tipo');
        expect(screen.getAllByRole('radio')).toHaveLength(3);
    });
});
