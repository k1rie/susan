// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const resumen = vi.hoisted(() => vi.fn());
const historial = vi.hoisted(() => vi.fn());
const justificantes = vi.hoisted(() => vi.fn());
const justificables = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/reportes.js', () => ({ alumnoResumen: (...a) => resumen(...a), alumnoHistorial: (...a) => historial(...a) }));
vi.mock('@/lib/api/revision.js', () => ({
    misJustificantes: (...a) => justificantes(...a),
    misJustificables: (...a) => justificables(...a),
    registrarJustificante: vi.fn(),
}));
vi.mock('@/lib/http', () => ({ subirDocumentoJustificante: vi.fn() }));

import { ApiError } from '@/lib/api/errors.js';
import PortalAlumno from './PortalAlumno.jsx';

const materia = (id, nombre, extra = {}) => ({
    id_grupo: id, clave_grupo: `G${id}`, docente_nombre: 'Ana Pérez', materia: { nombre }, sesiones_programadas: 40,
    faltas_equivalentes: 2, faltas_maximas_permitidas: 8, faltas_restantes_antes_limite: 6, porcentaje_faltas: 5, limite_pct: 20,
    supera_limite: false, en_limite: false, presentes: 30, retardos: 1, ausencias: 2, justificadas: 0, pendientes: 0, ...extra,
});

// Sesiones de la materia como las devuelve api_alumno_historial (la más reciente primero): racha actual de 2 y mejor de 3.
const sesion = (id, fecha, estado, extra = {}) => ({ id_sesion: id, fecha, hora_inicio: '08:00:00', estatus_sesion: 'cerrada', estado, origen: 'automatico', ...extra });
const SESIONES = [
    sesion(15, '2026-09-30', 'presente'),
    sesion(14, '2026-09-28', 'retardo'),
    sesion(13, '2026-09-25', 'ausente', { puede_justificar: true }),
    sesion(12, '2026-09-23', 'presente'),
    sesion(11, '2026-09-21', 'presente'),
    sesion(10, '2026-09-18', 'presente'),
];
const LIMITE_CALENDARIO = 200;

