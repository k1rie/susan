// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import RevisionCierre from './RevisionCierre.jsx';

const sesion = { id_sesion: 19, estatus: 'abierta', modo_registro: 'automatico', en_ventana: false, fase: 'fuera_de_ventana', minuto_actual: 21, tolerancia_min: 20, limite_presente_min: 10 };
const alumnos = [
    { id_alumno: 1, matricula: 'E1', nombre: 'Ana', inscripcion: 'activa', estado: null, lecturas_validas: 0, consentimiento_vigente: true },
    { id_alumno: 2, matricula: 'E2', nombre: 'Beto', inscripcion: 'activa', estado: 'presente', origen: 'automatico', lecturas_validas: 3, hora_registro: '2026-09-14T13:03:00+00:00', consentimiento_vigente: true },
];
const camaras = [{ id_camara: 2, tipo: 'navegador', estatus: 'activa', posicion: 'frente', capturas: 4, ultima_captura: null }];
const totales = { inscritos: 2, presentes: 1, retardos: 0, sin_registro: 1, pendientes: 0, capturas: 4, detecciones: 9, detecciones_validas: 6 };

const montar = (extra = {}) => {
    const p = { data: { sesion, camaras, alumnos, totales }, onVolver: vi.fn(), onCerrar: vi.fn(), onRegistrar: vi.fn(), ...extra };
    render(<RevisionCierre {...p} />);
    return p;
};

describe('RevisionCierre', () => {
    it('la tarjeta de decisión va primero, con el cierre como acción primaria y «Volver a la cámara» como secundaria', () => {
        montar();
        const cierre = screen.getByRole('region', { name: 'Cierre del pase de lista' });
        expect(within(cierre).getByRole('heading', { name: 'Falta 1 alumno por registrar' })).toBeInTheDocument();
        const cerrar = within(cierre).getByRole('button', { name: 'Cerrar pase de lista' });
        const volver = within(cierre).getByRole('button', { name: 'Volver a la cámara' });
        expect(cerrar).toHaveClass('bg-primary');
        expect(volver).not.toHaveClass('bg-primary');
        expect(cierre.compareDocumentPosition(screen.getByRole('group', { name: 'Asistencia de la sesión' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('cerrar y volver llaman a sus acciones', () => {
        const p = montar();
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar pase de lista' }));
        fireEvent.click(screen.getByRole('button', { name: 'Volver a la cámara' }));
        expect(p.onCerrar).toHaveBeenCalledTimes(1);
        expect(p.onVolver).toHaveBeenCalledTimes(1);
    });

    it('con la tolerancia en curso el cierre está bloqueado, con su motivo como descripción, y no llama a onCerrar', () => {
        const p = montar({ data: { sesion: { ...sesion, en_ventana: true, minuto_actual: 5 }, camaras, alumnos, totales } });
        const cerrar = screen.getByRole('button', { name: 'Cerrar pase de lista' });
        expect(cerrar).toBeDisabled();
        expect(cerrar).toHaveAccessibleDescription(/faltan 15 min/);
        fireEvent.click(cerrar);
        expect(p.onCerrar).not.toHaveBeenCalled();
    });

    it('registrar a un alumno desde su fila avisa a quién', () => {
        const p = montar();
        fireEvent.click(screen.getByRole('button', { name: 'Registrar manualmente a Ana' }));
        expect(p.onRegistrar).toHaveBeenCalledWith(alumnos[0]);
    });

    it('el detalle va plegado y sin montar: no hay tabla ni cámaras hasta abrirlo', () => {
        montar();
        expect(screen.queryByRole('table')).toBeNull();
        expect(screen.queryByRole('region', { name: 'Cámaras del aula' })).toBeNull();
        const abrir = screen.getByRole('button', { name: /Más detalle de la sesión/ });
        expect(abrir).toHaveAttribute('aria-expanded', 'false');
        fireEvent.click(abrir);
        expect(abrir).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('table', { name: 'Alumnos inscritos' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Cámaras del aula' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Lecturas por alumno' })).toBeInTheDocument();
    });

    it('sin cámaras ni alumnos no se rompe', () => {
        montar({ data: { sesion, alumnos: [], totales: {} } });
        expect(screen.getByRole('heading', { name: 'Todos los alumnos tienen registro' })).toBeInTheDocument();
        expect(screen.getByText('El grupo no tiene alumnos inscritos.')).toBeInTheDocument();
    });
});
