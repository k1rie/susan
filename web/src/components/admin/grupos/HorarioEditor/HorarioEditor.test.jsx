// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/admin.js', () => ({ horarioGuardar: vi.fn() }));
import { horarioGuardar } from '@/lib/api/admin.js';
import { ApiError } from '@/lib/api/errors.js';
import HorarioEditor from './HorarioEditor.jsx';
import { aMinutos, desdeApi, haciaApi, mensajeErrorHorario, validarBloques } from './horarioEditor.utils.js';

const fila = (clave, dia, ini, fin) => ({ clave, dia_semana: dia, hora_inicio: ini, hora_fin: fin });

describe('validarBloques', () => {
    it('exige al menos un bloque', () => {
        expect(validarBloques([]).valido).toBe(false);
    });
    it('rechaza fin <= inicio y horas vacías', () => {
        const v = validarBloques([fila('a', '1', '09:00', '08:00'), fila('b', '2', '09:00', '09:00'), fila('c', '3', '', '10:00')]);
        expect(Object.keys(v.porFila).sort()).toEqual(['a', 'b', 'c']);
        expect(v.porFila.a).toMatch(/posterior/);
    });
    it('detecta traslape del mismo día pero acepta bloques contiguos y otros días', () => {
        expect(validarBloques([fila('a', '1', '07:00', '08:00'), fila('b', '1', '07:30', '09:00')]).porFila.b).toMatch(/traslapa/);
        expect(validarBloques([fila('a', '1', '07:00', '08:00'), fila('b', '1', '08:00', '09:00'), fila('c', '2', '07:00', '08:00')]).valido).toBe(true);
    });
    it('aMinutos acepta HH:MM y HH:MM:SS', () => {
        expect(aMinutos('07:30:00')).toBe(450);
        expect(aMinutos('24:00')).toBeNull();
        expect(aMinutos('')).toBeNull();
    });
    it('convierte entre API y filas', () => {
        const filas = desdeApi([{ dia_semana: 1, hora_inicio: '07:00:00', hora_fin: '08:00:00' }]);
        expect(haciaApi(filas)).toEqual([{ dia_semana: 1, hora_inicio: '07:00', hora_fin: '08:00' }]);
    });
    it('explica el choque de aula con el mensaje del servidor', () => {
        expect(mensajeErrorHorario({ code: 'HORARIO_CHOQUE', message: 'Grupo 3B' })).toMatch(/Choque.*Grupo 3B/);
    });
});

describe('HorarioEditor', () => {
    it('no envía con fin anterior al inicio', () => {
        render(<HorarioEditor idGrupo={1} horario={[{ dia_semana: 1, hora_inicio: '09:00:00', hora_fin: '08:00:00' }]} />);
        fireEvent.click(screen.getByText('Guardar horario'));
        expect(screen.getByText(/posterior a la de inicio/)).toBeTruthy();
        expect(horarioGuardar).not.toHaveBeenCalled();
    });
    it('envía bloques válidos y avisa el choque del servidor', async () => {
        horarioGuardar.mockRejectedValueOnce(new ApiError({ code: 'HORARIO_CHOQUE', message: 'Aula ocupada por 3B', status: 409 }));
        render(<HorarioEditor idGrupo={4} horario={[{ dia_semana: 2, hora_inicio: '07:00:00', hora_fin: '08:00:00' }]} />);
        fireEvent.click(screen.getByText('Guardar horario'));
        await waitFor(() => expect(screen.getByText(/Aula ocupada por 3B/)).toBeTruthy());
        expect(horarioGuardar).toHaveBeenCalledWith({ idGrupo: 4, bloques: [{ dia_semana: 2, hora_inicio: '07:00', hora_fin: '08:00' }] });
    });
});

