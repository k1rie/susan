// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SesionClase from './SesionClase.jsx';
import { ApiError } from '@/lib/api/errors.js';
import { ahora } from '@/lib/api/plataforma.js';
import { abrirSesion, sesionMonitor } from '@/lib/api/sesiones.js';

vi.mock('@/lib/api/sesiones.js', () => ({ sesionMonitor: vi.fn(), abrirSesion: vi.fn(), cerrarSesion: vi.fn(), registrarManual: vi.fn(), paseListaManual: vi.fn() }));
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: vi.fn() }));
vi.mock('@/lib/http/captura.js', () => ({ enviarCaptura: vi.fn(() => new Promise(() => {})) }));
vi.mock('@/lib/local/relojCliente.js', () => ({ leerRelojDemo: vi.fn(), cambiarRelojDemo: vi.fn() }));
vi.mock('@/components/ui/CameraCapture', () => ({ default: () => <div>Camara simulada</div> }));

const base = { aula: 'A-12', materia: 'Administracion Financiera', clave_grupo: '3A', fecha: '2026-09-14', hora_inicio: '07:00:00', hora_fin: '08:00:00', id_sesion: 19, tolerancia_min: 20, limite_presente_min: 10, intervalo_muestreo_seg: 15 };
const alumnos = [
    { id_alumno: 1, matricula: 'E1', nombre: 'Ana', inscripcion: 'activa', estado: null, origen: null, lecturas_validas: 0, mejor_score: null, consentimiento_vigente: true },
    { id_alumno: 2, matricula: 'E2', nombre: 'Beto', inscripcion: 'activa', estado: 'presente', origen: 'automatico', lecturas_validas: 3, mejor_score: 0.81, hora_registro: '2026-09-14T13:03:00+00:00', consentimiento_vigente: true },
];
const camaras = [{ id_camara: 2, tipo: 'navegador', estatus: 'activa', posicion: 'frente', capturas: 0, ultima_captura: null }];
const totales = { inscritos: 2, presentes: 1, retardos: 0, sin_registro: 1, pendientes: 0, capturas: 0, detecciones: 0, detecciones_validas: 0 };
const abiertaAuto = (extra = {}) => ({ sesion: { ...base, estatus: 'abierta', modo_registro: 'automatico', en_ventana: true, fase: 'presente', minuto_actual: 5 }, camaras, alumnos, totales, ...extra });
const programada = (extra = {}) => ({ sesion: { ...base, estatus: 'programada', modo_registro: 'automatico', en_ventana: false, fase: 'programada', minuto_actual: null }, camaras, alumnos, totales, ...extra });

const delante = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

beforeEach(() => {
    sesionMonitor.mockReset();
    abrirSesion.mockReset();
    ahora.mockReset().mockResolvedValue({ hora: '07:05:00', fecha: '2026-09-14', reloj_simulado: false });
});

