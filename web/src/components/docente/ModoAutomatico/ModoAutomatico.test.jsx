// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ahora } from '@/lib/api/plataforma.js';
import { abrirSesion, docentePanel, sesionMonitor } from '@/lib/api/sesiones.js';
import ModoAutomatico from './ModoAutomatico.jsx';

const router = { replace: vi.fn(), push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/api/sesiones.js', () => ({ docentePanel: vi.fn(), abrirSesion: vi.fn(), sesionMonitor: vi.fn() }));
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: vi.fn() }));
// La captura real (cámara, muestreo) tiene sus propias pruebas: aquí basta saber qué sesión recibe.
vi.mock('@/components/sesion/CapturaContinua', () => ({
    default: (props) => <div data-testid="captura" data-sesion={props.sesion.id_sesion} data-activo={String(props.activo)} />,
}));

const ses = (id, inicio, fin, extra = {}) => ({
    id_sesion: id, id_grupo: 1, materia: 'Finanzas', clave_grupo: `G${id}`, aula: 'A-101', fecha: '2026-09-14',
    hora_inicio: `${inicio}:00`, hora_fin: `${fin}:00`, estatus: 'programada', modo_previsto: 'automatico', camaras_activas: 1, abrible: false, ...extra,
});
const reloj = (hora) => ({ ahora: '2026-09-14T16:25:00Z', zona: 'America/Mexico_City', fecha: '2026-09-14', hora, dia_semana: 1, reloj_simulado: false });
const monitor = (id, enVentana = true) => ({ sesion: { id_sesion: id, estatus: 'abierta', en_ventana: enVentana, intervalo_muestreo_seg: 1 }, camaras: [], alumnos: [], totales: {} });

const preparar = (sesiones, hora) => {
    docentePanel.mockResolvedValue({ fecha: '2026-09-14', sesiones_hoy: sesiones, pendientes: 0, justificantes_por_resolver: 0, alertas: [], grupos: [] });
    ahora.mockResolvedValue(reloj(hora));
};

beforeEach(() => {
    vi.clearAllMocks();
    sesionMonitor.mockImplementation(async ({ idSesion }) => monitor(idSesion));
    abrirSesion.mockImplementation(async ({ idSesion }) => ({ id_sesion: idSesion, estatus: 'abierta', ya_abierta: false }));
});

describe('ModoAutomatico', () => {
    it('no consulta nada hasta «Iniciar», y al iniciar pide pantalla completa', async () => {
        preparar([], '10:25:00');
        const requestFullscreen = vi.fn().mockResolvedValue();
        document.documentElement.requestFullscreen = requestFullscreen;
        render(<ModoAutomatico />);
        expect(docentePanel).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole('button', { name: 'Iniciar' }));
        expect(requestFullscreen).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(docentePanel).toHaveBeenCalled());
        delete document.documentElement.requestFullscreen;
    });

    it('abre la clase que empezó más recientemente y muestra su captura', async () => {
        preparar([ses(1, '09:40', '10:40', { estatus: 'abierta' }), ses(2, '10:20', '11:20', { abrible: true }), ses(3, '10:40', '11:40')], '10:25:00');
        render(<ModoAutomatico iniciarAlCargar />);
        const captura = await screen.findByTestId('captura');
        expect(captura).toHaveAttribute('data-sesion', '2');
        expect(abrirSesion).toHaveBeenCalledWith({ idSesion: 2 });
        expect(screen.getByRole('heading', { name: 'Finanzas (G2)' })).toBeInTheDocument();
    });

    it('una clase ya abierta no se vuelve a abrir', async () => {
        preparar([ses(5, '10:00', '11:00', { estatus: 'abierta' })], '10:05:00');
        render(<ModoAutomatico iniciarAlCargar />);
        expect((await screen.findByTestId('captura'))).toHaveAttribute('data-sesion', '5');
        expect(abrirSesion).not.toHaveBeenCalled();
    });

    it('terminada la ventana de captura, espera la siguiente clase', async () => {
        preparar([ses(5, '10:00', '11:00', { estatus: 'abierta' }), ses(6, '11:00', '12:00')], '10:30:00');
        sesionMonitor.mockResolvedValue(monitor(5, false));
        render(<ModoAutomatico iniciarAlCargar />);
        expect(await screen.findByText('Terminó la ventana de captura de esta clase')).toBeInTheDocument();
        expect(screen.getByText('Siguiente: Finanzas (G6) a las 11:00. Empezará sola.')).toBeInTheDocument();
        expect(screen.queryByTestId('captura')).toBeNull();
    });

    it('sin clase en curso dice cuál sigue; sin más clases, que ya no quedan', async () => {
        preparar([ses(6, '11:00', '12:00')], '10:30:00');
        const { unmount } = render(<ModoAutomatico iniciarAlCargar />);
        expect(await screen.findByText('No hay una clase en curso')).toBeInTheDocument();
        expect(screen.getByText(/Siguiente: Finanzas \(G6\) a las 11:00/)).toBeInTheDocument();
        unmount();
        preparar([], '10:30:00');
        render(<ModoAutomatico iniciarAlCargar />);
        expect(await screen.findByText('No quedan clases con cámara hoy.')).toBeInTheDocument();
    });

    it('«Salir» vuelve al panel', async () => {
        preparar([], '10:30:00');
        render(<ModoAutomatico iniciarAlCargar />);
        await userEvent.click(await screen.findByRole('button', { name: 'Salir' }));
        await waitFor(() => expect(router.push).toHaveBeenCalledWith('/docente'));
    });
});
