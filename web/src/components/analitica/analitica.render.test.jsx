import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { analizarGrupo } from '@/lib/numerics';
import AlertasAnalitica from './AlertasAnalitica';
import PanelProcedimiento from './PanelProcedimiento';
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
        expect(panel).toContain('<details');
        const riesgo = renderToString(<TablaRiesgo items={a.alumnosEnRiesgo} hrefHistorial={(id) => `/reportes?alumno=${id}`} />);
        expect(riesgo).toContain('Alumnos en riesgo');
        expect(renderToString(<TablaRiesgo items={[]} />)).toContain('Ningún alumno en riesgo');
        expect(renderToString(<TarjetasAnalitica {...a} limitePct={20} />)).toContain('Cruce del límite');
        expect(renderToString(<AlertasAnalitica alertas={a.alertas} />)).toContain('Código');
    });
});