describe('SesionClase: sesión automática abierta (se pasa lista aquí)', () => {
    it('el encabezado dice «Pasar lista», con materia y grupo, hora, aula y los chips de estado y modo', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: 'Pasar lista' })).toBeInTheDocument());
        expect(screen.getAllByText('Abierta').length).toBeGreaterThan(0);
        expect(screen.getAllByText('Automático').length).toBeGreaterThan(0);
        expect(screen.getByText(/Administracion Financiera \(3A\)/)).toHaveTextContent('14 sep 2026 · 07:00 a 08:00 · Aula A-12');
        expect(screen.getByRole('link', { name: 'Volver al panel' })).toHaveAttribute('href', '/docente');
    });

    it('el panel de pase de lista va PRIMERO: antes de las cifras, las gráficas y la tabla', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        const panel = await screen.findByRole('region', { name: 'Pase de lista con cámara' });
        const cifras = screen.getAllByText('Inscritos')[0];
        const grafica = screen.getByRole('group', { name: 'Asistencia de la sesión' });
        const tabla = screen.getByRole('table', { name: 'Alumnos inscritos' });
        expect(delante(panel, cifras)).toBe(true);
        expect(delante(panel, grafica)).toBe(true);
        expect(delante(panel, tabla)).toBe(true);
        // El panel es lo primero después del encabezado: lo precede solo el h1.
        expect(delante(screen.getByRole('heading', { level: 1 }), panel)).toBe(true);
    });

    it('el panel trae la cifra «N de M presentes», el chip de estado y las acciones; el cierre, bloqueado con su motivo', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        const { container } = render(<SesionClase idSesion={19} />);
        const panel = await screen.findByRole('region', { name: 'Pase de lista con cámara' });
        expect(within(panel).getByRole('status')).toHaveTextContent('En pausa');
        expect(container.querySelector('p[aria-live]')).toHaveTextContent('1 de 2 presentes');
        const cerrar = within(panel).getByRole('button', { name: 'Cerrar pase de lista' });
        expect(cerrar).toBeDisabled();
        expect(cerrar).toHaveAccessibleDescription('El cierre se habilita al terminar la tolerancia: faltan 15 min.');
        expect(within(panel).getByRole('button', { name: 'Registrar manualmente' })).toBeInTheDocument();
    });

    it('monitor con alumnos: «Sin lecturas» y el registro manual por fila (el motivo viaja con el botón)', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        await waitFor(() => expect(screen.getByText('Sin lecturas')).toBeTruthy());
        expect(screen.getByText('3/3')).toBeTruthy();
        // Uno del panel y uno de la fila de Ana (sin lecturas válidas).
        expect(screen.getAllByRole('button', { name: 'Registrar manualmente' })).toHaveLength(2);
        expect(screen.getAllByText('Sin lecturas válidas')).toHaveLength(1);
    });

    it('4 cifras con icono (Inscritos, Presentes, Retardos, Sin registro), anillo, medidor y actividad (sin los 8 contadores)', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto({ totales: { ...totales, capturas: 12, detecciones: 40, detecciones_validas: 31 } }));
        render(<SesionClase idSesion={19} />);
        await waitFor(() => expect(screen.getByText('Sin lecturas')).toBeTruthy());
        for (const etiqueta of ['Inscritos', 'Presentes', 'Retardos', 'Sin registro']) {
            const tarjeta = screen.getAllByText(etiqueta).map((n) => n.closest('div.group\\/stat, div.rounded-xl')).find((n) => n?.querySelector('svg'));
            expect(tarjeta, etiqueta).toBeTruthy();
            expect(tarjeta.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        }
        expect(screen.queryByText('Detecciones validas')).toBeNull();
        expect(screen.getByRole('group', { name: 'Asistencia de la sesión' })).toHaveAccessibleDescription('Presentes: 1 (50 %); Retardos: 0 (0 %); Sin registro: 1 (50 %); Pendientes: 0 (0 %)');
        expect(screen.getByRole('group', { name: 'Actividad de reconocimiento' })).toHaveAccessibleDescription('Capturas: 12; Detecciones: 40; Det. válidas: 31');
        expect(within(screen.getByRole('group', { name: 'Asistencia de la sesión' })).getByRole('meter', { name: 'Presentes ahora: 50 %' })).toHaveAccessibleDescription('1 de 2 inscritos');
        expect(screen.getByRole('progressbar', { name: 'Avance de la ventana de tolerancia' })).toHaveAttribute('aria-valuenow', '25');
    });

    it('sin actividad, la gráfica de actividad avisa en lugar de quedar vacía', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        await waitFor(() => expect(screen.getByText('Aún sin capturas')).toBeTruthy());
        expect(screen.getByRole('group', { name: 'Actividad de reconocimiento' })).toHaveAccessibleDescription('Aún no hay capturas ni detecciones.');
    });

    it('terminada la tolerancia: el cierre se habilita y abre la confirmación', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto({ sesion: { ...base, estatus: 'abierta', modo_registro: 'automatico', en_ventana: false, fase: 'fuera_de_ventana', minuto_actual: 21 } }));
        render(<SesionClase idSesion={19} />);
        const cerrar = await screen.findByRole('button', { name: 'Cerrar pase de lista' });
        expect(cerrar).toBeEnabled();
        expect(screen.getAllByRole('status')[0]).toHaveTextContent('Fuera de la ventana');
        fireEvent.click(cerrar);
        expect(await screen.findByText('Los alumnos sin lecturas quedan como ausentes.')).toBeInTheDocument();
    });

    it('«Registrar manualmente» del panel abre el diálogo de registro', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        const panel = await screen.findByRole('region', { name: 'Pase de lista con cámara' });
        fireEvent.click(within(panel).getByRole('button', { name: 'Registrar manualmente' }));
        expect(await screen.findByRole('dialog')).toHaveTextContent('Registrar manualmente');
    });
});

