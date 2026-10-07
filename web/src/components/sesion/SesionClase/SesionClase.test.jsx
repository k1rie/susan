// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SesionClase from './SesionClase.jsx';
import { ApiError } from '@/lib/api/errors.js';
import { ahora } from '@/lib/api/plataforma.js';
import { abrirSesion, cerrarSesion, paseListaManual, sesionMonitor } from '@/lib/api/sesiones.js';

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

// Pasa del paso 2 (la cámara) al 3 (revisar y cerrar) con el botón del panel y devuelve la tarjeta de decisión de cierre.
const irARevision = async () => {
    const panel = await screen.findByRole('region', { name: 'Pase de lista con cámara' });
    fireEvent.click(within(panel).getByRole('button', { name: 'Revisar y cerrar' }));
    return screen.findByRole('region', { name: 'Cierre del pase de lista' });
};

beforeEach(() => {
    sesionMonitor.mockReset();
    cerrarSesion.mockReset();
    paseListaManual.mockReset();
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

    it('la captura va PRIMERO, tras la franja de pasos: sin cifras, gráficas, cámaras ni tabla a la vista (eso es la revisión)', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        const panel = await screen.findByRole('region', { name: 'Pase de lista con cámara' });
        const pasos = screen.getByRole('navigation', { name: 'Pasos para pasar lista' });
        expect(delante(screen.getByRole('heading', { level: 1 }), pasos)).toBe(true);
        expect(delante(pasos, panel)).toBe(true);
        expect(screen.queryByRole('group', { name: 'Asistencia de la sesión' })).toBeNull();
        expect(screen.queryByRole('table')).toBeNull();
        expect(screen.queryByText('Cámaras del aula')).toBeNull();
        expect(screen.queryByText('Ventana de tolerancia')).toBeNull();
        expect(screen.queryByText('Inscritos')).toBeNull();
    });

    it('la franja de pasos marca «Pasar lista» como el paso actual y «Abrir la sesión» como hecho', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        const pasos = await screen.findByRole('navigation', { name: 'Pasos para pasar lista' });
        expect(pasos).toHaveTextContent('Hecho: Abrir la sesión');
        expect(pasos).toHaveTextContent('Paso actual: Pasar lista');
        expect(pasos).toHaveTextContent('Pendiente: Revisar y cerrar');
        expect(screen.getByText('Apunta la cámara al grupo: el sistema reconoce a los alumnos solo.')).toBeInTheDocument();
    });

    it('el panel trae la cifra «N de M presentes», el chip de estado y las acciones: «Revisar y cerrar» y registrar', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        const { container } = render(<SesionClase idSesion={19} />);
        const panel = await screen.findByRole('region', { name: 'Pase de lista con cámara' });
        expect(within(panel).getByRole('status')).toHaveTextContent('En pausa');
        expect(container.querySelector('p[aria-live]')).toHaveTextContent('1 de 2 presentes');
        expect(within(panel).getByRole('button', { name: 'Revisar y cerrar' })).toBeEnabled();
        expect(within(panel).getByRole('button', { name: 'Registrar manualmente' })).toBeInTheDocument();
        // Cerrar no está aquí: revisar no cierra nada y el cierre vive en el paso 3.
        expect(within(panel).queryByRole('button', { name: 'Cerrar pase de lista' })).toBeNull();
    });

    it('«Registrar manualmente» del panel abre el diálogo de registro', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        const panel = await screen.findByRole('region', { name: 'Pase de lista con cámara' });
        fireEvent.click(within(panel).getByRole('button', { name: 'Registrar manualmente' }));
        expect(await screen.findByRole('dialog')).toHaveTextContent('Registrar manualmente');
    });
});

