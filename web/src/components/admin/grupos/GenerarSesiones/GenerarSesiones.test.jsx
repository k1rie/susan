// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const ahoraMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => ({ generarSesiones: vi.fn() }));
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: (...a) => ahoraMock(...a) }));
import { generarSesiones } from '@/lib/api/admin.js';
import { ApiError } from '@/lib/api/errors.js';
import GenerarSesiones from './GenerarSesiones.jsx';
import { agregarFechaOmitida, ATAJOS_SESIONES, contarSesiones, diaSemanaDe, esFechaValida, parsearFechasOmitir, validarGeneracion } from './generarSesiones.utils.js';

// Lunes y miércoles (dia_semana 1 y 3), una clase cada uno.
const HORARIO = [
    { dia_semana: 1, hora_inicio: '07:00:00', hora_fin: '08:00:00' },
    { dia_semana: 3, hora_inicio: '07:00:00', hora_fin: '08:00:00' },
];

beforeEach(() => {
    generarSesiones.mockReset();
    ahoraMock.mockReset();
    ahoraMock.mockResolvedValue({ fecha: '2026-09-14' });
});

describe('utilidades de generación', () => {
    it('valida fechas reales', () => {
        expect(esFechaValida('2026-02-30')).toBe(false);
        expect(esFechaValida('2026-09-14')).toBe(true);
    });
    it('parsea fechas a omitir, sin duplicados y separando inválidas', () => {
        expect(parsearFechasOmitir('2026-09-16, 2026-09-15\n2026-09-16 x')).toEqual({ fechas: ['2026-09-15', '2026-09-16'], invalidas: ['x'] });
    });
    it('exige rango coherente', () => {
        expect(validarGeneracion({ desde: '', hasta: '', omitir: '' }).valido).toBe(false);
        expect(validarGeneracion({ desde: '2026-09-10', hasta: '2026-09-01', omitir: '' }).errores.hasta).toMatch(/anterior/);
        expect(validarGeneracion({ desde: '2026-01-01', hasta: '2028-01-01', omitir: '' }).errores.hasta).toMatch(/366/);
        expect(validarGeneracion({ desde: '2026-09-01', hasta: '2026-09-30', omitir: '' }).valido).toBe(true);
    });
    it('el día de la semana va de 1 (lunes) a 7 (domingo)', () => {
        expect(diaSemanaDe('2026-09-14')).toBe(1);
        expect(diaSemanaDe('2026-09-20')).toBe(7);
    });
    it('cuenta las sesiones del horario en el rango y resta las fechas omitidas', () => {
        const base = { horario: HORARIO, desde: '2026-09-14', hasta: '2026-09-27' };
        expect(contarSesiones(base)).toMatchObject({ total: 4, sinOmitir: 4, porFechas: 0, dias: [1, 3] });
        expect(contarSesiones({ ...base, omitir: ['2026-09-16'] })).toMatchObject({ total: 3, porFechas: 1 });
        // Una fecha omitida que no es día de clase, o está fuera del rango, no resta nada.
        expect(contarSesiones({ ...base, omitir: ['2026-09-15', '2026-12-01'] }).total).toBe(4);
        // Dos bloques el mismo día son dos sesiones.
        expect(contarSesiones({ ...base, horario: [...HORARIO, { dia_semana: 1 }] }).total).toBe(6);
        expect(contarSesiones({ ...base, hasta: '2026-09-01' }).total).toBe(0);
    });
    it('agrega fechas omitidas sin repetir, ordenadas y solo si son reales', () => {
        expect(agregarFechaOmitida(['2026-09-20'], '2026-09-16')).toEqual(['2026-09-16', '2026-09-20']);
        expect(agregarFechaOmitida(['2026-09-16'], '2026-09-16')).toEqual(['2026-09-16']);
        expect(agregarFechaOmitida([], '2026-02-30')).toEqual([]);
    });
    it('los atajos de rango parten del inicio ya elegido', () => {
        const [dos, cuatro, , dieciseis] = ATAJOS_SESIONES;
        expect(dos.valor({ actual: { desde: '2026-09-14' }, hoy: '2026-10-01' })).toEqual({ desde: '2026-09-14', hasta: '2026-09-27' });
        expect(cuatro.valor({ actual: { desde: '' }, hoy: '2026-10-01' })).toEqual({ desde: '2026-10-01', hasta: '2026-10-28' });
        expect(dieciseis.label).toMatch(/semestre/);
    });
});