describe('SesionClase: llegar con ?pasar-lista=1', () => {
    it('muestra la guía de 3 pasos y enfoca el panel', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} pasarLista />);
        const guia = await screen.findByRole('region', { name: 'Así se pasa lista' });
        const pasos = within(guia).getAllByRole('listitem');
        expect(pasos).toHaveLength(3);
        expect(pasos[0]).toHaveTextContent('Sesión abierta');
        expect(pasos[1]).toHaveTextContent('Apunta la cámara al grupo');
        expect(pasos[2]).toHaveTextContent('Revisa y cierra');
        expect(screen.getByRole('region', { name: 'Pase de lista con cámara' })).toHaveFocus();
        // La guía va antes del panel.
        expect(delante(guia, screen.getByRole('region', { name: 'Pase de lista con cámara' }))).toBe(true);
    });

    it('la guía se puede descartar y no vuelve con el siguiente sondeo', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} pasarLista />);
        await screen.findByRole('region', { name: 'Así se pasa lista' });
        fireEvent.click(screen.getByRole('button', { name: 'Ocultar la guía' }));
        expect(screen.queryByRole('region', { name: 'Así se pasa lista' })).toBeNull();
        expect(screen.getByRole('region', { name: 'Pase de lista con cámara' })).toBeInTheDocument();
    });

    it('sin el parámetro no hay guía ni foco forzado', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        const panel = await screen.findByRole('region', { name: 'Pase de lista con cámara' });
        expect(screen.queryByRole('region', { name: 'Así se pasa lista' })).toBeNull();
        expect(panel).not.toHaveFocus();
    });

    it('en una sesión manual la guía habla de marcar y guardar', async () => {
        sesionMonitor.mockResolvedValue({ sesion: { ...base, estatus: 'abierta', modo_registro: 'manual', en_ventana: true, fase: 'presente', minuto_actual: 5 }, camaras: [], alumnos, totales });
        render(<SesionClase idSesion={19} pasarLista />);
        const guia = await screen.findByRole('region', { name: 'Así se pasa lista' });
        expect(guia).toHaveTextContent('Marca a cada alumno');
        expect(guia).toHaveTextContent('Guarda y cierra');
    });

    it('en una sesión cerrada o programada la guía no aplica', async () => {
        sesionMonitor.mockResolvedValue(programada());
        render(<SesionClase idSesion={19} pasarLista />);
        await screen.findByRole('button', { name: 'Abrir sesión y pasar lista' });
        expect(screen.queryByRole('region', { name: 'Así se pasa lista' })).toBeNull();
    });
});

describe('SesionClase: sesión manual abierta', () => {
    const manual = () => ({ sesion: { ...base, estatus: 'abierta', modo_registro: 'manual', en_ventana: true, fase: 'presente', minuto_actual: 15 }, camaras: [], alumnos, totales });

    it('el encabezado es «Pasar lista (manual)» y el pase manual es el contenido principal, con aviso', async () => {
        sesionMonitor.mockResolvedValue(manual());
        render(<SesionClase idSesion={19} />);
        await waitFor(() => expect(screen.getByText('Sesión en modo manual')).toBeTruthy());
        expect(screen.getByRole('heading', { level: 1, name: 'Pasar lista (manual)' })).toBeInTheDocument();
        expect(screen.getByRole('progressbar', { name: 'Alumnos marcados' })).toHaveAttribute('aria-valuetext', '1 de 2');
        // La sugerencia por hora se dice una vez (minuto 15 = retardo), no en una columna por fila.
        expect(screen.getByText('Sugerido a esta hora').parentElement).toHaveTextContent('Sugerido a esta hora Retardo');
        expect(screen.queryByRole('columnheader', { name: 'Sugerido' })).toBeNull();
    });

    it('con la misma jerarquía de acciones: una primaria (guardar y cerrar) y secundarias', async () => {
        sesionMonitor.mockResolvedValue(manual());
        render(<SesionClase idSesion={19} />);
        const primaria = await screen.findByRole('button', { name: 'Guardar y cerrar sesión de clase' });
        expect(primaria).toHaveClass('bg-primary');
        const guardar = screen.getByRole('button', { name: 'Guardar' });
        const marcar = screen.getByRole('button', { name: 'Marcar restantes según la hora' });
        expect(guardar).not.toHaveClass('bg-primary');
        expect(marcar).not.toHaveClass('bg-primary');
        // La primaria va primero; en teléfono todas ocupan el ancho completo.
        expect(delante(primaria, guardar)).toBe(true);
        for (const b of [primaria, guardar, marcar]) expect(b).toHaveClass('w-full');
    });
});

