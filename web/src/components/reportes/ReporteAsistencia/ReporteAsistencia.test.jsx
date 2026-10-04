// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ReporteAsistencia from './ReporteAsistencia.jsx';

const api = vi.hoisted(() => ({
    reporteFiltros: vi.fn(), reporteGrupo: vi.fn(), reportePeriodo: vi.fn(), impactoTiempo: vi.fn(),
}));
vi.mock('@/lib/api/reportes.js', () => api);
vi.mock('next/link', () => ({ default: ({ href, children, ...r }) => <a href={href} {...r}>{children}</a> }));

const fila = (o) => ({ id_alumno: 1, matricula: 'E1', nombres: 'Ana', apellido_paterno: 'Pérez', nombre_completo: 'Ana Pérez', presentes: 5, retardos: 0, ausencias: 1, justificadas: 0,
    pendientes: 0, faltas_equivalentes: 1, porcentaje_faltas: 2.22, faltas_restantes_antes_limite: 8, derecho_examen: true, en_limite: false, supera_limite: false, ...o });

const reporteGrupo = () => ({ generado_en: '2026-09-14T13:00:00Z', total: 2, limite_pct: 20,
    grupo: { id_grupo: 1, clave_grupo: '3A', materia_nombre: 'Finanzas', docente_nombre: 'Doc' },
    kpis: { sesiones_programadas: 45, sesiones_cerradas: 17, asistencia_promedio: 82.35, alumnos_en_limite: 0, alumnos_sin_derecho: 1 },
    items: [fila({}), fila({ id_alumno: 2, matricula: 'E2', nombres: 'Luis', apellido_paterno: 'Gómez', nombre_completo: 'Luis Gómez', derecho_examen: false, supera_limite: true, porcentaje_faltas: 24 })] });

const impacto = { minutos_recuperados: 85, horas_recuperadas: 1.42, sesiones_automaticas: 17, sesiones_manuales: 0, sesiones_cerradas: 17, minutos_pase_lista_base: 5 };

beforeEach(() => {
    vi.clearAllMocks();
    api.reporteFiltros.mockResolvedValue({ periodo_actual: '2026-2', periodos: ['2026-2'],
        grupos: [{ id_grupo: 1, clave_grupo: '3A', materia_nombre: 'Finanzas' }] });
    api.impactoTiempo.mockResolvedValue(impacto);
});

