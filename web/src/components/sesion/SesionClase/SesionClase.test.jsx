// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import SesionClase from './SesionClase.jsx';
import { sesionMonitor } from '@/lib/api/sesiones.js';

vi.mock('@/lib/api/sesiones.js', () => ({ sesionMonitor: vi.fn(), abrirSesion: vi.fn(), cerrarSesion: vi.fn(), registrarManual: vi.fn(), paseListaManual: vi.fn() }));
vi.mock('@/lib/http/captura.js', () => ({ enviarCaptura: vi.fn(() => new Promise(() => {})) }));
vi.mock('@/components/ui/CameraCapture', () => ({ default: () => <div>Camara simulada</div> }));

const base = { aula: 'A-12', materia: 'Administracion Financiera', clave_grupo: '3A', fecha: '2026-09-14', hora_inicio: '07:00:00', hora_fin: '08:00:00', id_sesion: 19, tolerancia_min: 20, limite_presente_min: 10, intervalo_muestreo_seg: 15 };
const alumnos = [
    { id_alumno: 1, matricula: 'E1', nombre: 'Ana', inscripcion: 'activa', estado: null, origen: null, lecturas_validas: 0, mejor_score: null, consentimiento_vigente: true },
    { id_alumno: 2, matricula: 'E2', nombre: 'Beto', inscripcion: 'activa', estado: 'presente', origen: 'automatico', lecturas_validas: 3, mejor_score: 0.81, hora_registro: '2026-09-14T13:03:00+00:00', consentimiento_vigente: true },
];
const camaras = [{ id_camara: 2, tipo: 'navegador', estatus: 'activa', posicion: 'frente', capturas: 0, ultima_captura: null }];
const totales = { inscritos: 2, presentes: 1, retardos: 0, sin_registro: 1, pendientes: 0, capturas: 0, detecciones: 0, detecciones_validas: 0 };

describe('SesionClase', () => {
    it('automatica abierta: monitor con alumnos, Sin lecturas y cierre deshabilitado en ventana', async () => {
        sesionMonitor.mockResolvedValue({ sesion: { ...base, estatus: 'abierta', modo_registro: 'automatico', en_ventana: true, fase: 'presente', minuto_actual: 5 }, camaras, alumnos, totales });
        render(<SesionClase idSesion={19} />);
        await waitFor(() => expect(screen.getByText('Sin lecturas')).toBeTruthy());
        expect(screen.getByText('3/3')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Cerrar sesión de clase' }).disabled).toBe(true);
        expect(screen.getAllByRole('button', { name: 'Registrar manualmente' }).length).toBe(2);
    });

    it('manual abierta: pase de lista con aviso', async () => {
        sesionMonitor.mockResolvedValue({ sesion: { ...base, estatus: 'abierta', modo_registro: 'manual', en_ventana: true, fase: 'presente', minuto_actual: 15 }, camaras: [], alumnos, totales });
        render(<SesionClase idSesion={19} />);
        await waitFor(() => expect(screen.getByText('Sesión en modo manual')).toBeTruthy());
        expect(screen.getByRole('button', { name: 'Marcar restantes según la hora' })).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Guardar y cerrar sesión de clase' })).toBeTruthy();
    });

    it('cerrada: resumen de solo lectura', async () => {
        sesionMonitor.mockResolvedValue({ sesion: { ...base, estatus: 'cerrada', modo_registro: 'automatico', en_ventana: false, fase: 'cerrada', minuto_actual: 4000 }, camaras, alumnos, totales: { ...totales, ausentes: 1 } });
        render(<SesionClase idSesion={19} />);
        await waitFor(() => expect(screen.getByText('Justificados')).toBeTruthy());
        expect(screen.queryByRole('button', { name: 'Cerrar sesión de clase' })).toBeNull();
    });

    it('error de carga muestra ErrorState', async () => {
        sesionMonitor.mockRejectedValue(new Error('boom'));
        render(<SesionClase idSesion={19} />);
        await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    });
});
