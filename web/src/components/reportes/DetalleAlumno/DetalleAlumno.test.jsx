// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DetalleAlumno from './DetalleAlumno.jsx';

const sesion = (o) => ({ id_sesion: 1, fecha: '2026-09-01', hora_inicio: '08:00:00', estado: 'ausente', origen: 'manual', justificante_estatus: null, ...o });

describe('DetalleAlumno', () => {
    it('lista cada sesión con fecha, hora, estado y origen', () => {
        render(<DetalleAlumno detalle={[sesion(), sesion({ id_sesion: 2, fecha: '2026-09-03', estado: 'presente', origen: 'automatico' })]} />);
        const tabla = within(screen.getByRole('table', { name: 'Estado del alumno en cada sesión' }));
        expect(tabla.getAllByRole('row')).toHaveLength(3);
        expect(tabla.getByText('01/09/2026')).toBeInTheDocument();
        expect(tabla.getAllByText('08:00')).toHaveLength(2);
        expect(tabla.getByText('Ausente')).toBeInTheDocument();
        expect(tabla.getByText('Manual')).toBeInTheDocument();
    });

    it('una sesión sin registro lo dice con texto y sin justificante muestra un guion', () => {
        render(<DetalleAlumno detalle={[sesion({ estado: null, origen: null })]} />);
        const fila = within(screen.getAllByRole('row')[1]);
        expect(fila.getByText('Sin registro')).toBeInTheDocument();
        expect(fila.getAllByText('—')).toHaveLength(2);
        expect(fila.queryByText('Justificante')).toBeNull();
    });

    it('el justificante tiene su columna desde sm y, en pantallas angostas, va bajo el estado con su rótulo', () => {
        render(<DetalleAlumno detalle={[sesion({ justificante_estatus: 'aprobado' })]} />);
        const fila = within(screen.getAllByRole('row')[1]);
        // Dos veces en el DOM: la columna (hidden sm:table-cell) y la versión bajo el estado (sm:hidden).
        expect(fila.getAllByText('Aprobado')).toHaveLength(2);
        const bajoEstado = fila.getByText('Justificante');
        expect(bajoEstado.parentElement).toHaveClass('sm:hidden');
        expect(screen.getByRole('columnheader', { name: 'Justificante' })).toHaveClass('hidden');
    });

    it('sin sesiones muestra el estado vacío', () => {
        render(<DetalleAlumno detalle={[]} />);
        expect(screen.getByText('Sin sesiones registradas para este alumno.')).toBeInTheDocument();
        expect(screen.queryByRole('table')).toBeNull();
    });
});