describe('ReporteAsistencia', () => {
    it('con grupo muestra indicadores, impacto como estimación y resalta sin derecho', async () => {
        api.reporteGrupo.mockResolvedValue(reporteGrupo());
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2', idGrupo: 1 }} />);
        expect((await screen.findAllByText('Luis Gómez')).length).toBeGreaterThan(0);
        expect(screen.getAllByText('Sin derecho').length).toBeGreaterThan(0);
        // La cifra y su «%» van en nodos distintos (la unidad es un sufijo pequeño de la tarjeta).
        const asistencia = within(screen.getByText('Asistencia promedio').closest('.rounded-xl'));
        expect(asistencia.getByText('82.35')).toBeInTheDocument();
        expect(asistencia.getByText('%')).toBeInTheDocument();
        expect(await screen.findByText(/Estimación, no una medición/)).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
    });

    it('grupo: pestañas Resumen y Alumnos, gráficas con texto alternativo y "Ver todos" abre el detalle', async () => {
        api.reporteGrupo.mockResolvedValue(reporteGrupo());
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2', idGrupo: 1 }} />);
        const resumen = await screen.findByRole('tab', { name: 'Resumen' });
        const alumnos = screen.getByRole('tab', { name: /Alumnos/ });
        expect(resumen).toHaveAttribute('aria-selected', 'true');
        expect(alumnos).toHaveTextContent('(2)');
        const panelResumen = screen.getByRole('tabpanel', { name: 'Resumen' });
        expect(within(panelResumen).getByRole('group', { name: 'Estados de asistencia' })).toHaveAccessibleDescription(/Presentes: 10/);
        expect(within(panelResumen).getByRole('group', { name: 'Faltas por alumno (%)' })).toHaveAccessibleDescription(/Luis Gómez: 24 %.*Límite: 20 %/);
        await userEvent.click(within(panelResumen).getByRole('button', { name: /Ver todos/ }));
        expect(alumnos).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tabpanel', { name: /Alumnos/ })).toHaveClass('flex');
    });

    it('toma el límite de los datos del reporte', async () => {
        api.reporteGrupo.mockResolvedValue({ ...reporteGrupo(), limite_pct: 30 });
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2', idGrupo: 1 }} />);
        expect(await screen.findByRole('group', { name: 'Faltas por alumno (%)' })).toHaveAccessibleDescription(/Límite: 30 %/);
    });

    it('sin sesiones programadas avisa y no grafica faltas', async () => {
        api.reporteGrupo.mockResolvedValue({ ...reporteGrupo(), kpis: { sesiones_programadas: 0, sesiones_cerradas: 0, asistencia_promedio: null, alumnos_en_limite: 0, alumnos_sin_derecho: 0 } });
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2', idGrupo: 1 }} />);
        expect(await screen.findByText(/Aún no hay sesiones programadas/)).toBeInTheDocument();
        expect(screen.getByText('Aún no hay sesiones para calcular faltas')).toBeInTheDocument();
    });

    it('grupo sin alumnos inscritos: detalle vacío y gráficas con aviso', async () => {
        api.reporteGrupo.mockResolvedValue({ ...reporteGrupo(), total: 0, items: [] });
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2', idGrupo: 1 }} />);
        expect(await screen.findByText('El grupo no tiene alumnos inscritos.')).toBeInTheDocument();
        expect(screen.getByText('Aún no hay registros de asistencia')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeDisabled();
    });

    it('periodo: pestañas Resumen y Grupos con gráficas y tabla con enlace a la analítica', async () => {
        api.reportePeriodo.mockResolvedValue({ generado_en: '2026-09-14T13:00:00Z', periodo: '2026-2', total: 2, items: [
            { id_grupo: 1, clave_grupo: '3A', materia_nombre: 'Finanzas', docente_nombre: 'Doc', inscritos: 30, sesiones_programadas: 45, sesiones_cerradas: 17, asistencia_promedio: 90, alumnos_en_limite: 2, alumnos_sin_derecho: 1 },
            { id_grupo: 2, clave_grupo: '5C', materia_nombre: 'Costos', docente_nombre: 'Doc2', inscritos: 20, sesiones_programadas: 45, sesiones_cerradas: 17, asistencia_promedio: 70, alumnos_en_limite: 0, alumnos_sin_derecho: 0 },
        ] });
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2' }} />);
        expect(await screen.findByRole('tab', { name: /Grupos/ })).toHaveTextContent('(2)');
        const panel = screen.getByRole('tabpanel', { name: 'Resumen' });
        expect(within(panel).getByRole('group', { name: 'Asistencia promedio por grupo' })).toHaveAccessibleDescription(/5C · Costos: 70 %; 3A · Finanzas: 90 %/);
        expect(within(panel).getByRole('group', { name: 'Alumnos por situación' })).toHaveAccessibleDescription(/3A · Finanzas: 27 con derecho, 2 en el límite, 1 sin derecho/);
        expect(within(panel).getByText('Alumnos en el límite')).toBeInTheDocument();
        expect(await screen.findByText(/Estimación, no una medición/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ver analítica del grupo 3A' })).toHaveAttribute('href', '/analitica?grupo=1');
        // La situación de riesgo sale dos veces en el DOM: en su columna (desde sm) y bajo la clave del grupo (pantallas angostas).
        expect(screen.getAllByText('1 sin derecho')).toHaveLength(2);
        expect(screen.getAllByText('2 en el límite')).toHaveLength(2);
        expect(screen.getAllByText('Sin alertas')).toHaveLength(2);
        expect(screen.getByRole('button', { name: 'Exportar CSV' })).toBeEnabled();
    });

    it('periodo sin grupos muestra el estado vacío', async () => {
        api.reportePeriodo.mockResolvedValue({ periodo: '2026-2', total: 0, items: [] });
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2' }} />);
        expect((await screen.findAllByText('No hay grupos para este periodo.')).length).toBeGreaterThan(0);
    });

    it('alumno: abre la pestaña Sesiones con el historial y el detalle se carga', async () => {
        api.reporteGrupo.mockImplementation(async (a) => (a.idAlumno
            ? { ...reporteGrupo(), items: [fila({ id_alumno: 2 })], detalle: [{ id_sesion: 9, fecha: '2026-09-01', hora_inicio: '08:00:00', estado: 'ausente', origen: 'manual', justificante_estatus: null }] }
            : reporteGrupo()));
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2', idGrupo: 1, idAlumno: 2 }} />);
        expect(await screen.findByText('Detalle por sesión')).toBeInTheDocument();
        expect(screen.getByText('01/09/2026')).toBeInTheDocument();
        // Con el enlace directo ?grupo&alumno se aterriza en el historial (el texto también existe en el panel oculto: hay que
        // comprobar la pestaña, no solo que el texto esté en el DOM).
        expect(screen.getByRole('tab', { name: 'Sesiones' })).toHaveAttribute('aria-selected', 'true');
        expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'false');
        expect(screen.getByRole('button', { name: /Ver sesiones/ })).toBeInTheDocument();
    });

    it('elegir un alumno en el filtro abre la pestaña Sesiones', async () => {
        api.reporteGrupo.mockImplementation(async (a) => (a.idAlumno ? { ...reporteGrupo(), items: [fila({ id_alumno: 2 })], detalle: [] } : reporteGrupo()));
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2', idGrupo: 1 }} />);
        expect(await screen.findByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
        await userEvent.selectOptions(screen.getByLabelText('Alumno'), '2');
        expect(await screen.findByRole('tab', { name: 'Sesiones' })).toHaveAttribute('aria-selected', 'true');
    });

    it('los paneles de pestaña son enfocables con teclado', async () => {
        api.reporteGrupo.mockResolvedValue(reporteGrupo());
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2', idGrupo: 1 }} />);
        const panel = await screen.findByRole('tabpanel', { name: 'Resumen' });
        expect(panel).toHaveAttribute('tabindex', '0');
        // Al imprimir sale HojaImpresion (todas las filas): el panel inactivo no se muestra con print:flex.
        expect(panel.className).not.toMatch(/print:flex/);
    });

    it('abrir un grupo desde la tabla del periodo aterriza en su Resumen, no en la pestaña Alumnos', async () => {
        api.reportePeriodo.mockResolvedValue({ generado_en: '2026-09-14T13:00:00Z', periodo: '2026-2', total: 1, items: [
            { id_grupo: 1, clave_grupo: '3A', materia_nombre: 'Finanzas', docente_nombre: 'Doc', inscritos: 30, sesiones_programadas: 45, sesiones_cerradas: 17, asistencia_promedio: 90, alumnos_en_limite: 2, alumnos_sin_derecho: 1 },
        ] });
        api.reporteGrupo.mockResolvedValue(reporteGrupo());
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2' }} />);
        await userEvent.click(await screen.findByRole('tab', { name: /Grupos/ }));
        expect(screen.getByRole('tab', { name: /Grupos/ })).toHaveAttribute('aria-selected', 'true');
        await userEvent.click(screen.getByRole('button', { name: '3A' }));
        expect(await screen.findByRole('tab', { name: /Alumnos/ })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
    });

    it('cambiar de grupo con el filtro vuelve al Resumen', async () => {
        api.reportePeriodo.mockResolvedValue({ generado_en: '2026-09-14T13:00:00Z', periodo: '2026-2', total: 1, items: [
            { id_grupo: 1, clave_grupo: '3A', materia_nombre: 'Finanzas', docente_nombre: 'Doc', inscritos: 30, sesiones_programadas: 45, sesiones_cerradas: 17, asistencia_promedio: 90, alumnos_en_limite: 0, alumnos_sin_derecho: 0 },
        ] });
        api.reporteGrupo.mockResolvedValue(reporteGrupo());
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2' }} />);
        await userEvent.click(await screen.findByRole('tab', { name: /Grupos/ }));
        await userEvent.selectOptions(screen.getByLabelText('Grupo'), '1');
        expect(await screen.findByRole('tab', { name: /Alumnos/ })).toBeInTheDocument();
        expect(screen.getByRole('tab', { name: 'Resumen' })).toHaveAttribute('aria-selected', 'true');
    });

    it('la tabla por alumno resume el desglose bajo el nombre (faltas equivalentes incluidas) cuando las columnas no caben y bajo la barra en xl', async () => {
        api.reporteGrupo.mockResolvedValue(reporteGrupo());
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2', idGrupo: 1 }} />);
        const tabla = await screen.findByRole('table', { name: 'Asistencia acumulada por alumno' });
        // 2 alumnos x 2 copias del desglose (bajo el nombre hasta lg y bajo la barra de la columna en xl; el CSS deja visible una).
        expect(within(tabla).getAllByText(/5 pres\., 0 ret\., 1 aus\./).length).toBe(4);
        expect(within(tabla).getAllByText(/faltas eq\. 1/).length).toBe(2);
        expect(within(tabla).getAllByText(/8 faltas restantes/).length).toBe(2);
    });

    it('la tabla por alumno dibuja la composición como una barra con las cifras en su aria-label (bajo el nombre y en su columna)', async () => {
        api.reporteGrupo.mockResolvedValue(reporteGrupo());
        render(<ReporteAsistencia filtrosIniciales={{ periodo: '2026-2', idGrupo: 1 }} />);
        const tabla = await screen.findByRole('table', { name: 'Asistencia acumulada por alumno' });
        expect(within(tabla).getByRole('columnheader', { name: 'Composición' })).toBeInTheDocument();
        // 2 alumnos x 2 barras (una bajo el nombre hasta lg y otra en la columna de xl; el CSS oculta la que no toca).
        expect(within(tabla).getAllByRole('img', { name: 'Presentes 5 (83 %); Ausencias 1 (17 %)' })).toHaveLength(4);
        // Ya no hay cinco columnas de cifras: el desglose está en la barra, en el texto bajo el nombre, en el CSV y en el papel.
        expect(within(tabla).queryByRole('columnheader', { name: 'Justificadas' })).toBeNull();
        // Leyenda única (decorativa) con solo los estados que existen en las filas.
        expect(within(tabla.parentElement).getByText('Presentes')).toBeInTheDocument();
        expect(within(tabla.parentElement).queryByText('Pendientes')).toBeNull();
    });
});
