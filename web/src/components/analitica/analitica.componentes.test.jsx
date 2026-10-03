// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { analizarGrupo } from '@/lib/numerics';
import AlertasAnalitica from './AlertasAnalitica';
import GraficaAcumulado from './GraficaAcumulado';
import GraficaSerie from './GraficaSerie';
import PanelProcedimiento from './PanelProcedimiento';
import PatronSemanal from './PatronSemanal';
import SelectorGrupo from './SelectorGrupo';
import TablaRiesgo from './TablaRiesgo';
import TarjetasAnalitica from './TarjetasAnalitica';

const L0 = Date.UTC(2026, 7, 17);
const fecha = (w, d) => new Date(L0 + ((w - 1) * 7 + (d - 1)) * 86400000).toISOString().slice(0, 10);
const fechas = [];
const sesiones = [];
for (let w = 1; w <= 8; w += 1) {
    for (const d of [1, 3, 5]) {
        const a = 2 + w;
        fechas.push(fecha(w, d));
        sesiones.push({ id_sesion: sesiones.length + 1, fecha: fecha(w, d), dia_semana: d, inscritos: 20, presentes: 20 - a, retardos: 0, ausentes: a, justificados: 0, pendientes: 0 });
    }
}
// 12 alumnos: los 10 primeros faltan cada vez más (riesgo), los 2 últimos asisten siempre.
const alumnos = Array.from({ length: 12 }, (_, i) => ({
    id_alumno: i + 1, matricula: `E${i}`, nombre: `Alumno número ${i}`, estados: fechas.map((_f, k) => (i < 10 && k > 14 - i ? 'ausente' : 'presente')),
}));
const a = analizarGrupo({ serie: { sesiones }, matriz: { fechas, alumnos }, limitePct: 20, sesionesProgramadas: 48 });

describe('GraficaSerie', () => {
    it('es un grupo con texto alternativo "de X a Y" y alterna las medias móviles', async () => {
        render(<GraficaSerie tendencia={a.tendencia} suavizado={a.suavizado} proyeccion={a.proyeccion} resumen={a.resumen} cruceLimite={a.cruceLimite} limitePct={20} />);
        const grupo = screen.getByRole('group', { name: 'Ausentismo semanal' });
        expect(grupo).toHaveAccessibleDescription(/^Ausentismo semanal: el ausentismo va de .* en la semana 1 a .* en la semana 8/);
        // la dirección y la pendiente de la tendencia (antes una tarjeta) se ven bajo el título
        expect(screen.getByText(/^Tendencia .*pp por semana/)).toBeInTheDocument();
        const ema = screen.getByRole('checkbox', { name: 'EMA' });
        expect(ema).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'SMA' })).not.toBeChecked();
        await userEvent.click(ema);
        expect(ema).not.toBeChecked();
    });
    it('la leyenda distingue ajuste, proyección e intervalo por su forma, no solo por el color', () => {
        const { container } = render(<GraficaSerie tendencia={a.tendencia} suavizado={a.suavizado} proyeccion={a.proyeccion} resumen={a.resumen} cruceLimite={a.cruceLimite} limitePct={20} />);
        const leyenda = within(container.querySelector('.recharts-legend-wrapper'));
        const forma = (texto) => leyenda.getByText(texto).querySelector('[data-forma]').dataset.forma;
        expect(forma('Ajuste')).toBe('linea');
        expect(forma('Proyección')).toBe('discontinua');
        expect(forma('Intervalo 95 %')).toBe('banda');
        expect(forma('Observada')).toBe('punto');
    });
    it('con datos insuficientes muestra el aviso', () => {
        const corto = analizarGrupo({ serie: { sesiones: sesiones.slice(0, 6) }, sesionesProgramadas: 48 });
        render(<GraficaSerie tendencia={corto.tendencia} suavizado={corto.suavizado} proyeccion={corto.proyeccion} resumen={corto.resumen} cruceLimite={corto.cruceLimite} />);
        expect(screen.getByText(/Datos insuficientes/)).toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).toBeNull();
    });
});

