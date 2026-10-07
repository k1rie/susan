// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Field from '../Field/Field.jsx';
import RangoFechas from './RangoFechas.jsx';

function Controlado({ inicial = { desde: '', hasta: '' }, onCambio, ...props }) {
    const [rango, setRango] = useState(inicial);
    return (
        <RangoFechas
            desde={rango.desde}
            hasta={rango.hasta}
            onChange={(r) => {
                setRango(r);
                onCambio?.(r);
            }}
            hoy="2026-10-05"
            {...props}
        />
    );
}

describe('RangoFechas', () => {
    it('es un grupo con leyenda y dos campos de fecha etiquetados', () => {
        render(<Controlado label="Periodo de generación" />);
        expect(screen.getByRole('group', { name: 'Periodo de generación' })).toBeInTheDocument();
        expect(screen.getByLabelText('Desde')).toHaveAttribute('type', 'date');
        expect(screen.getByLabelText('Hasta')).toHaveAttribute('type', 'date');
    });

    it('las etiquetas se pueden cambiar y required marca ambas', () => {
        render(<Controlado labelDesde="Inicio" labelHasta="Fin" required />);
        expect(screen.getByLabelText(/Inicio/)).toBeRequired();
        expect(screen.getByLabelText(/Fin/)).toBeRequired();
    });

    it('al cambiar un extremo llama a onChange con el par completo', () => {
        const onChange = vi.fn();
        render(<RangoFechas desde="2026-10-01" hasta="2026-10-30" onChange={onChange} hoy="2026-10-05" />);
        fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-10-10' } });
        expect(onChange).toHaveBeenLastCalledWith({ desde: '2026-10-10', hasta: '2026-10-30' });
        fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-02' } });
        expect(onChange).toHaveBeenLastCalledWith({ desde: '2026-10-01', hasta: '2026-11-02' });
    });

    it('escribe el resumen del rango con los días', () => {
        render(<Controlado inicial={{ desde: '2026-10-01', hasta: '2026-10-30' }} />);
        expect(screen.getByText('1 oct 2026 al 30 oct 2026 · 30 días')).toBeInTheDocument();
    });

    it('valida desde ≤ hasta: mensaje alert, ambos campos inválidos y descripción enlazada', () => {
        render(<Controlado label="Rango" inicial={{ desde: '2026-10-30', hasta: '2026-10-01' }} />);
        const alerta = screen.getByRole('alert');
        expect(alerta).toHaveTextContent('La fecha inicial debe ser anterior o igual a la final.');
        expect(screen.getByLabelText('Desde')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText('Hasta')).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByRole('group', { name: 'Rango' })).toHaveAttribute('aria-describedby', alerta.id);
        expect(screen.queryByText(/ · \d+ días?$/)).toBeNull(); // sin resumen mientras hay error
    });

    it('el mensaje aparece y desaparece al corregir', () => {
        render(<Controlado inicial={{ desde: '2026-10-30', hasta: '2026-10-01' }} />);
        expect(screen.getByRole('alert')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-01' } });
        expect(screen.queryByRole('alert')).toBeNull();
    });

    it('maxDias avisa cuando el rango es demasiado largo', () => {
        render(<Controlado inicial={{ desde: '2026-01-01', hasta: '2027-06-01' }} maxDias={366} />);
        expect(screen.getByRole('alert')).toHaveTextContent('El rango no puede pasar de 366 días.');
    });

    it('un error externo manda sobre la validación cruzada', () => {
        render(<Controlado inicial={{ desde: '2026-10-30', hasta: '2026-10-01' }} error="El servidor no aceptó el rango." />);
        expect(screen.getByRole('alert')).toHaveTextContent('El servidor no aceptó el rango.');
    });

    it('los límites nativos de cada campo siguen al otro extremo', () => {
        render(<Controlado inicial={{ desde: '2026-10-10', hasta: '2026-10-20' }} min="2026-10-01" max="2026-10-31" />);
        expect(screen.getByLabelText('Desde')).toHaveAttribute('min', '2026-10-01');
        expect(screen.getByLabelText('Desde')).toHaveAttribute('max', '2026-10-20');
        expect(screen.getByLabelText('Hasta')).toHaveAttribute('min', '2026-10-10');
        expect(screen.getByLabelText('Hasta')).toHaveAttribute('max', '2026-10-31');
    });

    it('ofrece «Últimos 7 días» y «Últimos 30 días» por omisión y los aplica', async () => {
        const user = userEvent.setup();
        const onCambio = vi.fn();
        render(<Controlado onCambio={onCambio} />);
        await user.click(screen.getByRole('button', { name: 'Últimos 7 días' }));
        expect(onCambio).toHaveBeenLastCalledWith({ desde: '2026-09-29', hasta: '2026-10-05' });
        expect(screen.getByLabelText('Desde')).toHaveValue('2026-09-29');
        expect(screen.getByRole('button', { name: 'Últimos 7 días' })).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('button', { name: 'Últimos 30 días' })).toHaveAttribute('aria-pressed', 'false');
        await user.click(screen.getByRole('button', { name: 'Últimos 30 días' }));
        expect(onCambio).toHaveBeenLastCalledWith({ desde: '2026-09-06', hasta: '2026-10-05' });
    });

    it('oculta los atajos fuera de min/max y acepta atajos propios o ninguno', () => {
        const { rerender } = render(<Controlado min="2026-10-01" />);
        expect(screen.queryByRole('button', { name: /Últimos/ })).toBeNull();
        rerender(<Controlado atajos={[{ label: 'Este mes', valor: { desde: '2026-10-01', hasta: '2026-10-31' } }]} />);
        expect(screen.getByRole('button', { name: 'Este mes' })).toBeInTheDocument();
        rerender(<Controlado atajos={[]} />);
        expect(screen.queryByRole('group', { name: 'Atajos de rango' })).toBeNull();
    });

    it('deshabilitado bloquea campos y atajos', () => {
        render(<Controlado disabled />);
        expect(screen.getByLabelText('Desde')).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Últimos 7 días' })).toBeDisabled();
    });

    it('con Field as="fieldset" puede usarse sin leyenda propia', () => {
        render(
            <Field as="fieldset" label="Rango del reporte">
                <Controlado />
            </Field>,
        );
        expect(screen.getAllByRole('group').length).toBeGreaterThan(1);
        expect(screen.getByLabelText('Desde')).toBeInTheDocument();
    });
});
