// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import { ahora } from '@/lib/api/plataforma.js';
import { abrirSesion, docentePanel } from '@/lib/api/sesiones.js';
import PasarLista from './PasarLista.jsx';

const replace = vi.fn();
// Como el de Next: useRouter() devuelve SIEMPRE el mismo objeto (si no, el efecto que abre la sesión se repetiría en cada render).
const router = { replace, push: vi.fn() };
vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/lib/api/sesiones.js', () => ({ docentePanel: vi.fn(), abrirSesion: vi.fn() }));
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: vi.fn() }));

const ses = (id, extra = {}) => ({
    id_sesion: id, id_grupo: 1, materia: 'Finanzas', clave_grupo: '3A', aula: 'A-101', fecha: '2026-09-14',
    hora_inicio: '07:00:00', hora_fin: '08:00:00', estatus: 'programada', modo_previsto: 'automatico', camaras_activas: 1, abrible: false, ...extra,
});
const panel = (sesiones) => ({ fecha: '2026-09-14', sesiones_hoy: sesiones, pendientes: 0, justificantes_por_resolver: 0, alertas: [], grupos: [] });
const RELOJ = { ahora: '2026-09-14T13:12:00Z', zona: 'America/Mexico_City', fecha: '2026-09-14', hora: '07:12:00', dia_semana: 1, reloj_simulado: true };
const error = (code, message) => new ApiError({ code, message, status: 409 });

const preparar = (sesiones, hora = RELOJ) => {
    docentePanel.mockResolvedValue(panel(sesiones));
    ahora.mockResolvedValue(hora);
};

describe('PasarLista: una sola sesión candidata', () => {
    it('programada dentro de su horario: muestra «Abriendo la sesión…», la abre y navega con ?pasar-lista=1 (replace)', async () => {
        preparar([ses(115, { abrible: true })]);
        let abrir;
        abrirSesion.mockReturnValue(new Promise((resolve) => { abrir = resolve; }));
        render(<PasarLista />);
        expect(await screen.findByText('Abriendo la sesión…')).toBeInTheDocument();
        expect(screen.getByRole('status')).toBeInTheDocument(); // el indicador de carga (uno solo, sin anidar)
        await waitFor(() => expect(abrirSesion).toHaveBeenCalledTimes(1));
        expect(abrirSesion).toHaveBeenCalledWith({ idSesion: 115 });
        expect(replace).not.toHaveBeenCalled(); // todavía no: la sesión se está abriendo
        abrir({ id_sesion: 115, estatus: 'abierta', ya_abierta: false });
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente/sesiones/115?pasar-lista=1'));
        expect(replace).toHaveBeenCalledTimes(1);
    });

    it('ya abierta: no vuelve a abrirla, entra directo', async () => {
        preparar([ses(19, { estatus: 'abierta' })]);
        render(<PasarLista />);
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente/sesiones/19?pasar-lista=1'));
        expect(abrirSesion).not.toHaveBeenCalled();
    });

    it('las sesiones cerradas o futuras no cuentan: con una abierta y otras no abribles, entra a la abierta', async () => {
        preparar([ses(1, { estatus: 'cerrada', hora_inicio: '06:00:00', hora_fin: '06:50:00' }), ses(19, { estatus: 'abierta' }), ses(30, { hora_inicio: '11:00:00', hora_fin: '12:00:00' })]);
        render(<PasarLista />);
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente/sesiones/19?pasar-lista=1'));
    });
});