describe('GraficaAcumulado y PatronSemanal', () => {
    it('acumulado monta la gráfica y describe el cruce', () => {
        const { container } = render(<GraficaAcumulado cruceLimite={a.cruceLimite} limitePct={20} />);
        expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Faltas acumuladas y límite' })).toHaveAccessibleDescription(new RegExp(a.cruceLimite.mensaje.replace(/[()]/g, '\\$&')));
    });
    it('acumulado: la leyenda también usa formas distintas para ajuste y proyección', () => {
        const { container } = render(<GraficaAcumulado cruceLimite={a.cruceLimite} limitePct={20} />);
        const leyenda = within(container.querySelector('.recharts-legend-wrapper'));
        expect(leyenda.getByText('Ajuste').querySelector('[data-forma]').dataset.forma).toBe('linea');
        expect(leyenda.getByText('Proyección').querySelector('[data-forma]').dataset.forma).toBe('discontinua');
    });
    it('acumulado sin datos muestra aviso', () => {
        render(<GraficaAcumulado cruceLimite={{ estado: 'insuficiente', mensaje: 'Datos insuficientes' }} />);
        expect(screen.getByText(/Datos insuficientes: se requieren/)).toBeInTheDocument();
    });
    it('patrón semanal monta la gráfica y lista cada día con texto', () => {
        const { container } = render(<PatronSemanal patronSemanal={a.patronSemanal} />);
        expect(container.querySelector('[data-slot="chart"]')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Ausentismo por día de la semana' })).toHaveAccessibleDescription(/sesiones/);
    });
    it('patrón sin sesiones muestra el aviso', () => {
        render(<PatronSemanal patronSemanal={{ dias: [] }} />);
        expect(screen.getByText('Sin sesiones cerradas para calcular el patrón.')).toBeInTheDocument();
    });
});

describe('TablaRiesgo', () => {
    it('muestra dona, ranking y tabla plegada; la tabla se abre y se ordena', async () => {
        expect(a.alumnosEnRiesgo.length).toBeGreaterThan(2);
        const { container } = render(<TablaRiesgo items={a.alumnosEnRiesgo} evaluados={a.resumen.alumnosEvaluados} hrefHistorial={(id) => `/reportes?alumno=${id}`} />);
        expect(screen.getByRole('heading', { name: 'Alumnos en riesgo' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Distribución por nivel' })).toHaveAccessibleDescription(/en riesgo/);
        expect(screen.getByRole('group', { name: 'Mayor riesgo' })).toHaveAccessibleDescription(/de 100/);
        expect(container.querySelectorAll('[data-slot="chart"]').length).toBe(2);
        const boton = screen.getByRole('button', { name: /Ver tabla completa/ });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        await userEvent.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'true');
        const filas = () => screen.getAllByRole('row').slice(1);
        expect(filas()).toHaveLength(a.alumnosEnRiesgo.length);
        // ordenar por nombre ascendente
        await userEvent.click(screen.getByRole('button', { name: 'Alumno' }));
        expect(within(filas()[0]).getByText(/Alumno número/)).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'Alumno' })).toHaveAttribute('aria-sort', 'ascending');
    });
    it('el detalle del alumno trae acción, factores, enlace y procedimiento plegado', async () => {
        render(<TablaRiesgo items={a.alumnosEnRiesgo} evaluados={a.resumen.alumnosEvaluados} hrefHistorial={(id) => `/reportes?alumno=${id}`} />);
        await userEvent.click(screen.getByRole('button', { name: /Ver tabla completa/ }));
        const [primero] = screen.getAllByRole('button', { name: /Ver el detalle de/ });
        expect(primero).not.toHaveAttribute('aria-controls');
        await userEvent.click(primero);
        expect(primero).toHaveAttribute('aria-expanded', 'true');
        // el botón apunta a la fila que despliega
        const fila = document.getElementById(primero.getAttribute('aria-controls'));
        expect(fila).toBeInTheDocument();
        expect(fila).toHaveTextContent('Acción sugerida:');
        // objetivo táctil de 44 px en móvil
        expect(primero.className).toContain('min-h-11');
        expect(screen.getByRole('button', { name: 'Alumno' }).className).toContain('min-h-11');
        expect(screen.getByText(/Acción sugerida:/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: /Ver historial/ })).toHaveAttribute('href', expect.stringMatching(/^\/reportes\?alumno=\d+$/));
        expect(screen.getByRole('button', { name: /Ver el procedimiento del puntaje/ })).toHaveAttribute('aria-expanded', 'false');
    });
    it('las columnas secundarias se esconden en pantallas angostas pero se muestran al imprimir', async () => {
        render(<TablaRiesgo items={a.alumnosEnRiesgo} evaluados={a.resumen.alumnosEvaluados} />);
        await userEvent.click(screen.getByRole('button', { name: /Ver tabla completa/ }));
        for (const nombre of ['Tendencia', 'Restantes', 'Cruce (sem.)']) {
            const th = screen.getByRole('columnheader', { name: new RegExp(nombre.replace(/[()]/g, '\\$&')) });
            expect(th.className).toContain('hidden');
            expect(th.className).toContain('print:table-cell');
        }
    });
    it('sin alumnos en riesgo: dona con todos en nivel bajo y aviso en lugar del ranking', () => {
        render(<TablaRiesgo items={[]} evaluados={12} />);
        expect(screen.getByRole('group', { name: 'Distribución por nivel' })).toBeInTheDocument();
        // el aviso visible y el texto alternativo (sr-only) de la tarjeta vacía
        expect(screen.getAllByText('Ningún alumno en riesgo con los datos actuales.').length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByRole('button', { name: /Ver tabla completa/ })).toBeNull();
    });
    it('sin evaluados ni riesgo solo muestra el aviso', () => {
        render(<TablaRiesgo items={[]} />);
        expect(screen.queryByRole('group')).toBeNull();
        expect(screen.getByText('Ningún alumno en riesgo con los datos actuales.')).toBeInTheDocument();
    });
});

