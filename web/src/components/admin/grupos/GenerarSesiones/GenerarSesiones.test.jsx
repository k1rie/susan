// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api/admin.js', () => ({ generarSesiones: vi.fn() }));
import { generarSesiones } from '@/lib/api/admin.js';
import GenerarSesiones from './GenerarSesiones.jsx';
import { esFechaValida, parsearFechasOmitir, validarGeneracion } from './generarSesiones.utils.js';

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
});

describe('GenerarSesiones', () => {
    it('no llama al servidor con datos inválidos', () => {
        render(<GenerarSesiones idGrupo={1} />);
        fireEvent.click(screen.getByText('Generar sesiones', { selector: 'button' }));
        expect(screen.getByText('Indica la fecha inicial.')).toBeTruthy();
        expect(generarSesiones).not.toHaveBeenCalled();
    });
    it('envía el rango y muestra el resumen creadas/omitidas', async () => {
        generarSesiones.mockResolvedValueOnce({ creadas: 12, omitidas: 3, omitidas_por_fecha: 1, ya_existentes: 2, modo_registro: 'automatico' });
        render(<GenerarSesiones idGrupo={7} />);
        fireEvent.change(screen.getByLabelText(/Desde/), { target: { value: '2026-09-01' } });
        fireEvent.change(screen.getByLabelText(/Hasta/), { target: { value: '2026-09-30' } });
        fireEvent.change(screen.getByLabelText(/Fechas a omitir/), { target: { value: '2026-09-16' } });
        fireEvent.click(screen.getByText('Generar sesiones', { selector: 'button' }));
        await waitFor(() => expect(screen.getByText(/Creadas: 12/)).toBeTruthy());
        expect(generarSesiones).toHaveBeenCalledWith({ idGrupo: 7, desde: '2026-09-01', hasta: '2026-09-30', omitirFechas: ['2026-09-16'] });
        expect(screen.getByText(/Omitidas: 3/)).toBeTruthy();
    });
});
