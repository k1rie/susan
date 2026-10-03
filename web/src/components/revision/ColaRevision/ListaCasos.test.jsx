// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ListaCasos from './ListaCasos.jsx';

const base = (id) => ({
    id_asistencia: id,
    id_justificante: id,
    alumno: { nombre_completo: `Ana Perez ${id}` },
    materia: { nombre: 'Finanzas' },
    grupo: { clave_grupo: '3A' },
    sesion: { fecha: '2026-09-14', hora_inicio: '07:00:00' },
    segundos_restantes: 3600 * 30,
    vence_en: '2026-09-16T09:00:00-06:00',
    estado_asistencia: 'ausente',
    registrado_por_rol: 'alumno',
});

describe('ListaCasos', () => {
    it('pendientes: una línea de meta, estado y plazo compacto (sin fecha límite)', () => {
        render(<ListaCasos tipo="pendiente" items={[base(1)]} total={1} onSeleccionar={() => {}} />);
        expect(screen.getByText('Finanzas · 3A · 14 sep 07:00')).toBeInTheDocument();
        expect(screen.getByText('Pendiente')).toBeInTheDocument();
        expect(screen.getByText('Quedan 30 h 0 min')).toBeInTheDocument();
        expect(screen.queryByText(/límite:/)).toBeNull();
    });

    it('justificantes: estado de la asistencia y quién lo registró', () => {
        render(<ListaCasos tipo="justificante" items={[{ ...base(2), registrado_por_rol: 'docente' }]} total={1} onSeleccionar={() => {}} />);
        expect(screen.getByText('Ausente')).toBeInTheDocument();
        expect(screen.getByText('De docente')).toBeInTheDocument();
    });

    it('cada fila es un botón: selecciona y marca el activo; «Ver más» solo si faltan casos', async () => {
        const alSeleccionar = vi.fn();
        const alCargar = vi.fn();
        render(<ListaCasos tipo="pendiente" items={[base(1), base(2)]} total={5} seleccionadoId={2} onSeleccionar={alSeleccionar} onCargarMas={alCargar} />);
        const filas = screen.getAllByRole('button', { name: /Ana Perez/ });
        expect(filas[1]).toHaveAttribute('aria-current', 'true');
        await userEvent.click(filas[0]);
        expect(alSeleccionar).toHaveBeenCalledWith(expect.objectContaining({ id_asistencia: 1 }));
        await userEvent.click(screen.getByRole('button', { name: 'Ver más' }));
        expect(alCargar).toHaveBeenCalled();
    });

    it('con todos los casos cargados no ofrece «Ver más»', () => {
        render(<ListaCasos tipo="pendiente" items={[base(1)]} total={1} onSeleccionar={() => {}} onCargarMas={() => {}} />);
        expect(screen.queryByRole('button', { name: 'Ver más' })).toBeNull();
    });
});