describe('GenerarSesiones', () => {
    it('propone valores por defecto: desde hoy (el del plantel) y cuatro semanas', async () => {
        render(<GenerarSesiones idGrupo={1} />);
        await waitFor(() => expect(screen.getByLabelText(/Desde/)).toHaveValue('2026-09-14'));
        expect(screen.getByLabelText(/Hasta/)).toHaveValue('2026-10-11');
    });

    it('no llama al servidor con datos inválidos', async () => {
        render(<GenerarSesiones idGrupo={1} />);
        await waitFor(() => expect(screen.getByLabelText(/Desde/)).toHaveValue('2026-09-14'));
        fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: '' } });
        fireEvent.click(screen.getByText('Generar sesiones', { selector: 'button' }));
        expect(screen.getByText('Indica la fecha inicial.')).toBeTruthy();
        expect(generarSesiones).not.toHaveBeenCalled();
    });

    it('envía el rango y las fechas omitidas (chips) y muestra el resumen creadas/omitidas', async () => {
        generarSesiones.mockResolvedValueOnce({ creadas: 12, omitidas: 3, omitidas_por_fecha: 1, ya_existentes: 2, modo_registro: 'automatico' });
        render(<GenerarSesiones idGrupo={7} />);
        fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: '2026-09-01' } });
        fireEvent.change(screen.getByLabelText(/Hasta/), { target: { value: '2026-09-30' } });
        fireEvent.change(screen.getByLabelText(/Fecha a omitir/), { target: { value: '2026-09-16' } });
        fireEvent.click(screen.getByRole('button', { name: 'Agregar fecha' }));
        expect(within(screen.getByRole('list', { name: 'Fechas a omitir' })).getByText('16 sep 2026')).toBeTruthy();
        fireEvent.click(screen.getByText('Generar sesiones', { selector: 'button' }));
        await waitFor(() => expect(screen.getByText(/Creadas: 12/)).toBeTruthy());
        expect(generarSesiones).toHaveBeenCalledWith({ idGrupo: 7, desde: '2026-09-01', hasta: '2026-09-30', omitirFechas: ['2026-09-16'] });
        expect(screen.getByText(/Omitidas: 3/)).toBeTruthy();
        expect(screen.getByRole('heading', { name: '12 sesiones creadas' })).toBeTruthy();
    });

    it('una fecha escrita sin pulsar «Agregar» bloquea el envío con un mensaje', async () => {
        render(<GenerarSesiones idGrupo={7} />);
        fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: '2026-09-01' } });
        fireEvent.change(screen.getByLabelText(/Hasta/), { target: { value: '2026-09-30' } });
        fireEvent.change(screen.getByLabelText(/Fecha a omitir/), { target: { value: '2026-09-16' } });
        fireEvent.click(screen.getByText('Generar sesiones', { selector: 'button' }));
        expect(await screen.findByText(/Pulsa «Agregar»/)).toBeTruthy();
        expect(generarSesiones).not.toHaveBeenCalled();
    });

    it('se puede quitar una fecha omitida', () => {
        render(<GenerarSesiones idGrupo={7} />);
        fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: '2026-09-01' } });
        fireEvent.change(screen.getByLabelText(/Hasta/), { target: { value: '2026-09-30' } });
        fireEvent.change(screen.getByLabelText(/Fecha a omitir/), { target: { value: '2026-09-16' } });
        fireEvent.click(screen.getByRole('button', { name: 'Agregar fecha' }));
        fireEvent.click(screen.getByRole('button', { name: 'Quitar la fecha 16 sep 2026' }));
        expect(screen.queryByRole('list', { name: 'Fechas a omitir' })).toBeNull();
    });

    it('con el horario muestra cuántas sesiones se crearán y el botón lo dice', async () => {
        render(<GenerarSesiones idGrupo={7} horario={HORARIO} />);
        fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: '2026-09-14' } });
        fireEvent.change(screen.getByLabelText(/Hasta/), { target: { value: '2026-09-27' } });
        expect(await screen.findByText('Se crearán hasta 4 sesiones')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Generar 4 sesiones' })).toBeEnabled();
        fireEvent.change(screen.getByLabelText(/Fecha a omitir/), { target: { value: '2026-09-16' } });
        fireEvent.click(screen.getByRole('button', { name: 'Agregar fecha' }));
        expect(await screen.findByText('Se crearán hasta 3 sesiones')).toBeTruthy();
        expect(screen.getByText(/sin 1 clase de las fechas omitidas/)).toBeTruthy();
    });

    it('si en el rango no cae ninguna clase avisa y no deja generar', () => {
        render(<GenerarSesiones idGrupo={7} horario={[{ dia_semana: 6, hora_inicio: '07:00', hora_fin: '08:00' }]} />);
        fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: '2026-09-14' } });
        fireEvent.change(screen.getByLabelText(/Hasta/), { target: { value: '2026-09-18' } });
        expect(screen.getByText(/no cae ninguna clase del horario/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Generar sesiones' })).toBeDisabled();
    });

    it('un atajo de rango fija el final a partir del inicio elegido', () => {
        render(<GenerarSesiones idGrupo={7} />);
        fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: '2026-09-14' } });
        fireEvent.click(screen.getByRole('button', { name: '8 semanas' }));
        expect(screen.getByLabelText(/Hasta/)).toHaveValue('2026-11-08');
    });

    it('con sinHorario avisa y no deja generar', () => {
        render(<GenerarSesiones idGrupo={7} sinHorario />);
        expect(screen.getByText(/Guarda primero el horario/)).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Generar sesiones' })).toBeDisabled();
    });

    it('muestra el error del servidor junto al botón y conserva lo capturado', async () => {
        generarSesiones.mockRejectedValueOnce(new ApiError({ code: 'GRUPO_SIN_HORARIO', message: 'El grupo no tiene horario.', status: 409 }));
        render(<GenerarSesiones idGrupo={7} />);
        fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: '2026-09-01' } });
        fireEvent.change(screen.getByLabelText(/Hasta/), { target: { value: '2026-09-30' } });
        fireEvent.click(screen.getByText('Generar sesiones', { selector: 'button' }));
        expect(await screen.findByText('El grupo no tiene horario.')).toBeTruthy();
        expect(screen.getByLabelText(/Desde/)).toHaveValue('2026-09-01');
    });

    it('tras generar ofrece los siguientes pasos y los navega', async () => {
        const onNavegar = vi.fn();
        generarSesiones.mockResolvedValueOnce({ creadas: 4, omitidas: 0, omitidas_por_fecha: 0, ya_existentes: 0, modo_registro: 'manual' });
        render(<GenerarSesiones idGrupo={7} onNavegar={onNavegar} />);
        fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: '2026-09-01' } });
        fireEvent.change(screen.getByLabelText(/Hasta/), { target: { value: '2026-09-30' } });
        fireEvent.click(screen.getByText('Generar sesiones', { selector: 'button' }));
        await screen.findByText(/Creadas: 4/);
        expect(screen.getByText(/Modo de registro: manual/)).toBeTruthy();
        fireEvent.click(screen.getByText('Inscribir alumnos'));
        expect(onNavegar).toHaveBeenCalledWith('inscripciones');
        // «Generar más sesiones» vuelve al formulario, desde el día siguiente al último generado.
        fireEvent.click(screen.getByRole('button', { name: 'Generar más sesiones' }));
        expect(screen.getByLabelText(/Desde/)).toHaveValue('2026-10-01');
    });
});
