// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

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