describe('SesionClase: paso 3, revisar y cerrar (sesión automática)', () => {
    it('«Revisar y cerrar» cambia de vista: el paso 3 pasa a ser el actual y la cámara sigue montada, solo oculta', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        await irARevision();
        const pasos = screen.getByRole('navigation', { name: 'Pasos para pasar lista' });
        expect(within(pasos).getByRole('button', { name: /Revisar y cerrar/ })).toHaveAttribute('aria-current', 'step');
        expect(screen.getByText('Revisa quién falta y cierra el pase de lista.')).toBeInTheDocument();
        // La captura no se desmonta: la cámara sigue muestreando mientras dure la tolerancia, y volver a ella no la reinicia.
        const panel = screen.getByRole('region', { name: 'Pase de lista con cámara', hidden: true });
        expect(panel.parentElement).toHaveClass('hidden');
    });

    it('la decisión va primero: cuántos faltan y el cierre bloqueado, con su motivo, mientras dura la tolerancia', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        const cierre = await irARevision();
        expect(within(cierre).getByRole('heading', { name: 'Falta 1 alumno por registrar' })).toBeInTheDocument();
        const cerrar = within(cierre).getByRole('button', { name: 'Cerrar pase de lista' });
        expect(cerrar).toBeDisabled();
        expect(cerrar).toHaveAccessibleDescription('El cierre se habilita al terminar la tolerancia: faltan 15 min. La cámara sigue reconociendo mientras revisas.');
        expect(within(cierre).getByRole('button', { name: 'Volver a la cámara' })).toBeEnabled();
    });

    it('después de la decisión van las cifras y quién falta; el detalle técnico queda plegado hasta abrirlo', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto({ totales: { ...totales, capturas: 12, detecciones: 40, detecciones_validas: 31 } }));
        render(<SesionClase idSesion={19} />);
        const cierre = await irARevision();
        const grafica = screen.getByRole('group', { name: 'Asistencia de la sesión' });
        const alumnos = screen.getByRole('region', { name: 'Alumnos' });
        expect(delante(cierre, grafica)).toBe(true);
        expect(delante(grafica, alumnos)).toBe(true);
        // Tolerancia, actividad, cámaras y lecturas por alumno no se montan hasta abrir «Más detalle de la sesión».
        expect(screen.queryByRole('table')).toBeNull();
        expect(screen.queryByRole('progressbar', { name: 'Avance de la ventana de tolerancia' })).toBeNull();
        fireEvent.click(screen.getByRole('button', { name: /Más detalle de la sesión/ }));
        expect(screen.getByRole('table', { name: 'Alumnos inscritos' })).toBeInTheDocument();
        expect(screen.getByRole('progressbar', { name: 'Avance de la ventana de tolerancia' })).toHaveAttribute('aria-valuenow', '25');
        expect(screen.getByRole('region', { name: 'Cámaras del aula' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Actividad de reconocimiento' })).toHaveAccessibleDescription('Capturas: 12; Detecciones: 40; Det. válidas: 31');
    });

    it('4 cifras con icono (Inscritos, Presentes, Retardos, Sin registro), anillo y medidor «Presentes ahora» (sin los 8 contadores)', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        await irARevision();
        for (const etiqueta of ['Inscritos', 'Presentes', 'Retardos', 'Sin registro']) {
            const tarjeta = screen.getAllByText(etiqueta).map((n) => n.closest('div.group\\/stat, div.rounded-xl')).find((n) => n?.querySelector('svg'));
            expect(tarjeta, etiqueta).toBeTruthy();
            expect(tarjeta.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        }
        expect(screen.queryByText('Detecciones validas')).toBeNull();
        expect(screen.getByRole('group', { name: 'Asistencia de la sesión' })).toHaveAccessibleDescription('Presentes: 1 (50 %); Retardos: 0 (0 %); Sin registro: 1 (50 %); Pendientes: 0 (0 %)');
        expect(within(screen.getByRole('group', { name: 'Asistencia de la sesión' })).getByRole('meter', { name: 'Presentes ahora: 50 %' })).toHaveAccessibleDescription('1 de 2 inscritos');
    });

    it('sin actividad, la gráfica de actividad (dentro del detalle) avisa en lugar de quedar vacía', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        await irARevision();
        fireEvent.click(screen.getByRole('button', { name: /Más detalle de la sesión/ }));
        expect(screen.getByText('Aún sin capturas')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Actividad de reconocimiento' })).toHaveAccessibleDescription('Aún no hay capturas ni detecciones.');
    });

    it('«Sin registro» lista a quien falta, con sus lecturas, y permite registrarlo a mano desde su fila', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        await irARevision();
        const alumnos = screen.getByRole('region', { name: 'Alumnos' });
        expect(within(alumnos).getByText('Ana')).toBeInTheDocument();
        expect(within(alumnos).queryByText('Beto')).toBeNull();
        expect(within(alumnos).getByText('E1 · 0/3 lecturas')).toBeInTheDocument();
        fireEvent.click(within(alumnos).getByRole('button', { name: 'Registrar manualmente a Ana' }));
        expect(await screen.findByRole('dialog')).toHaveTextContent('Registrar manualmente');
        // «Todos» deja ver también a quien ya tiene registro.
        fireEvent.click(within(alumnos).getByRole('button', { name: /Todos/ }));
        expect(within(alumnos).getByText('Beto')).toBeInTheDocument();
    });

    it('terminada la tolerancia: el cierre se habilita, avisa qué pasa con quien falta y abre la confirmación', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto({ sesion: { ...base, estatus: 'abierta', modo_registro: 'automatico', en_ventana: false, fase: 'fuera_de_ventana', minuto_actual: 21 } }));
        render(<SesionClase idSesion={19} />);
        const cierre = await irARevision();
        const cerrar = within(cierre).getByRole('button', { name: 'Cerrar pase de lista' });
        expect(cerrar).toBeEnabled();
        expect(cerrar).toHaveAccessibleDescription('Si cierras ahora quedarán como ausentes. Puedes registrarlos a mano antes.');
        expect(screen.getAllByRole('status')[0]).toHaveTextContent('Fuera de la ventana');
        fireEvent.click(cerrar);
        expect(await screen.findByText('Los alumnos sin lecturas quedan como ausentes.')).toBeInTheDocument();
    });

    it('si ya nadie falta, el titular lo dice y el cierre no advierte de ausentes', async () => {
        const todos = alumnos.map((a) => ({ ...a, estado: 'presente', lecturas_validas: 3 }));
        sesionMonitor.mockResolvedValue(abiertaAuto({ alumnos: todos, totales: { ...totales, presentes: 2, sin_registro: 0 }, sesion: { ...base, estatus: 'abierta', modo_registro: 'automatico', en_ventana: false, fase: 'fuera_de_ventana', minuto_actual: 21 } }));
        render(<SesionClase idSesion={19} />);
        const cierre = await irARevision();
        expect(within(cierre).getByRole('heading', { name: 'Todos los alumnos tienen registro' })).toBeInTheDocument();
        expect(within(cierre).getByRole('button', { name: 'Cerrar pase de lista' })).toHaveAccessibleDescription('Ya puedes cerrar el pase de lista.');
    });

    it('«Volver a la cámara» regresa al paso 2', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        const cierre = await irARevision();
        fireEvent.click(within(cierre).getByRole('button', { name: 'Volver a la cámara' }));
        expect(screen.queryByRole('region', { name: 'Cierre del pase de lista' })).toBeNull();
        expect(screen.getByRole('region', { name: 'Pase de lista con cámara' }).parentElement).not.toHaveClass('hidden');
        expect(screen.getByRole('navigation', { name: 'Pasos para pasar lista' })).toHaveTextContent('Paso actual: Pasar lista');
    });

    it('los pasos de la franja también llevan de la cámara a la revisión y de vuelta', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        const pasos = await screen.findByRole('navigation', { name: 'Pasos para pasar lista' });
        fireEvent.click(within(pasos).getByRole('button', { name: /Revisar y cerrar/ }));
        expect(await screen.findByRole('region', { name: 'Cierre del pase de lista' })).toBeInTheDocument();
        fireEvent.click(within(pasos).getByRole('button', { name: /Pasar lista/ }));
        expect(screen.queryByRole('region', { name: 'Cierre del pase de lista' })).toBeNull();
    });
});

