import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { analizarGrupo } from '@/lib/numerics';
import AlertasAnalitica from './AlertasAnalitica';
import GraficaAcumulado from './GraficaAcumulado';
import GraficaSerie from './GraficaSerie';
import PanelProcedimiento from './PanelProcedimiento';
import PatronSemanal from './PatronSemanal';
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
const alumnos = Array.from({ length: 5 }, (_, i) => ({
    id_alumno: i + 1, matricula: `E${i}`, nombre: `Alumno ${i}`, estados: fechas.map((_f, k) => (i < 2 && k > 5 ? 'ausente' : 'presente')),
}));
const a = analizarGrupo({ serie: { sesiones }, matriz: { fechas, alumnos }, limitePct: 20, sesionesProgramadas: 48 });

describe('render de componentes de analítica', () => {
    it('panel, tablas y tarjetas se pintan sin lanzar', () => {
        const panel = renderToString(<PanelProcedimiento procedimientos={a.procedimientos} />);
        expect(panel).toContain('Ver el procedimiento paso a paso');
        const riesgo = renderToString(<TablaRiesgo items={a.alumnosEnRiesgo} hrefHistorial={(id) => `/reportes?alumno=${id}`} />);
        expect(riesgo).toContain('Alumnos en riesgo');
        expect(renderToString(<TablaRiesgo items={[]} />)).toContain('Ningún alumno en riesgo');
        const tarjetas = renderToString(<TarjetasAnalitica {...a} limitePct={20} />);
        expect(tarjetas).toContain('Cruce del límite');
        expect(tarjetas).toContain('Alumnos en riesgo');
        expect(renderToString(<AlertasAnalitica alertas={a.alertas} />)).toContain('Alertas del análisis');
    });
    it('las gráficas reservan su alto en el servidor sin dibujar (el ancho solo se mide en el cliente), así que hidratan sin diferencias', () => {
        const serie = renderToString(<GraficaSerie tendencia={a.tendencia} suavizado={a.suavizado} proyeccion={a.proyeccion} resumen={a.resumen} cruceLimite={a.cruceLimite} limitePct={20} />);
        expect(serie).toContain('Ausentismo semanal');
        expect(serie).toContain('height:280px');
        expect(serie).not.toContain('<svg');
        const acumulado = renderToString(<GraficaAcumulado cruceLimite={a.cruceLimite} limitePct={20} />);
        expect(acumulado).toContain('Faltas acumuladas y límite');
        expect(acumulado).toContain('height:280px');
        expect(acumulado).not.toContain('<svg');
    });
    it('sin datos las gráficas de línea dan su aviso en el servidor', () => {
        const corto = analizarGrupo({ serie: { sesiones: sesiones.slice(0, 6) }, sesionesProgramadas: 48 });
        expect(renderToString(<GraficaSerie tendencia={corto.tendencia} suavizado={corto.suavizado} proyeccion={corto.proyeccion} resumen={corto.resumen} cruceLimite={corto.cruceLimite} />)).toContain('Datos insuficientes');
        expect(renderToString(<GraficaAcumulado cruceLimite={corto.cruceLimite} />)).toContain('Datos insuficientes');
    });
    it('el patrón semanal, el anillo y el ranking de riesgo se pintan en el servidor con sus cifras', () => {
        const patron = renderToString(<PatronSemanal patronSemanal={a.patronSemanal} />);
        expect(patron).toContain('Ausentismo por día de la semana');
        expect(patron).toContain('data-casilla');
        expect(renderToString(<PatronSemanal patronSemanal={{ dias: [] }} />)).toContain('Sin sesiones cerradas para calcular el patrón.');
        const riesgo = renderToString(<TablaRiesgo items={a.alumnosEnRiesgo} evaluados={a.resumen.alumnosEvaluados} />);
        expect(riesgo).toContain('Distribución por nivel');
        expect(riesgo).toContain('data-fila');
    });
    it('las tarjetas con línea de tendencia se pintan en el servidor', () => {
        const tarjetas = renderToString(<TarjetasAnalitica {...a} limitePct={20} />);
        expect(tarjetas).toContain('Ausentismo actual');
        // Cada línea de tendencia trae un linearGradient; los iconos Lucide también son <svg>, por eso no se cuenta <svg.
        // Solo 'Ausentismo actual' y 'Cruce del límite' llevan serie (la proyección y los alumnos en riesgo no).
        expect(tarjetas.match(/<linearGradient/g)).toHaveLength(2);
        const sinSerie = renderToString(<TarjetasAnalitica {...a} tendencia={undefined} cruceLimite={{ ...a.cruceLimite, estado: 'insuficiente' }} limitePct={20} />);
        expect(sinSerie).not.toContain('<linearGradient');
        const sinTendencia = renderToString(<TarjetasAnalitica {...a} tendencia={undefined} limitePct={20} />);
        expect(sinTendencia.match(/<linearGradient/g)).toHaveLength(1);
    });
});