describe('SesionClase: sesión programada', () => {
    it('una tarjeta grande con una sola acción primaria y la explicación de qué se usará', async () => {
        sesionMonitor.mockResolvedValue(programada());
        render(<SesionClase idSesion={19} />);
        expect(await screen.findByRole('heading', { name: 'Esta clase aún no está abierta' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 1, name: 'Pasar lista' })).toBeInTheDocument();
        expect(screen.getByText(/Se usará la cámara del aula/)).toBeInTheDocument();
        expect(screen.getAllByRole('button')).toHaveLength(1);
        // Nada de gráficas ni tablas vacías: lo único que se puede hacer es abrirla.
        expect(screen.queryByRole('table')).toBeNull();
        expect(screen.queryByRole('group', { name: 'Asistencia de la sesión' })).toBeNull();
    });

    it('sin cámaras activas explica que se pasará lista a mano', async () => {
        sesionMonitor.mockResolvedValue(programada({ camaras: [] }));
        render(<SesionClase idSesion={19} />);
        expect(await screen.findByText(/pasarás lista a mano/)).toBeInTheDocument();
    });

    it('«Abrir sesión y pasar lista» abre la sesión y entra al pase con la guía', async () => {
        sesionMonitor.mockResolvedValueOnce(programada()).mockResolvedValue(abiertaAuto());
        abrirSesion.mockResolvedValue({ id_sesion: 19, estatus: 'abierta', modo_registro: 'automatico' });
        render(<SesionClase idSesion={19} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Abrir sesión y pasar lista' }));
        await waitFor(() => expect(abrirSesion).toHaveBeenCalledWith({ idSesion: 19 }));
        // Ya abierta: el panel con la cámara y, como se llegó a pasar lista, la guía.
        expect(await screen.findByRole('region', { name: 'Pase de lista con cámara' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Así se pasa lista' })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Abrir sesión y pasar lista' })).toBeNull();
    });

    it('FUERA_DE_HORARIO: mensaje comprensible y reintento (sin toast aparte)', async () => {
        sesionMonitor.mockResolvedValue(programada());
        abrirSesion.mockRejectedValueOnce(new ApiError({ code: 'FUERA_DE_HORARIO', message: 'Solo se puede abrir entre las 07:00 y las 08:00.', status: 409 })).mockResolvedValue({});
        render(<SesionClase idSesion={19} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Abrir sesión y pasar lista' }));
        const alerta = await screen.findByRole('alert');
        expect(alerta).toHaveTextContent('La sesión está fuera de su horario');
        expect(alerta).toHaveTextContent('Solo se puede abrir entre las 07:00 y las 08:00.');
        fireEvent.click(screen.getByRole('button', { name: 'Reintentar abrir la sesión' }));
        await waitFor(() => expect(abrirSesion).toHaveBeenCalledTimes(2));
    });

    it('si la sesión ya estaba cerrada, vuelve a leerla para mostrar su estado real', async () => {
        sesionMonitor.mockResolvedValueOnce(programada()).mockResolvedValue({ sesion: { ...base, estatus: 'cerrada', modo_registro: 'automatico', en_ventana: false, fase: 'cerrada', minuto_actual: 4000 }, camaras, alumnos, totales: { ...totales, ausentes: 1 } });
        abrirSesion.mockRejectedValue(new ApiError({ code: 'SESION_CERRADA', message: 'cerrada', status: 409 }));
        render(<SesionClase idSesion={19} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Abrir sesión y pasar lista' }));
        expect(await screen.findByText('Justificados')).toBeInTheDocument();
    });
});

describe('SesionClase: sesión cerrada y suspendida', () => {
    it('cerrada: resumen de solo lectura con cifras con icono (CircleCheck, Clock, UserX, FileCheck, ClipboardCheck)', async () => {
        sesionMonitor.mockResolvedValue({ sesion: { ...base, estatus: 'cerrada', modo_registro: 'automatico', en_ventana: false, fase: 'cerrada', minuto_actual: 4000 }, camaras, alumnos, totales: { ...totales, ausentes: 1, justificados: 1, pendientes: 2 } });
        render(<SesionClase idSesion={19} />);
        await waitFor(() => expect(screen.getByText('Justificados')).toBeTruthy());
        expect(screen.getByRole('group', { name: 'Asistencia de la sesión' })).toBeTruthy();
        // En el resumen cerrado el nivel «ahora» ya no tiene sentido: solo el anillo con los cinco estados.
        expect(screen.queryByRole('meter')).toBeNull();
        expect(screen.queryByRole('button', { name: 'Cerrar pase de lista' })).toBeNull();
        expect(screen.queryByRole('region', { name: 'Pase de lista con cámara' })).toBeNull();
        for (const etiqueta of ['Inscritos', 'Presentes', 'Retardos', 'Ausentes', 'Justificados', 'Resolver en Revisión']) {
            const tarjeta = screen.getAllByText(etiqueta).map((n) => n.closest('div.rounded-xl, a.rounded-xl')).find((n) => n?.querySelector('svg'));
            expect(tarjeta, etiqueta).toBeTruthy();
        }
        expect(screen.getByRole('link', { name: /Pendientes.*Resolver en Revisión/ })).toHaveAttribute('href', '/docente/revision?pestana=pendientes');
        // La ficha cerrada conserva el título de siempre (la clase), no «Pasar lista».
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Administracion Financiera (3A)');
    });

    it('cerrada sin pendientes no pinta la tarjeta de pendientes', async () => {
        sesionMonitor.mockResolvedValue({ sesion: { ...base, estatus: 'cerrada', modo_registro: 'automatico', en_ventana: false, fase: 'cerrada', minuto_actual: 4000 }, camaras, alumnos, totales: { ...totales, ausentes: 1 } });
        render(<SesionClase idSesion={19} />);
        await waitFor(() => expect(screen.getByText('Justificados')).toBeTruthy());
        expect(screen.queryByRole('link', { name: /Resolver en Revisión/ })).toBeNull();
    });

    it('suspendida: aviso', async () => {
        sesionMonitor.mockResolvedValue({ sesion: { ...base, estatus: 'suspendida', modo_registro: 'automatico', en_ventana: false, fase: 'suspendida', minuto_actual: null }, camaras, alumnos, totales });
        render(<SesionClase idSesion={19} />);
        expect(await screen.findByText('Sesión suspendida')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Abrir sesión y pasar lista' })).toBeNull();
    });
});

describe('SesionClase: cámara simulada (solo con reloj simulado)', () => {
    it('con el reloj real (producción) no existe', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        await screen.findByRole('region', { name: 'Pase de lista con cámara' });
        await waitFor(() => expect(ahora).toHaveBeenCalled());
        expect(screen.queryByRole('switch')).toBeNull();
        expect(screen.queryByText(/Cámara simulada \(demostración\)/)).toBeNull();
    });

    it('con el reloj simulado aparece dentro del panel', async () => {
        ahora.mockResolvedValue({ hora: '07:12:00', fecha: '2026-09-14', reloj_simulado: true });
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        const interruptor = await screen.findByRole('switch', { name: /Cámara simulada \(demostración\)/ });
        expect(interruptor).toHaveAttribute('aria-checked', 'false');
        expect(within(screen.getByRole('region', { name: 'Pase de lista con cámara' })).getByRole('switch')).toBe(interruptor);
    });

    it('si api_ahora falla, no se asume que el reloj es simulado', async () => {
        ahora.mockRejectedValue(new Error('sin reloj'));
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        await screen.findByRole('region', { name: 'Pase de lista con cámara' });
        expect(screen.queryByRole('switch')).toBeNull();
    });
});

describe('SesionClase: errores de carga', () => {
    it('error de carga muestra ErrorState', async () => {
        sesionMonitor.mockRejectedValue(new Error('boom'));
        render(<SesionClase idSesion={19} />);
        await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
    });
});
