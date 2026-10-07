// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import HorarioSemanal from './HorarioSemanal.jsx';
import { franjaVacia } from './horarioSemanal.utils.js';

function Controlado({ inicial = [], ...props }) {
    const [valor, setValor] = useState(inicial);
    return <HorarioSemanal value={valor} onChange={setValor} {...props} />;
}

const franja = (dias, ini, fin) => franjaVacia({ dias, hora_inicio: ini, hora_fin: fin });
const inicio = (n = 1) => screen.getByLabelText(`Hora de inicio de la franja ${n}`);
const fin = (n = 1) => screen.getByLabelText(`Hora de fin de la franja ${n}`);
const dia = (nombre) => screen.getByRole('button', { name: nombre });

describe('HorarioSemanal', () => {
    it('sin franjas ofrece combinaciones de días para empezar', () => {
        render(<Controlado />);
        expect(screen.getByText('Aún no hay franjas de horario')).toBeTruthy();
        fireEvent.click(screen.getByRole('button', { name: 'Lun, Mié y Vie' }));
        expect(dia('Lunes')).toHaveAttribute('aria-pressed', 'true');
        expect(dia('Miércoles')).toHaveAttribute('aria-pressed', 'true');
        expect(dia('Viernes')).toHaveAttribute('aria-pressed', 'true');
        expect(dia('Martes')).toHaveAttribute('aria-pressed', 'false');
    });

    it('al elegir la hora de inicio la de fin propone una hora después y luego conserva la duración', () => {
        render(<Controlado inicial={[franja(['1'], '', '')]} />);
        fireEvent.change(inicio(), { target: { value: '07:00' } });
        expect(fin()).toHaveValue('08:00');
        fireEvent.change(fin(), { target: { value: '09:00' } });
        fireEvent.change(inicio(), { target: { value: '10:00' } });
        expect(fin()).toHaveValue('12:00');
    });

    it('las duraciones rápidas fijan la hora de fin', () => {
        render(<Controlado inicial={[franja(['1'], '07:00', '08:00')]} />);
        fireEvent.click(screen.getByRole('radio', { name: '2 h' }));
        expect(fin()).toHaveValue('09:00');
    });

    it('activar o apagar días de una franja genera o quita sus bloques de golpe y actualiza el total', () => {
        render(<Controlado inicial={[franja(['1'], '07:00', '08:00')]} />);
        expect(screen.getByText('Total: 1 h por semana')).toBeTruthy();
        fireEvent.click(dia('Miércoles'));
        fireEvent.click(dia('Viernes'));
        expect(screen.getByText('Total: 3 h por semana')).toBeTruthy();
        fireEvent.click(dia('Lunes'));
        expect(screen.getByText('Total: 2 h por semana')).toBeTruthy();
    });

    it('compara con las horas por semana de la materia (solo informa)', () => {
        const { rerender } = render(<HorarioSemanal value={[franja(['1', '3', '5'], '07:00', '08:00')]} onChange={() => {}} horasMateria={3} />);
        expect(screen.getByText('Coincide con las 3 h por semana de la materia.')).toBeTruthy();
        rerender(<HorarioSemanal value={[franja(['1', '3', '5'], '07:00', '08:00')]} onChange={() => {}} horasMateria={4} />);
        expect(screen.getByText('La materia declara 4 h por semana; este horario suma 3 h.')).toBeTruthy();
    });

    it('muestra al instante el fin anterior al inicio y el traslape, cada uno donde ocurre', () => {
        render(<Controlado inicial={[franja(['1'], '09:00', '08:00')]} />);
        expect(screen.getByText('La hora de fin debe ser posterior a la de inicio.')).toBeTruthy();
        expect(fin()).toHaveAttribute('aria-invalid', 'true');
        render(<Controlado inicial={[franja(['1', '3'], '07:00', '08:00'), franja(['3'], '07:30', '09:00')]} />);
        expect(screen.getByText('Se traslapa el miércoles con otra franja (07:00–08:00).')).toBeTruthy();
    });

    it('lo que solo falta llenar se marca después del primer intento de guardar', () => {
        const { rerender } = render(<HorarioSemanal value={[franjaVacia()]} onChange={() => {}} />);
        expect(screen.queryByText('Elige al menos un día.')).toBeNull();
        rerender(<HorarioSemanal value={[franjaVacia()]} onChange={() => {}} mostrarPendientes />);
        expect(screen.getByText('Elige al menos un día.')).toBeTruthy();
        expect(screen.getByText('Indica la hora de inicio.')).toBeTruthy();
        expect(screen.getByText('Indica la hora de fin.')).toBeTruthy();
    });

    it('«Duplicar» agrega una franja con las mismas horas y sin días, y «Quitar» la elimina', () => {
        render(<Controlado inicial={[franja(['1'], '07:00', '08:00')]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Duplicar la franja 1' }));
        expect(inicio(2)).toHaveValue('07:00');
        expect(within(screen.getByRole('group', { name: /Días de la franja 2/ })).queryAllByRole('button', { pressed: true })).toHaveLength(0);
        fireEvent.click(screen.getByRole('button', { name: 'Quitar la franja 2' }));
        expect(screen.queryByLabelText('Hora de inicio de la franja 2')).toBeNull();
    });

    it('la vista semanal dice las clases de cada día con texto', () => {
        render(<Controlado inicial={[franja(['1', '3'], '07:00', '08:00')]} />);
        const vista = screen.getByRole('region', { name: 'Vista semanal del horario' });
        expect(within(vista).getByText('Lunes: 07:00 a 08:00')).toBeTruthy();
        expect(within(vista).getByText('Martes: sin clase')).toBeTruthy();
    });
});