describe('SesionClase: llegar con ?pasar-lista=1', () => {
    it('enfoca el panel de captura, con la franja de pasos antes y el paso 2 como actual', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} pasarLista />);
        const panel = await screen.findByRole('region', { name: 'Pase de lista con cámara' });
        const pasos = screen.getByRole('navigation', { name: 'Pasos para pasar lista' });
        expect(within(pasos).getAllByRole('listitem')).toHaveLength(3);
        expect(pasos).toHaveTextContent('Paso actual: Pasar lista');
        expect(panel).toHaveFocus();
        expect(delante(pasos, panel)).toBe(true);
    });

    it('sin el parámetro la franja de pasos es la misma, pero no se fuerza el foco', async () => {
        sesionMonitor.mockResolvedValue(abiertaAuto());
        render(<SesionClase idSesion={19} />);
        const panel = await screen.findByRole('region', { name: 'Pase de lista con cámara' });
        expect(screen.getByRole('navigation', { name: 'Pasos para pasar lista' })).toBeInTheDocument();
        expect(panel).not.toHaveFocus();
    });

    it('en una sesión manual la franja habla de marcar y de guardar', async () => {
        sesionMonitor.mockResolvedValue({ sesion: { ...base, estatus: 'abierta', modo_registro: 'manual', en_ventana: true, fase: 'presente', minuto_actual: 5 }, camaras: [], alumnos, totales });
        render(<SesionClase idSesion={19} pasarLista />);
        const pasos = await screen.findByRole('navigation', { name: 'Pasos para pasar lista' });
        expect(pasos).toHaveTextContent('Marcar alumnos');
        expect(pasos).toHaveTextContent('Guardar y cerrar');
        expect(pasos).not.toHaveTextContent('Revisar y cerrar');
    });
});