describe('HorarioEditor (franjas)', () => {
    beforeEach(() => horarioGuardar.mockReset());

    it('con días y una hora genera un bloque por día en el payload de siempre', async () => {
        horarioGuardar.mockResolvedValueOnce({ bloques: [] });
        render(<HorarioEditor idGrupo={9} horario={[]} />);
        fireEvent.click(screen.getByRole('button', { name: 'Lun, Mié y Vie' }));
        fireEvent.change(screen.getByLabelText('Hora de inicio de la franja 1'), { target: { value: '07:00' } });
        fireEvent.click(screen.getByText('Guardar horario'));
        await waitFor(() => expect(horarioGuardar).toHaveBeenCalled());
        // La hora de fin se propuso sola (+1 h).
        expect(horarioGuardar).toHaveBeenCalledWith({
            idGrupo: 9,
            bloques: [
                { dia_semana: 1, hora_inicio: '07:00', hora_fin: '08:00' },
                { dia_semana: 3, hora_inicio: '07:00', hora_fin: '08:00' },
                { dia_semana: 5, hora_inicio: '07:00', hora_fin: '08:00' },
            ],
        });
    });

    it('carga los bloques de la API agrupados por hora', () => {
        render(
            <HorarioEditor
                idGrupo={9}
                horario={[
                    { dia_semana: 1, hora_inicio: '07:00:00', hora_fin: '08:00:00' },
                    { dia_semana: 4, hora_inicio: '07:00:00', hora_fin: '08:00:00' },
                ]}
            />,
        );
        expect(screen.getByLabelText('Hora de inicio de la franja 1')).toHaveValue('07:00');
        expect(screen.queryByLabelText('Hora de inicio de la franja 2')).toBeNull();
        expect(screen.getByRole('button', { name: 'Jueves' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('sin franjas no envía y dice que falta al menos una', () => {
        render(<HorarioEditor idGrupo={9} horario={[]} />);
        fireEvent.click(screen.getByText('Guardar horario'));
        expect(screen.getByText('Agrega al menos una franja de horario.')).toBeTruthy();
        expect(horarioGuardar).not.toHaveBeenCalled();
    });

    it('avisa de cambios sin guardar al contenedor, los muestra en la barra y se pueden descartar', () => {
        const onSucioChange = vi.fn();
        render(<HorarioEditor idGrupo={9} horario={[{ dia_semana: 2, hora_inicio: '07:00:00', hora_fin: '08:00:00' }]} onSucioChange={onSucioChange} />);
        expect(screen.queryByText('Cambios sin guardar')).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: 'Miércoles' }));
        expect(screen.getByText('Cambios sin guardar')).toBeTruthy();
        expect(onSucioChange).toHaveBeenLastCalledWith(true);
        fireEvent.click(screen.getByRole('button', { name: 'Descartar cambios' }));
        expect(screen.queryByText('Cambios sin guardar')).toBeNull();
        expect(onSucioChange).toHaveBeenLastCalledWith(false);
        expect(screen.getByRole('button', { name: 'Miércoles' })).toHaveAttribute('aria-pressed', 'false');
    });

    it('tras guardar bien ya no quedan cambios sin guardar y se avisa al contenedor', async () => {
        const onSucioChange = vi.fn();
        const onSaved = vi.fn();
        horarioGuardar.mockResolvedValueOnce({
            bloques: [
                { dia_semana: 2, hora_inicio: '07:00:00', hora_fin: '08:00:00' },
                { dia_semana: 3, hora_inicio: '07:00:00', hora_fin: '08:00:00' },
            ],
        });
        render(<HorarioEditor idGrupo={9} horario={[{ dia_semana: 2, hora_inicio: '07:00:00', hora_fin: '08:00:00' }]} onSucioChange={onSucioChange} onSaved={onSaved} />);
        fireEvent.click(screen.getByRole('button', { name: 'Miércoles' }));
        fireEvent.click(screen.getByText('Guardar horario'));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(screen.queryByText('Cambios sin guardar')).toBeNull();
        expect(onSucioChange).toHaveBeenLastCalledWith(false);
        expect(screen.getByRole('button', { name: 'Miércoles' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('al desmontarse avisa que ya no hay nada pendiente', () => {
        const onSucioChange = vi.fn();
        const { unmount } = render(<HorarioEditor idGrupo={9} horario={[]} onSucioChange={onSucioChange} />);
        fireEvent.click(screen.getByRole('button', { name: 'Mar y Jue' }));
        expect(onSucioChange).toHaveBeenLastCalledWith(true);
        unmount();
        expect(onSucioChange).toHaveBeenLastCalledWith(false);
    });

    it('un choque con otra franja no llega al servidor y se marca en la franja', () => {
        render(
            <HorarioEditor
                idGrupo={9}
                horario={[
                    { dia_semana: 1, hora_inicio: '07:00:00', hora_fin: '09:00:00' },
                    { dia_semana: 1, hora_inicio: '08:00:00', hora_fin: '10:00:00' },
                ]}
            />,
        );
        expect(screen.getByText(/Se traslapa el lunes/)).toBeTruthy();
        fireEvent.click(screen.getByText('Guardar horario'));
        expect(horarioGuardar).not.toHaveBeenCalled();
    });
});