describe('PasarLista: varias sesiones candidatas', () => {
    const dos = [
        ses(19, { estatus: 'abierta', materia: 'Finanzas', clave_grupo: '3A' }),
        ses(115, { abrible: true, materia: 'Auditoría', clave_grupo: '5C', hora_inicio: '07:30:00', hora_fin: '09:00:00', camaras_activas: 0, modo_previsto: 'manual', aula: 'B-2' }),
    ];

    it('muestra una tarjeta grande por sesión y NO navega sola', async () => {
        preparar(dos);
        render(<PasarLista />);
        expect(await screen.findByRole('heading', { level: 2, name: 'Finanzas (3A)' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Auditoría (5C)' })).toBeInTheDocument();
        expect(screen.getByText(/Tienes 2 sesiones disponibles ahora/)).toBeInTheDocument();
        expect(screen.getByText('Cámara del aula lista')).toBeInTheDocument();
        expect(screen.getByText('Sin cámara activa: se pasa lista a mano')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Continuar pase de lista: Finanzas/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Abrir y pasar lista: Auditoría/ })).toBeInTheDocument();
        expect(abrirSesion).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
    });

    it('elegir la programada la abre y entra; elegir la abierta entra sin abrir', async () => {
        const user = userEvent.setup();
        preparar(dos);
        abrirSesion.mockResolvedValue({ id_sesion: 115, estatus: 'abierta', ya_abierta: false });
        const { unmount } = render(<PasarLista />);
        await user.click(await screen.findByRole('button', { name: /Abrir y pasar lista: Auditoría/ }));
        await waitFor(() => expect(abrirSesion).toHaveBeenCalledWith({ idSesion: 115 }));
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente/sesiones/115?pasar-lista=1'));
        unmount();

        replace.mockClear();
        abrirSesion.mockClear();
        render(<PasarLista />);
        await user.click(await screen.findByRole('button', { name: /Continuar pase de lista: Finanzas/ }));
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente/sesiones/19?pasar-lista=1'));
        expect(abrirSesion).not.toHaveBeenCalled();
    });

    it('mientras se abre una, las demás tarjetas quedan bloqueadas', async () => {
        const user = userEvent.setup();
        preparar(dos);
        abrirSesion.mockReturnValue(new Promise(() => {}));
        render(<PasarLista />);
        await user.click(await screen.findByRole('button', { name: /Abrir y pasar lista: Auditoría/ }));
        await waitFor(() => expect(screen.getByRole('button', { name: /Continuar pase de lista: Finanzas/ })).toBeDisabled());
    });

    it('si abrir falla, el error aparece sobre las tarjetas y se puede elegir de nuevo', async () => {
        const user = userEvent.setup();
        preparar(dos);
        abrirSesion
            .mockRejectedValueOnce(error('FUERA_DE_HORARIO', 'La sesión solo puede abrirse de 07:30 a 09:00 del 2026-09-14 (hora del plantel).'))
            .mockResolvedValueOnce({ id_sesion: 115, estatus: 'abierta', ya_abierta: false });
        render(<PasarLista />);
        await user.click(await screen.findByRole('button', { name: /Abrir y pasar lista: Auditoría/ }));
        const alerta = await screen.findByRole('alert');
        expect(alerta).toHaveTextContent('La sesión está fuera de su horario');
        expect(alerta).toHaveTextContent('07:30 a 09:00');
        // las tarjetas siguen ahí y desbloqueadas
        const tarjeta = screen.getByRole('button', { name: /Abrir y pasar lista: Auditoría/ });
        expect(tarjeta).toBeEnabled();
        await user.click(tarjeta);
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente/sesiones/115?pasar-lista=1'));
        expect(abrirSesion).toHaveBeenCalledTimes(2);
    });
});

describe('PasarLista: ninguna sesión candidata', () => {
    const enlaces = () => ({
        sesiones: screen.getByRole('link', { name: 'Ver sesiones de hoy' }),
        revision: screen.getByRole('link', { name: 'Ir a Revisión' }),
    });

    it('sin clases hoy: lo explica y ofrece las sesiones de hoy y Revisión', async () => {
        preparar([]);
        render(<PasarLista />);
        expect(await screen.findByText('Hoy no tienes clases programadas')).toBeInTheDocument();
        expect(enlaces().sesiones).toHaveAttribute('href', '/docente#sesiones-hoy');
        expect(enlaces().revision).toHaveAttribute('href', '/docente/revision');
        expect(abrirSesion).not.toHaveBeenCalled();
        expect(replace).not.toHaveBeenCalled();
    });

    it('fuera de horario (aún no es hora): dice cuándo se puede abrir', async () => {
        preparar([ses(115, { hora_inicio: '11:00:00', hora_fin: '12:00:00' })]);
        render(<PasarLista />);
        expect(await screen.findByText('Todavía no es hora de pasar lista')).toBeInTheDocument();
        expect(screen.getByText(/Finanzas \(3A\) se puede abrir de 11:00 a 12:00/)).toBeInTheDocument();
        enlaces();
    });

    it('horario vencido: explica que ya no puede abrirse', async () => {
        preparar([ses(115, { hora_inicio: '05:00:00', hora_fin: '06:00:00' })]);
        render(<PasarLista />);
        expect(await screen.findByText('El horario de la sesión ya terminó')).toBeInTheDocument();
    });

    it('todo cerrado', async () => {
        preparar([ses(1, { estatus: 'cerrada' })]);
        render(<PasarLista />);
        expect(await screen.findByText('Ya cerraste las sesiones de hoy')).toBeInTheDocument();
    });

    it('espera la hora del plantel antes de explicar el motivo (no muestra un motivo impreciso)', async () => {
        docentePanel.mockResolvedValue(panel([ses(115, { hora_inicio: '05:00:00', hora_fin: '06:00:00' })]));
        let resolverReloj;
        ahora.mockReturnValue(new Promise((resolve) => { resolverReloj = resolve; }));
        render(<PasarLista />);
        expect(await screen.findByText('Revisando tus sesiones de hoy…')).toBeInTheDocument();
        expect(screen.queryByText('Todavía no es hora de pasar lista')).toBeNull();
        resolverReloj(RELOJ);
        expect(await screen.findByText('El horario de la sesión ya terminó')).toBeInTheDocument();
    });
});

describe('PasarLista: errores al abrir (una sola candidata)', () => {
    it('FUERA_DE_HORARIO: mensaje comprensible con la ventana, reintento y salida a las sesiones de hoy; reintentar abre y navega', async () => {
        const user = userEvent.setup();
        preparar([ses(115, { abrible: true })]);
        abrirSesion
            .mockRejectedValueOnce(error('FUERA_DE_HORARIO', 'La sesión solo puede abrirse de 07:00 a 08:00 del 2026-09-14 (hora del plantel).'))
            .mockResolvedValueOnce({ id_sesion: 115, estatus: 'abierta', ya_abierta: false });
        render(<PasarLista />);
        const alerta = await screen.findByRole('alert');
        expect(within(alerta).getByText('La sesión está fuera de su horario')).toBeInTheDocument();
        expect(alerta).toHaveTextContent('de 07:00 a 08:00 del 2026-09-14');
        expect(screen.queryByText('Abriendo la sesión…')).toBeNull();
        expect(screen.getByRole('link', { name: 'Ver sesiones de hoy' })).toHaveAttribute('href', '/docente#sesiones-hoy');
        expect(replace).not.toHaveBeenCalled();

        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente/sesiones/115?pasar-lista=1'));
        expect(abrirSesion).toHaveBeenCalledTimes(2);
    });

    it('SESION_CERRADA: sin reintento; ofrece ver los resultados', async () => {
        preparar([ses(115, { abrible: true })]);
        abrirSesion.mockRejectedValue(error('SESION_CERRADA', 'La sesión ya fue cerrada; no puede abrirse de nuevo.'));
        render(<PasarLista />);
        expect(await screen.findByText('La sesión ya está cerrada')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
        expect(screen.getByRole('link', { name: 'Ver resultados' })).toHaveAttribute('href', '/docente/sesiones/115');
    });

    it('un error de red se puede reintentar', async () => {
        preparar([ses(115, { abrible: true })]);
        abrirSesion.mockRejectedValue(error('ERROR_RED', 'No se pudo conectar con el servidor.'));
        render(<PasarLista />);
        expect(await screen.findByText('No se pudo abrir la sesión')).toBeInTheDocument();
        expect(screen.getByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    });
});

describe('PasarLista: error al cargar el panel', () => {
    it('muestra el error con reintento y no intenta abrir nada', async () => {
        docentePanel.mockRejectedValue(error('ERROR_INTERNO', 'Ocurrió un error inesperado.'));
        ahora.mockResolvedValue(RELOJ);
        render(<PasarLista />);
        expect(await screen.findByText('No se pudo cargar')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
        expect(abrirSesion).not.toHaveBeenCalled();
    });
});

describe('PasarLista con ?sesion=<id> (idSesionInicial)', () => {
    it('abre esa sesión sin consultar el panel y navega con ?pasar-lista=1', async () => {
        abrirSesion.mockResolvedValue({ id_sesion: 115, estatus: 'abierta', ya_abierta: false });
        render(<PasarLista idSesionInicial={115} />);
        expect(screen.getByText('Abriendo la sesión…')).toBeInTheDocument();
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente/sesiones/115?pasar-lista=1'));
        expect(abrirSesion).toHaveBeenCalledWith({ idSesion: 115 });
        expect(docentePanel).not.toHaveBeenCalled();
        expect(ahora).not.toHaveBeenCalled();
    });

    it('si falla, muestra el error con reintento (y reintentar vuelve a abrir)', async () => {
        const user = userEvent.setup();
        abrirSesion
            .mockRejectedValueOnce(error('FUERA_DE_HORARIO', 'La sesión solo puede abrirse de 09:00 a 10:00 del 2026-09-14 (hora del plantel).'))
            .mockResolvedValueOnce({ id_sesion: 115, estatus: 'abierta', ya_abierta: true });
        render(<PasarLista idSesionInicial={115} />);
        expect(await screen.findByRole('alert')).toHaveTextContent('de 09:00 a 10:00');
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        await waitFor(() => expect(replace).toHaveBeenCalledWith('/docente/sesiones/115?pasar-lista=1'));
    });

    it('SESION_SUSPENDIDA: ofrece ver la sesión (donde se puede reanudar)', async () => {
        abrirSesion.mockRejectedValue(error('SESION_SUSPENDIDA', 'La sesión está suspendida; reanúdala antes de abrirla.'));
        render(<PasarLista idSesionInicial={7} />);
        expect(await screen.findByText('La sesión está suspendida')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ver sesión' })).toHaveAttribute('href', '/docente/sesiones/7');
        expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull();
    });
});

describe('PasarLista: encabezado', () => {
    it('trae un único h1 «Pasar lista» y el enlace para volver al panel', async () => {
        preparar([]);
        render(<PasarLista />);
        expect(screen.getByRole('heading', { level: 1, name: 'Pasar lista' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Volver al panel' })).toHaveAttribute('href', '/docente');
        await screen.findByText('Hoy no tienes clases programadas');
    });
});