describe('SesionClase: sesión manual abierta', () => {
    const manual = () => ({ sesion: { ...base, estatus: 'abierta', modo_registro: 'manual', en_ventana: true, fase: 'presente', minuto_actual: 15 }, camaras: [], alumnos, totales });

    it('el encabezado es «Pasar lista (manual)»; la franja de pasos y el avance reemplazan al aviso de modo manual', async () => {
        sesionMonitor.mockResolvedValue(manual());
        render(<SesionClase idSesion={19} />);
        expect(await screen.findByRole('heading', { level: 1, name: 'Pasar lista (manual)' })).toBeInTheDocument();
        expect(screen.getByRole('navigation', { name: 'Pasos para pasar lista' })).toHaveTextContent('Paso actual: Marcar alumnos');
        expect(screen.queryByText('Sesión en modo manual')).toBeNull();
        expect(screen.getByRole('progressbar', { name: 'Alumnos marcados' })).toHaveAttribute('aria-valuetext', '1 de 2');
        // La sugerencia por hora se dice una vez (minuto 15 = retardo), no en una columna por fila.
        expect(screen.getByText('Sugerido a esta hora').parentElement).toHaveTextContent('Sugerido a esta hora Retardo');
        expect(screen.queryByRole('columnheader', { name: 'Sugerido' })).toBeNull();
    });

    it('marcar a un alumno es UN toque (botones Presente / Retardo / Ausente); otro toque lo desmarca y el avance lo sigue', async () => {
        sesionMonitor.mockResolvedValue(manual());
        render(<SesionClase idSesion={19} />);
        const grupo = await screen.findByRole('group', { name: 'Estado de Ana' });
        expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Presente', 'Retardo', 'Ausente']);
        const presente = within(grupo).getByRole('button', { name: 'Presente' });
        expect(presente).toHaveAttribute('aria-pressed', 'false');
        expect(screen.queryByRole('combobox')).toBeNull();
        fireEvent.click(presente);
        expect(presente).toHaveAttribute('aria-pressed', 'true');
        expect(screen.getByRole('progressbar', { name: 'Alumnos marcados' })).toHaveAttribute('aria-valuetext', '2 de 2');
        // Con todos marcados el paso 3 («Guardar y cerrar») pasa a ser el actual.
        expect(screen.getByRole('navigation', { name: 'Pasos para pasar lista' })).toHaveTextContent('Paso actual: Guardar y cerrar');
        fireEvent.click(presente);
        expect(presente).toHaveAttribute('aria-pressed', 'false');
        expect(screen.getByRole('progressbar', { name: 'Alumnos marcados' })).toHaveAttribute('aria-valuetext', '1 de 2');
        expect(screen.getByRole('navigation', { name: 'Pasos para pasar lista' })).toHaveTextContent('Paso actual: Marcar alumnos');
    });

    it('«Marcar restantes según la hora» marca a quien falta con la sugerencia y respeta lo ya marcado', async () => {
        sesionMonitor.mockResolvedValue(manual());
        render(<SesionClase idSesion={19} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Marcar restantes según la hora' }));
        expect(within(screen.getByRole('group', { name: 'Estado de Ana' })).getByRole('button', { name: 'Retardo' })).toHaveAttribute('aria-pressed', 'true');
        expect(within(screen.getByRole('group', { name: 'Estado de Beto' })).getByRole('button', { name: 'Presente' })).toHaveAttribute('aria-pressed', 'true');
    });

    it('«Guardar y cerrar sesión de clase» envía lo marcado y cierra la sesión', async () => {
        sesionMonitor.mockResolvedValue(manual());
        paseListaManual.mockResolvedValue({ procesados: 2 });
        cerrarSesion.mockResolvedValue({});
        render(<SesionClase idSesion={19} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Marcar restantes según la hora' }));
        fireEvent.click(screen.getByRole('button', { name: 'Guardar y cerrar sesión de clase' }));
        await waitFor(() => expect(cerrarSesion).toHaveBeenCalledWith({ idSesion: 19 }));
        expect(paseListaManual).toHaveBeenCalledWith({ idSesion: 19, registros: [{ id_alumno: 1, estado: 'retardo' }, { id_alumno: 2, estado: 'presente' }] });
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

    it('la franja de pasos muestra el recorrido completo con «Abrir la sesión» como el paso actual', async () => {
        sesionMonitor.mockResolvedValue(programada());
        render(<SesionClase idSesion={19} />);
        const pasos = await screen.findByRole('navigation', { name: 'Pasos para pasar lista' });
        expect(pasos).toHaveTextContent('Paso actual: Abrir la sesión');
        expect(pasos).toHaveTextContent('Pendiente: Pasar lista');
        expect(pasos).toHaveTextContent('Pendiente: Revisar y cerrar');
        // La tarjeta de abrir ya lo explica: la franja no repite la línea de detalle.
        expect(pasos).not.toHaveTextContent('Ábrela para empezar');
        expect(delante(pasos, screen.getByRole('heading', { name: 'Esta clase aún no está abierta' }))).toBe(true);
    });

    it('sin cámaras activas la franja habla de marcar alumnos', async () => {
        sesionMonitor.mockResolvedValue(programada({ camaras: [] }));
        render(<SesionClase idSesion={19} />);
        expect(await screen.findByRole('navigation', { name: 'Pasos para pasar lista' })).toHaveTextContent('Marcar alumnos');
    });

    it('sin cámaras activas explica que se pasará lista a mano', async () => {
        sesionMonitor.mockResolvedValue(programada({ camaras: [] }));
        render(<SesionClase idSesion={19} />);
        expect(await screen.findByText(/pasarás lista a mano/)).toBeInTheDocument();
    });

    it('«Abrir sesión y pasar lista» abre la sesión y entra al pase (paso 2) con el panel enfocado', async () => {
        sesionMonitor.mockResolvedValueOnce(programada()).mockResolvedValue(abiertaAuto());
        abrirSesion.mockResolvedValue({ id_sesion: 19, estatus: 'abierta', modo_registro: 'automatico' });
        render(<SesionClase idSesion={19} />);
        fireEvent.click(await screen.findByRole('button', { name: 'Abrir sesión y pasar lista' }));
        await waitFor(() => expect(abrirSesion).toHaveBeenCalledWith({ idSesion: 19 }));
        // Ya abierta: el panel con la cámara, enfocado porque se llegó a pasar lista, y la franja en el paso 2.
        const panel = await screen.findByRole('region', { name: 'Pase de lista con cámara' });
        expect(panel).toHaveFocus();
        expect(screen.getByRole('navigation', { name: 'Pasos para pasar lista' })).toHaveTextContent('Paso actual: Pasar lista');
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
        expect(screen.queryByRole('navigation', { name: 'Pasos para pasar lista' })).toBeNull();
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