beforeEach(() => {
    // «Reducir movimiento»: el medidor líquido salta a su nivel sin física ni cuadros pendientes.
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
    resumen.mockReset();
    historial.mockReset();
    justificantes.mockResolvedValue({ total: 0, items: [] });
    justificables.mockResolvedValue({ total: 1, items: [{ id_sesion: 9, estado: 'ausente', fecha: '2026-09-10', materia: { nombre: 'Álgebra' }, grupo: { clave_grupo: 'G1' } }] });
    historial.mockResolvedValue({
        total: 20, grupo: { materia: { nombre: 'Álgebra' } },
        items: [{ id_sesion: 9, fecha: '2026-09-10', hora_inicio: '08:00:00', estado: 'ausente', origen: 'automatico', puede_justificar: true }],
    });
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe('PortalAlumno', () => {
    it('con varias materias: gráficas arriba, tarjetas compactas, historial con resumen y justificantes en tarjetas propias', async () => {
        resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: ['2026-2'], items: [materia(1, 'Álgebra'), materia(2, 'Cálculo')] });
        render(<PortalAlumno encabezado={false} />);
        const asistencia = await screen.findByRole('group', { name: 'Asistencia del periodo' });
        // Pieza principal: el medidor «Tu asistencia» (2 + 2 faltas equivalentes de 40 + 40 sesiones = 95 %), con la marca del mínimo (80 %).
        expect(within(asistencia).getByRole('meter', { name: 'Tu asistencia: 95 %' })).toHaveAccessibleDescription('Mínimo 80 % 4 faltas equivalentes de 80 sesiones');
        const faltas = screen.getByRole('group', { name: 'Faltas frente al límite' });
        expect([...faltas.querySelectorAll('[data-fila]')].map((f) => f.getAttribute('data-fila'))).toEqual(['Álgebra', 'Cálculo']);
        expect(await screen.findByText('20 sesiones · 2 ausencias')).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Registrar justificante' })).toBeInTheDocument();
        expect(screen.getByRole('region', { name: 'Mis justificantes' })).toBeInTheDocument();
        // Una sola tarjeta de formulario: sin Card envolviendo otra tarjeta.
        expect(screen.getAllByRole('heading', { name: 'Registrar justificante' })).toHaveLength(1);
    });

    it('con una sola materia: medidor y anillo, sin la comparación de faltas (no aporta)', async () => {
        resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: ['2026-2'], items: [materia(1, 'Álgebra', { faltas_equivalentes: 10, porcentaje_faltas: 25, supera_limite: true })] });
        render(<PortalAlumno encabezado={false} />);
        const asistencia = await screen.findByRole('group', { name: 'Asistencia del periodo' });
        expect(within(asistencia).getByRole('meter', { name: 'Tu asistencia: 75 %' })).toBeInTheDocument();
        expect(screen.queryByRole('group', { name: 'Faltas frente al límite' })).not.toBeInTheDocument();
        // El aviso por materia sigue en su tarjeta: el medidor no lo sustituye.
        expect(screen.getByText(/Superaste el límite de faltas/)).toBeInTheDocument();
    });

    it('Justificar preselecciona la sesión en el formulario', async () => {
        resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: ['2026-2'], items: [materia(1, 'Álgebra')] });
        render(<PortalAlumno encabezado={false} />);
        await userEvent.click(await screen.findByRole('button', { name: 'Justificar' }));
        const tarjeta = screen.getByRole('region', { name: 'Registrar justificante' });
        // La falta se elige con tarjetas (radios): la de la sesión 9 queda marcada.
        expect(await within(tarjeta).findByRole('radio', { name: /Álgebra/ })).toBeChecked();
    });

    it('sin materias muestra el aviso', async () => {
        resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: [], items: [] });
        render(<PortalAlumno encabezado={false} />);
        expect(await screen.findByText('No tienes materias inscritas en este periodo.')).toBeInTheDocument();
    });

    describe('vista de la materia: casillas, calendario con racha e historial', () => {
        // La lista pide páginas de 8; el calendario pide el máximo de la RPC: cada petición se contesta según su `limit`.
        const conCalendario = ({ lista = SESIONES.slice(0, 3), calendario = SESIONES, total = SESIONES.length } = {}) => {
            historial.mockImplementation(async ({ idGrupo, limit }) => ({
                total, grupo: { id_grupo: idGrupo, materia: { nombre: idGrupo === 1 ? 'Álgebra' : 'Cálculo' } },
                items: limit === LIMITE_CALENDARIO ? calendario : lista,
            }));
        };

        it('de arriba abajo: tarjeta principal, casillas de cifras, calendario y historial por sesión', async () => {
            conCalendario();
            resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: ['2026-2'], items: [materia(1, 'Álgebra')] });
            render(<PortalAlumno encabezado={false} />);
            const principal = await screen.findByRole('group', { name: 'Asistencia del periodo' });
            const casillas = await screen.findByRole('group', { name: 'Cifras de Álgebra' });
            const calendario = await screen.findByRole('group', { name: 'Calendario de asistencia' });
            const porSesion = await screen.findByRole('heading', { name: 'Por sesión' });
            const lista = porSesion.parentElement.querySelector('ul');
            const antes = (a, b) => Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);
            expect(antes(principal, casillas)).toBe(true);
            expect(antes(casillas, calendario)).toBe(true);
            expect(antes(calendario, porSesion)).toBe(true);
            expect(antes(porSesion, lista)).toBe(true);
            expect(within(lista).getAllByRole('listitem')).toHaveLength(3);
            // El calendario cae dentro de la sección de la materia, bajo su encabezado.
            const seccion = screen.getByRole('heading', { level: 2, name: /Historial · Álgebra/ }).closest('section');
            expect(seccion).toContainElement(casillas);
            expect(seccion).toContainElement(calendario);
        });

        it('el calendario se pide aparte, con el máximo de sesiones, y la lista sigue paginada de 8 en 8', async () => {
            conCalendario();
            resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: ['2026-2'], items: [materia(1, 'Álgebra')] });
            render(<PortalAlumno encabezado={false} />);
            await screen.findByRole('group', { name: 'Calendario de asistencia' });
            expect(historial).toHaveBeenCalledWith({ idGrupo: 1, limit: LIMITE_CALENDARIO, offset: 0 });
            expect(historial).toHaveBeenCalledWith({ idGrupo: 1, limit: 8, offset: 0 });
        });

        it('el calendario dibuja las sesiones reales y la racha sale de ellas', async () => {
            conCalendario();
            resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: ['2026-2'], items: [materia(1, 'Álgebra')] });
            const { container } = render(<PortalAlumno encabezado={false} />);
            const calendario = await screen.findByRole('group', { name: 'Calendario de asistencia' });
            expect(container.querySelectorAll('[data-fecha]')).toHaveLength(SESIONES.length);
            expect(container.querySelector('[data-fecha="2026-09-25"]')).toHaveAttribute('data-estado', 'ausente');
            expect(within(calendario).getByText('Racha de 2 sesiones')).toBeInTheDocument();
            expect(within(calendario).getByText('Mejor racha 3')).toBeInTheDocument();
            expect(calendario).toHaveAccessibleDescription(/Calendario de asistencia de Álgebra: 6 sesiones \(Presentes 4, Retardos 1, Ausencias 1\)\. Racha de 2 sesiones\. Mejor racha 3\./);
        });

        it('las casillas muestran las cifras de la materia elegida y cambian con ella', async () => {
            conCalendario();
            resumen.mockResolvedValue({
                periodo: '2026-2', periodos_disponibles: ['2026-2'],
                items: [materia(1, 'Álgebra'), materia(2, 'Cálculo', { presentes: 12, ausencias: 9, faltas_equivalentes: 9, porcentaje_faltas: 22, faltas_restantes_antes_limite: 0, supera_limite: true, derecho_examen: false })],
            });
            render(<PortalAlumno encabezado={false} />);
            const algebra = await screen.findByRole('group', { name: 'Cifras de Álgebra' });
            expect(within(algebra).getByText('Dentro del límite')).toBeInTheDocument();
            // Cambiar de materia vuelve a pedir lista y calendario del otro grupo y cambia las casillas.
            await userEvent.click(screen.getAllByRole('button', { name: 'Ver historial' })[0]);
            const calculo = await screen.findByRole('group', { name: 'Cifras de Cálculo' });
            expect(within(calculo).getByText('Sin derecho a examen')).toBeInTheDocument();
            await waitFor(() => expect(historial).toHaveBeenCalledWith({ idGrupo: 2, limit: LIMITE_CALENDARIO, offset: 0 }));
            expect(historial).toHaveBeenCalledWith({ idGrupo: 2, limit: 8, offset: 0 });
            expect(await screen.findByRole('heading', { level: 2, name: /Historial · Cálculo/ })).toBeInTheDocument();
        });

        it('las casillas pasan de las cajas de cada tarjeta a StatCard con icono (la tarjeta de materia ya no repite las cifras)', async () => {
            conCalendario();
            resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: ['2026-2'], items: [materia(1, 'Álgebra')] });
            render(<PortalAlumno encabezado={false} />);
            const casillas = await screen.findByRole('group', { name: 'Cifras de Álgebra' });
            for (const etiqueta of ['Presentes', 'Retardos', 'Ausencias', 'Justificadas', 'Pendientes', 'Faltas restantes']) {
                const c = within(casillas).getByText(etiqueta).closest('[class*="rounded-xl"]');
                expect(c.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
            }
            const tarjeta = screen.getByRole('heading', { name: 'Álgebra', level: 3 }).closest('li');
            expect(within(tarjeta).queryByText('Presentes')).toBeNull();
        });

        it('sin sesiones: el calendario muestra un estado vacío amable y las casillas siguen con sus ceros', async () => {
            conCalendario({ lista: [], calendario: [], total: 0 });
            resumen.mockResolvedValue({
                periodo: '2026-2', periodos_disponibles: ['2026-2'],
                items: [materia(1, 'Álgebra', { sesiones_programadas: 0, presentes: 0, retardos: 0, ausencias: 0, faltas_equivalentes: 0, faltas_restantes_antes_limite: 0 })],
            });
            const { container } = render(<PortalAlumno encabezado={false} />);
            expect(await screen.findByText('Tu calendario empieza con la primera clase')).toBeInTheDocument();
            expect(container.querySelector('[data-racha]')).toBeNull();
            expect(screen.getByText('Aún no hay sesiones registradas en esta materia.')).toBeInTheDocument();
            // Sin sesiones no hay encabezado «Por sesión» suelto sobre un aviso vacío.
            expect(screen.queryByRole('heading', { name: 'Por sesión' })).toBeNull();
            const casillas = screen.getByRole('group', { name: 'Cifras de Álgebra' });
            expect(within(casillas).getByText('Aún no hay sesiones programadas')).toBeInTheDocument();
        });

        it('mientras llega el calendario reserva su sitio con un aviso de carga, y la lista no espera por él', async () => {
            historial.mockImplementation(({ limit }) => (limit === LIMITE_CALENDARIO ? new Promise(() => {}) : Promise.resolve({
                total: 3, grupo: { materia: { nombre: 'Álgebra' } }, items: SESIONES.slice(0, 3),
            })));
            resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: ['2026-2'], items: [materia(1, 'Álgebra')] });
            render(<PortalAlumno encabezado={false} />);
            expect(await screen.findByRole('heading', { name: 'Por sesión' })).toBeInTheDocument();
            expect(screen.getByText('Cargando calendario')).toBeInTheDocument();
            expect(screen.queryByRole('group', { name: 'Calendario de asistencia' })).toBeNull();
        });

        it('si el calendario falla se avisa ahí mismo y el resto de la vista sigue (lista, casillas y justificantes)', async () => {
            historial.mockImplementation(({ limit }) => (limit === LIMITE_CALENDARIO ? Promise.reject(new ApiError({ code: 'ERROR_RED', message: 'Sin conexión con el calendario', status: 503 })) : Promise.resolve({
                total: 3, grupo: { materia: { nombre: 'Álgebra' } }, items: SESIONES.slice(0, 3),
            })));
            resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: ['2026-2'], items: [materia(1, 'Álgebra')] });
            render(<PortalAlumno encabezado={false} />);
            expect(await screen.findByText('Sin conexión con el calendario')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
            expect(screen.getByRole('group', { name: 'Cifras de Álgebra' })).toBeInTheDocument();
            expect(screen.getByText('30/09/2026 · 08:00')).toBeInTheDocument();
            expect(screen.getByRole('region', { name: 'Registrar justificante' })).toBeInTheDocument();
        });

        it('Justificar sigue funcionando desde la lista con el calendario encima', async () => {
            // El formulario ofrece la sesión 9 (la de `justificables`): la fila del historial es esa misma.
            conCalendario({ lista: [sesion(9, '2026-09-10', 'ausente', { puede_justificar: true })] });
            resumen.mockResolvedValue({ periodo: '2026-2', periodos_disponibles: ['2026-2'], items: [materia(1, 'Álgebra')] });
            render(<PortalAlumno encabezado={false} />);
            await screen.findByRole('group', { name: 'Calendario de asistencia' });
            await userEvent.click(await screen.findByRole('button', { name: 'Justificar' }));
            expect(await within(screen.getByRole('region', { name: 'Registrar justificante' })).findByRole('radio', { name: /Álgebra/ })).toBeChecked();
        });
    });
});