describe('PanelProcedimiento', () => {
    it('plegado por defecto; al abrir muestra un procedimiento por sección y las iteraciones plegadas', async () => {
        render(<PanelProcedimiento procedimientos={a.procedimientos} />);
        const general = screen.getByRole('button', { name: /Ver el procedimiento paso a paso/ });
        expect(general).toHaveAttribute('aria-expanded', 'false');
        await userEvent.click(general);
        expect(general).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByRole('button', { name: /Riesgo del alumno/ })).toHaveAttribute('aria-expanded', 'false');
        const iter = screen.queryAllByRole('button', { name: /Ver las iteraciones/ });
        iter.forEach((b) => expect(b).toHaveAttribute('aria-expanded', 'false'));
    });
    it('sin procedimientos muestra un aviso corto', () => {
        render(<PanelProcedimiento procedimientos={[]} />);
        expect(screen.getByText(/Aún no hay procedimientos/)).toBeInTheDocument();
    });
});

describe('AlertasAnalitica, TarjetasAnalitica y SelectorGrupo', () => {
    it('muestra 3 alertas y pliega el resto', async () => {
        const alertas = [1, 2, 3, 4, 5].map((n) => ({ codigo: `C${n}`, nivel: n < 3 ? 'alta' : 'info', mensaje: `Mensaje ${n}` }));
        render(<AlertasAnalitica alertas={alertas} />);
        const boton = screen.getByRole('button', { name: /Ver 2 avisos más/ });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getAllByText(/Mensaje/)).toHaveLength(5); // las plegadas siguen en el DOM (Detalles las muestra al imprimir)
        await userEvent.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'true');
    });
    it('cada alerta conserva su código como referencia para soporte (data-codigo), sin mostrarlo', () => {
        const alertas = [1, 2, 3, 4].map((n) => ({ codigo: `ALUMNOS_${n}`, nivel: 'media', mensaje: `Mensaje ${n}` }));
        const { container } = render(<AlertasAnalitica alertas={alertas} />);
        expect([...container.querySelectorAll('[data-codigo]')].map((e) => e.dataset.codigo)).toEqual(['ALUMNOS_1', 'ALUMNOS_2', 'ALUMNOS_3', 'ALUMNOS_4']);
        expect(screen.queryByText(/ALUMNOS_1/)).toBeNull();
    });
    it('sin alertas no pinta nada; con pocas no hay pliegue', () => {
        const { container, rerender } = render(<AlertasAnalitica alertas={[]} />);
        expect(container).toBeEmptyDOMElement();
        rerender(<AlertasAnalitica alertas={[{ codigo: 'X', nivel: 'media', mensaje: 'Solo una' }]} />);
        expect(screen.queryByRole('button')).toBeNull();
    });
    it('la franja trae las cuatro cifras clave', () => {
        render(<TarjetasAnalitica {...a} limitePct={20} />);
        for (const t of ['Ausentismo actual', 'Proyección al cierre', 'Cruce del límite', 'Alumnos en riesgo']) expect(screen.getByText(t)).toBeInTheDocument();
        expect(screen.getByText(String(a.resumen.alumnosEnRiesgo))).toBeInTheDocument();
    });
    it('el selector avisa el cambio de grupo y limpia el grupo al cambiar el periodo', async () => {
        const onCambio = vi.fn();
        render(
            <SelectorGrupo periodos={['2026-1', '2026-2']} grupos={[{ id_grupo: 7, materia_nombre: 'Cálculo', clave_grupo: '3A' }]} valor={{ periodo: '2026-2', idGrupo: null }} onCambio={onCambio} />,
        );
        await userEvent.selectOptions(screen.getByLabelText('Grupo'), '7');
        expect(onCambio).toHaveBeenLastCalledWith({ periodo: '2026-2', idGrupo: 7 });
        await userEvent.selectOptions(screen.getByLabelText('Periodo'), '2026-1');
        expect(onCambio).toHaveBeenLastCalledWith({ periodo: '2026-1', idGrupo: null });
    });
});
