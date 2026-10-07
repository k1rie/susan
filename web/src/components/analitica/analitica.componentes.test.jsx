// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { analizarGrupo } from '@/lib/numerics';
import AlertasAnalitica from './AlertasAnalitica';
import GraficaAcumulado from './GraficaAcumulado';
import GraficaSerie from './GraficaSerie';
import PanelProcedimiento from './PanelProcedimiento';
import PatronSemanal from './PatronSemanal';
import SelectorGrupo from './SelectorGrupo';
import TablaRiesgo from './TablaRiesgo';
import TarjetasAnalitica from './TarjetasAnalitica';
import { datosUsoLimite, fmtNum, topRiesgo } from './analitica.utils.js';

// jsdom no trae ResizeObserver ni matchMedia. GraficaLinea mide su ancho con ResizeObserver (sin él reserva el alto y no dibuja) y se
// simula "reducir movimiento" para que nada espere a IntersectionObserver ni a una animación.
function simularEntorno({ ancho = 640, reducido = true } = {}) {
    class Observador {
        constructor(callback) {
            this.callback = callback;
        }
        observe(nodo) {
            this.callback([{ target: nodo, contentRect: { width: ancho } }]);
        }
        unobserve() {}
        disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', Observador);
    vi.stubGlobal('matchMedia', () => ({ matches: reducido, addEventListener() {}, removeEventListener() {} }));
}

afterEach(() => {
    vi.unstubAllGlobals();
});

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

const trazo = (contenedor, clave) => contenedor.querySelector(`path[data-serie="${clave}"]`);
const puntos = (contenedor, clave) => [...contenedor.querySelectorAll(`circle[data-serie="${clave}"]`)];

describe('GraficaSerie', () => {
    const dibujar = (props = {}) => render(<GraficaSerie tendencia={a.tendencia} suavizado={a.suavizado} proyeccion={a.proyeccion} resumen={a.resumen} cruceLimite={a.cruceLimite} limitePct={20} {...props} />);

    it('es un grupo con texto alternativo "de X a Y" y alterna las medias móviles (la EMA activa por defecto)', async () => {
        simularEntorno();
        const { container } = dibujar();
        const grupo = screen.getByRole('group', { name: 'Ausentismo semanal' });
        expect(grupo).toHaveAccessibleDescription(/^Ausentismo semanal: el ausentismo va de .* en la semana 1 a .* en la semana 8/);
        // la dirección y la pendiente de la tendencia (antes una tarjeta) se ven bajo el título
        expect(screen.getByText(/^Tendencia .*pp por semana/)).toBeInTheDocument();
        const ema = screen.getByRole('checkbox', { name: 'EMA' });
        expect(ema).toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'SMA' })).not.toBeChecked();
        expect(screen.getByRole('checkbox', { name: 'WMA' })).not.toBeChecked();
        // el interruptor mueve la línea de la media (y su entrada de la leyenda)
        expect(trazo(container, 'ema')).toBeInTheDocument();
        expect(trazo(container, 'sma')).toBeNull();
        await userEvent.click(ema);
        expect(ema).not.toBeChecked();
        expect(trazo(container, 'ema')).toBeNull();
        await userEvent.click(screen.getByRole('checkbox', { name: 'SMA' }));
        expect(trazo(container, 'sma')).toBeInTheDocument();
        // la media aparece también en la leyenda (junto al interruptor)
        expect(screen.getAllByText('SMA')).toHaveLength(2);
    });
    it('dibuja observada (puntos), ajuste (línea), proyección (discontinua) y la banda del intervalo', () => {
        simularEntorno();
        const { container } = dibujar();
        const semanasObservadas = a.tendencia.tasas.filter((t) => t != null).length;
        expect(puntos(container, 'observada')).toHaveLength(semanasObservadas);
        expect(trazo(container, 'ajuste')).toHaveAttribute('stroke', 'var(--g-azul)');
        expect(trazo(container, 'proyeccion')).toHaveAttribute('stroke-dasharray', '6 4');
        expect(trazo(container, 'banda').getAttribute('d')).toMatch(/Z$/);
        // las líneas son rectas entre puntos: ninguna curva
        expect(trazo(container, 'ajuste').getAttribute('d')).not.toMatch(/[CQSA]/);
    });
    it('la leyenda distingue ajuste, proyección e intervalo por su forma, no solo por el color', () => {
        simularEntorno();
        const { container } = dibujar();
        // los interruptores de las medias repiten "EMA" como texto: la leyenda es la lista que lleva las muestras de forma
        const leyenda = within([...container.querySelectorAll('ul')].find((ul) => ul.querySelector('[data-forma]')));
        const forma = (texto) => leyenda.getByText(texto).querySelector('[data-forma]').dataset.forma;
        expect(forma('Observada')).toBe('punto');
        expect(forma('Ajuste')).toBe('linea');
        expect(forma('Proyección')).toBe('discontinua');
        expect(forma('Intervalo 95 %')).toBe('banda');
        expect(forma('EMA')).toBe('linea');
    });
    it('el límite lleva su etiqueta: dentro de la gráfica si cabe y en la leyenda (una sola vez) en pantallas angostas', () => {
        simularEntorno({ ancho: 640 });
        const { container, unmount } = dibujar();
        expect(container.querySelector('[data-etiqueta="limite"]')).toHaveTextContent('Límite 20 %');
        expect(screen.getAllByText('Límite 20 %')).toHaveLength(1);
        unmount();
        simularEntorno({ ancho: 300 });
        const angosta = dibujar();
        expect(angosta.container.querySelector('[data-etiqueta="limite"]')).toBeNull();
        expect(screen.getAllByText('Límite 20 %')).toHaveLength(1);
        // la línea del límite se dibuja siempre
        expect(angosta.container.querySelector('line.stroke-destructive')).toBeInTheDocument();
    });
    it('el eje Y incluye el límite aunque todos los datos queden por debajo', () => {
        simularEntorno();
        const { container } = dibujar({ limitePct: 60 });
        const marcas = [...container.querySelectorAll('text')].map((t) => t.textContent);
        expect(marcas).toContain('60 %');
    });
    it('con el teclado recorre las semanas: el tooltip da el rango del intervalo y omite lo que falta, y se anuncia en aria-live', async () => {
        simularEntorno();
        const { container } = dibujar();
        const lienzo = screen.getByRole('group', { name: /Tasa semanal de ausentismo/ });
        const vivo = container.querySelector('[aria-live="polite"]');
        expect(vivo).toBeEmptyDOMElement();
        expect(container.querySelector('[data-slot="tooltip-linea"]')).toBeNull();
        lienzo.focus();
        fireEvent.keyDown(lienzo, { key: 'Home' });
        const tooltip = () => container.querySelector('[data-slot="tooltip-linea"]');
        expect(within(tooltip()).getByText('Semana 1')).toBeInTheDocument();
        // semana 1: hay observada y ajuste; todavía no hay proyección ni intervalo
        expect(within(tooltip()).getByText('Observada').parentElement).toHaveTextContent(/\d+\.\d %$/);
        expect(within(tooltip()).queryByText('Proyección')).toBeNull();
        expect(within(tooltip()).queryByText('Intervalo 95 %')).toBeNull();
        expect(vivo).toHaveTextContent(/^Semana 1\. Observada: /);
        fireEvent.keyDown(lienzo, { key: 'End' });
        const ultima = within(tooltip());
        expect(ultima.getByText('Intervalo 95 %').parentElement).toHaveTextContent(/\d+\.\d % a \d+\.\d %$/);
        expect(ultima.queryByText('Observada')).toBeNull();
        expect(vivo).toHaveTextContent(/Intervalo 95 %: .* a /);
        fireEvent.keyDown(lienzo, { key: 'Escape' });
        expect(tooltip()).toBeNull();
        expect(vivo).toBeEmptyDOMElement();
    });
    it('con datos insuficientes muestra el aviso y conserva el texto alternativo', () => {
        simularEntorno();
        const corto = analizarGrupo({ serie: { sesiones: sesiones.slice(0, 6) }, sesionesProgramadas: 48 });
        const { container } = dibujar({ tendencia: corto.tendencia, suavizado: corto.suavizado, proyeccion: corto.proyeccion, resumen: corto.resumen, cruceLimite: corto.cruceLimite, limitePct: undefined });
        expect(screen.getByText(/Datos insuficientes/)).toBeInTheDocument();
        expect(screen.queryByRole('checkbox')).toBeNull();
        expect(container.querySelector('svg')).toBeNull();
        expect(screen.getByRole('group', { name: 'Ausentismo semanal' })).toHaveAccessibleDescription(/datos insuficientes/);
    });
});

describe('GraficaAcumulado', () => {
    const cruza = { ...a.cruceLimite, estado: 'cruza', semana: 12, mensaje: 'Semana 12 (estimada)' };

    it('dibuja el acumulado (puntos), el ajuste, la proyección discontinua y el intervalo, y describe el cruce', () => {
        simularEntorno();
        const { container } = render(<GraficaAcumulado cruceLimite={a.cruceLimite} limitePct={20} />);
        const observados = a.cruceLimite.acumulado.valores.filter((v) => v != null).length;
        expect(puntos(container, 'acumulado')).toHaveLength(observados);
        expect(trazo(container, 'ajuste')).toBeInTheDocument();
        expect(trazo(container, 'proyeccion')).toHaveAttribute('stroke-dasharray', '6 4');
        expect(trazo(container, 'banda')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Faltas acumuladas y límite' })).toHaveAccessibleDescription(new RegExp(a.cruceLimite.mensaje.replace(/[()]/g, '\\$&')));
        expect(screen.getByText(`Cruce: ${a.cruceLimite.mensaje}`)).toBeInTheDocument();
    });
    it('la leyenda también usa formas distintas para ajuste y proyección', () => {
        simularEntorno();
        render(<GraficaAcumulado cruceLimite={a.cruceLimite} limitePct={20} />);
        expect(screen.getByText('Acumulado').querySelector('[data-forma]').dataset.forma).toBe('punto');
        expect(screen.getByText('Ajuste').querySelector('[data-forma]').dataset.forma).toBe('linea');
        expect(screen.getByText('Proyección').querySelector('[data-forma]').dataset.forma).toBe('discontinua');
        expect(screen.getByText('Intervalo 95 %').querySelector('[data-forma]').dataset.forma).toBe('banda');
    });
    it('la semana estimada del cruce se marca en vertical con su etiqueta; sin cruce no hay marca', () => {
        simularEntorno();
        const { container, rerender } = render(<GraficaAcumulado cruceLimite={cruza} limitePct={20} />);
        expect(container.querySelector('[data-etiqueta="marca"]')).toHaveTextContent('S12');
        expect(container.querySelector('[data-etiqueta="limite"]')).toHaveTextContent('Límite 20 %');
        rerender(<GraficaAcumulado cruceLimite={{ ...a.cruceLimite, estado: 'no_cruza', semana: null, mensaje: 'No cruza dentro del periodo' }} limitePct={20} />);
        expect(container.querySelector('[data-etiqueta="marca"]')).toBeNull();
        rerender(<GraficaAcumulado cruceLimite={{ ...a.cruceLimite, estado: 'superado', semana: 6, mensaje: 'Ya superado' }} limitePct={20} />);
        expect(container.querySelector('[data-etiqueta="marca"]')).toBeNull();
    });
    it('el tooltip por teclado usa las filas de la serie del acumulado y omite las series sin valor en esa semana', () => {
        simularEntorno();
        const { container } = render(<GraficaAcumulado cruceLimite={a.cruceLimite} limitePct={20} />);
        const lienzo = screen.getByRole('group', { name: /Faltas acumuladas por semana/ });
        const tooltip = () => within(container.querySelector('[data-slot="tooltip-linea"]'));
        lienzo.focus();
        // semana 1: solo hay acumulado y ajuste; la proyección y su intervalo empiezan después de lo observado
        fireEvent.keyDown(lienzo, { key: 'Home' });
        expect(tooltip().getByText('Semana 1')).toBeInTheDocument();
        for (const etiqueta of ['Acumulado', 'Ajuste']) expect(tooltip().getByText(etiqueta)).toBeInTheDocument();
        for (const etiqueta of ['Proyección', 'Intervalo 95 %']) expect(tooltip().queryByText(etiqueta)).toBeNull();
        // última semana (solo proyección): proyección e intervalo, sin acumulado
        fireEvent.keyDown(lienzo, { key: 'End' });
        for (const etiqueta of ['Proyección', 'Intervalo 95 %']) expect(tooltip().getByText(etiqueta)).toBeInTheDocument();
        expect(tooltip().queryByText('Acumulado')).toBeNull();
    });
    it('sin datos muestra el aviso, sin dibujar nada', () => {
        simularEntorno();
        const { container } = render(<GraficaAcumulado cruceLimite={{ estado: 'insuficiente', mensaje: 'Datos insuficientes' }} />);
        expect(screen.getByText(/Datos insuficientes: se requieren/)).toBeInTheDocument();
        expect(container.querySelector('svg')).toBeNull();
        expect(screen.getByRole('group', { name: 'Faltas acumuladas y límite' })).toHaveAccessibleDescription(/datos insuficientes/);
    });
});

describe('PatronSemanal', () => {
    const dibujar = (patron = a.patronSemanal) => render(<PatronSemanal patronSemanal={patron} />);
    const casillas = (contenedor) => [...contenedor.querySelectorAll('[data-casilla]')];

    it('es un mapa de calor con una casilla por día (nombre en 3 letras y cifra) y descripción del día crítico', () => {
        simularEntorno();
        const { container } = dibujar();
        expect(casillas(container).map((c) => c.dataset.casilla)).toEqual(a.patronSemanal.dias.map((d) => d.nombre.slice(0, 3)));
        casillas(container).forEach((c) => expect(c).toHaveTextContent(/\d+(,\d)? ?%/));
        const grupo = screen.getByRole('group', { name: 'Ausentismo por día de la semana' });
        expect(grupo).toHaveAccessibleDescription(/ausencias? en \d+ sesiones?/);
        expect(screen.getByText(`Día crítico: ${a.patronSemanal.nombreDiaCritico}`)).toBeInTheDocument();
    });
    it('el día crítico lleva anillo en su casilla y se nombra en el detalle (no solo en color)', async () => {
        simularEntorno();
        const { container } = dibujar();
        const indice = a.patronSemanal.dias.findIndex((d) => d.critico);
        expect(indice).toBeGreaterThanOrEqual(0);
        const tira = container.querySelector('.\\@container');
        expect(tira.className).toContain(`[&_li:nth-child(${indice + 1})]:ring-2`);
        expect(tira.className).toContain(`[&_li:nth-child(${indice + 1})]:ring-destructive/70`);
        // la casilla crítica es la de mayor tasa
        const tasas = a.patronSemanal.dias.map((d) => d.tasa);
        expect(tasas[indice]).toBe(Math.max(...tasas));
        const boton = screen.getByRole('button', { name: 'Ver cifras por día' });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        await userEvent.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText('día crítico', { exact: false, selector: 'strong' })).toBeInTheDocument();
        // una fila por día en el detalle (el mismo texto también está en el resumen sr-only de la tarjeta)
        expect(screen.getAllByText(/ausencias? en \d+ sesiones?/, { selector: 'li' })).toHaveLength(a.patronSemanal.dias.length);
    });
    it('sin un día crítico no hay anillo ni marca', () => {
        simularEntorno();
        const sinCritico = { dias: a.patronSemanal.dias.map((d) => ({ ...d, critico: false })), diaCritico: null, nombreDiaCritico: null };
        const { container } = dibujar(sinCritico);
        expect(container.querySelector('.\\@container').className).not.toContain('ring-2');
        expect(screen.getByText('Sin un día claramente crítico')).toBeInTheDocument();
    });
    it('un día sin dato queda neutro ("sin datos"), no como 0 %', () => {
        simularEntorno();
        const patron = { dias: [{ dia: 1, nombre: 'Lunes', tasa: 0.12, sesiones: 4, ausentes: 6, critico: true }, { dia: 3, nombre: 'Miércoles', tasa: null, sesiones: 0, ausentes: 0, critico: false }], diaCritico: 1, nombreDiaCritico: 'Lunes' };
        const { container } = dibujar(patron);
        const [lunes, miercoles] = casillas(container);
        expect(lunes).toHaveTextContent(/12 ?%/);
        expect(miercoles).toHaveTextContent('sin datos');
        expect(miercoles).not.toHaveTextContent(/0 ?%/);
    });
    it('sin sesiones muestra el aviso, sin pie de cifras', () => {
        simularEntorno();
        dibujar({ dias: [] });
        expect(screen.getByText('Sin sesiones cerradas para calcular el patrón.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Ver cifras por día' })).toBeNull();
    });
    it('una sola casilla no desborda ni rompe (un único día con sesiones)', () => {
        simularEntorno();
        const { container } = dibujar({ dias: [{ dia: 2, nombre: 'Martes', tasa: 0.1, sesiones: 2, ausentes: 4, critico: false }], diaCritico: null, nombreDiaCritico: null });
        expect(casillas(container)).toHaveLength(1);
        expect(container.querySelector('.\\@container')).toHaveStyle({ maxWidth: '7rem' });
    });
});

describe('TablaRiesgo', () => {
    it('muestra anillo, ranking de píldoras y tabla plegada; la tabla se abre y se ordena', async () => {
        simularEntorno();
        expect(a.alumnosEnRiesgo.length).toBeGreaterThan(2);
        const { container } = render(<TablaRiesgo items={a.alumnosEnRiesgo} evaluados={a.resumen.alumnosEvaluados} hrefHistorial={(id) => `/reportes?alumno=${id}`} />);
        expect(screen.getByRole('heading', { name: 'Alumnos en riesgo' })).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Distribución por nivel' })).toHaveAccessibleDescription(/en riesgo/);
        expect(screen.getByRole('group', { name: 'Mayor riesgo' })).toHaveAccessibleDescription(/de 100/);
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
    it('el anillo da la distribución por nivel con su leyenda y el total en riesgo al centro', () => {
        simularEntorno();
        render(<TablaRiesgo items={a.alumnosEnRiesgo} evaluados={a.resumen.alumnosEvaluados} />);
        const tarjeta = within(screen.getByRole('group', { name: 'Distribución por nivel' }));
        const alto = a.alumnosEnRiesgo.filter((x) => x.nivel === 'alto').length;
        const medio = a.alumnosEnRiesgo.filter((x) => x.nivel === 'medio').length;
        const fila = (nivel) => tarjeta.getByText(nivel).closest('li');
        expect(fila('Alto')).toHaveTextContent(String(alto));
        expect(fila('Medio')).toHaveTextContent(String(medio));
        expect(fila('Bajo')).toHaveTextContent(String(a.resumen.alumnosEvaluados - alto - medio));
        expect(tarjeta.getByText('en riesgo')).toBeInTheDocument();
        expect(tarjeta.getByText(String(alto + medio), { selector: 'span.tabular-nums.font-semibold' })).toBeInTheDocument();
        expect(tarjeta.getByText(`${alto + medio} de ${a.resumen.alumnosEvaluados} alumnos en riesgo medio o alto`, { exact: false })).toBeInTheDocument();
    });
    it('el ranking lista a los de mayor puntaje con su nivel (color + leyenda) y el puntaje entero como cifra, igual que la tabla', () => {
        simularEntorno();
        const { container } = render(<TablaRiesgo items={a.alumnosEnRiesgo} evaluados={a.resumen.alumnosEvaluados} />);
        const tarjeta = screen.getByRole('group', { name: 'Mayor riesgo' });
        const top = topRiesgo(a.alumnosEnRiesgo);
        const filasRanking = [...tarjeta.querySelectorAll('[data-fila]')];
        expect(filasRanking.map((f) => f.dataset.fila)).toEqual(top.map((t) => t.alumno));
        // cada fila lleva la cifra del puntaje y el nivel como segmento (alto/medio)
        filasRanking.forEach((f, i) => {
            expect(f.querySelector('[data-cifra]')).toHaveTextContent(fmtNum(top[i].alto ?? top[i].medio, 0));
            expect(f.querySelector(`[data-segmento="${top[i].alto == null ? 'medio' : 'alto'}"]`)).toBeInTheDocument();
        });
        // la leyenda dice qué es cada color
        const leyenda = within(tarjeta).getAllByRole('listitem').filter((li) => li.querySelector('span.rounded-full[aria-hidden="true"]'));
        expect(leyenda.map((li) => li.textContent)).toEqual(['Alto', 'Medio']);
        // los nombres completos viven en el texto alternativo de la tarjeta
        expect(screen.getByRole('group', { name: 'Mayor riesgo' })).toHaveAccessibleDescription(/Alumno número \d+ \d+ de 100/);
        expect(container.querySelectorAll('[data-fila]').length).toBe(top.length);
    });
    it('un puntaje con decimales se escribe entero en el ranking, igual que en la tabla y el texto alternativo', () => {
        simularEntorno();
        const items = [{ idAlumno: 1, matricula: 'A1', nombre: 'Ana Pérez', nivel: 'alto', puntaje: 69.3, faltasEq: 3, faltasMaximas: 9 }];
        const { container } = render(<TablaRiesgo items={items} evaluados={5} />);
        expect(container.querySelector('[data-fila] [data-cifra]').textContent).toBe('69');
        expect(screen.getByRole('group', { name: 'Mayor riesgo' })).toHaveAccessibleDescription('Alumnos de mayor riesgo, de 1 de 1: Ana Pérez 69 de 100 (alto).');
    });
    it('el detalle del alumno trae acción, factores, enlace y procedimiento plegado', async () => {
        simularEntorno();
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
    it('cada fila de la tabla lleva una barra con el uso de su límite de faltas (lo que ya faltó frente a lo que le queda)', async () => {
        simularEntorno();
        render(<TablaRiesgo items={a.alumnosEnRiesgo} evaluados={a.resumen.alumnosEvaluados} />);
        await userEvent.click(screen.getByRole('button', { name: /Ver tabla completa/ }));
        const filas = screen.getAllByRole('row').slice(1);
        expect(filas).toHaveLength(a.alumnosEnRiesgo.length);
        for (const [i, fila] of filas.entries()) {
            const esperado = datosUsoLimite(a.alumnosEnRiesgo[i]);
            const barra = within(fila).queryByRole('img');
            expect(esperado).not.toBeNull();
            expect(barra).toHaveAccessibleName(esperado.etiqueta);
            // sin leyenda (cabe en la celda): solo segmentos
            expect(barra.querySelectorAll('[data-segmento]').length).toBe(2);
            expect(barra.parentElement.className).toContain('min-w-14');
        }
    });
    it('las columnas secundarias se esconden en pantallas angostas pero se muestran al imprimir', async () => {
        simularEntorno();
        render(<TablaRiesgo items={a.alumnosEnRiesgo} evaluados={a.resumen.alumnosEvaluados} />);
        await userEvent.click(screen.getByRole('button', { name: /Ver tabla completa/ }));
        for (const nombre of ['Tendencia', 'Restantes', 'Cruce (sem.)']) {
            const th = screen.getByRole('columnheader', { name: new RegExp(nombre.replace(/[()]/g, '\\$&')) });
            expect(th.className).toContain('hidden');
            expect(th.className).toContain('print:table-cell');
        }
    });
    it('la tabla va en un contenedor con desplazamiento horizontal propio (no ensancha la página a 360 px)', async () => {
        simularEntorno();
        render(<TablaRiesgo items={a.alumnosEnRiesgo} evaluados={a.resumen.alumnosEvaluados} />);
        await userEvent.click(screen.getByRole('button', { name: /Ver tabla completa/ }));
        expect(screen.getByRole('table').parentElement.className).toContain('overflow-x-auto');
    });
    it('sin alumnos en riesgo: anillo con todos en nivel bajo y aviso en lugar del ranking', () => {
        simularEntorno();
        render(<TablaRiesgo items={[]} evaluados={12} />);
        const tarjeta = within(screen.getByRole('group', { name: 'Distribución por nivel' }));
        expect(tarjeta.getByText('Bajo').closest('li')).toHaveTextContent('12');
        expect(tarjeta.getByText('Alto').closest('li')).toHaveTextContent('0');
        // el aviso visible y el texto alternativo (sr-only) de la tarjeta vacía
        expect(screen.getAllByText('Ningún alumno en riesgo con los datos actuales.').length).toBeGreaterThanOrEqual(1);
        expect(screen.queryByRole('button', { name: /Ver tabla completa/ })).toBeNull();
    });
    it('sin evaluados ni riesgo solo muestra el aviso', () => {
        simularEntorno();
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

// La tarjeta (panel blanco) de una etiqueta y la línea de tendencia (sparkline): su svg va en un contenedor aria-hidden; el del icono, no.
const tarjeta = (etiqueta) => screen.getByText(etiqueta).closest('.rounded-xl');
const LINEA = 'div[aria-hidden="true"] svg';
// Un caso armado a mano para fijar cifras, estados y series (sin depender de la simulación de `a`).
const caso = {
    resumen: { suficiente: true, tasaActual: 26.4, variacionPP: 9.7, alumnosEvaluados: 12, alumnosEnRiesgo: 4, alumnosSuperanLimite: 1 },
    tendencia: { tasas: [0.09, 0.16, 0.18, 0.14, 0.264] },
    proyeccion: { disponible: true, puntos: [{ semana: 12, valor: 0.3125, inferior: 0.2, superior: 0.4 }] },
    cruceLimite: { estado: 'cruza', semana: 14, acumulado: { semanas: [1, 2, 3, 4], valores: [1, 2.5, 4, 6.2] } },
};

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
        simularEntorno();
        render(<TarjetasAnalitica {...a} limitePct={20} />);
        for (const t of ['Ausentismo actual', 'Proyección al cierre', 'Cruce del límite', 'Alumnos en riesgo']) expect(screen.getByText(t)).toBeInTheDocument();
        expect(screen.getByText(String(a.resumen.alumnosEnRiesgo))).toBeInTheDocument();
    });
    it('la línea de tendencia solo sale en las tarjetas con una serie observada real: ausentismo actual y cruce del límite', () => {
        simularEntorno();
        render(<TarjetasAnalitica {...a} limitePct={20} />);
        const linea = (etiqueta) => tarjeta(etiqueta).querySelector(LINEA);
        expect(linea('Ausentismo actual')).toBeInTheDocument();
        expect(linea('Cruce del límite')).toBeInTheDocument();
        // la proyección es una estimación y los alumnos en riesgo no tienen historial: ahí no se inventa una línea
        expect(linea('Proyección al cierre')).toBeNull();
        expect(linea('Alumnos en riesgo')).toBeNull();
        // decorativa: la tendencia ya está escrita en el texto de apoyo
        expect(linea('Ausentismo actual').closest('[aria-hidden="true"]')).not.toBeNull();
        expect(screen.getByText(/vs\. semana previa/)).toBeInTheDocument();
    });
    it('sin la tendencia (o con una sola semana con datos) no hay línea en el ausentismo actual', () => {
        simularEntorno();
        const { container, rerender } = render(<TarjetasAnalitica {...a} tendencia={undefined} cruceLimite={{ ...a.cruceLimite, estado: 'insuficiente' }} limitePct={20} />);
        expect(container.querySelector(LINEA)).toBeNull();
        rerender(<TarjetasAnalitica {...a} tendencia={{ ...a.tendencia, tasas: [null, null, 0.1] }} cruceLimite={null} limitePct={20} />);
        expect(container.querySelector(LINEA)).toBeNull();
        // los iconos de las tarjetas siguen ahí: solo falta la línea
        expect(container.querySelectorAll('svg.lucide')).toHaveLength(4);
    });
    it('cada tarjeta lleva su icono de Lucide decorativo y, donde hay serie observada, convive con la línea de tendencia', () => {
        simularEntorno();
        render(<TarjetasAnalitica {...a} limitePct={20} />);
        const esperados = {
            'Ausentismo actual': 'lucide-gauge',
            'Proyección al cierre': 'lucide-trending-up',
            'Cruce del límite': 'lucide-flag',
            'Alumnos en riesgo': 'lucide-shield-alert',
        };
        for (const [etiqueta, clase] of Object.entries(esperados)) {
            const icono = tarjeta(etiqueta).querySelector('svg.lucide');
            expect(icono, etiqueta).toHaveClass(clase);
            expect(icono).toHaveAttribute('aria-hidden', 'true');
        }
        // icono (pastilla) + línea: dos svg donde hay serie, uno donde no
        expect(tarjeta('Ausentismo actual').querySelectorAll('svg')).toHaveLength(2);
        expect(tarjeta('Cruce del límite').querySelectorAll('svg')).toHaveLength(2);
        expect(tarjeta('Proyección al cierre').querySelectorAll('svg')).toHaveLength(1);
        expect(tarjeta('Alumnos en riesgo').querySelectorAll('svg')).toHaveLength(1);
    });
    it('los porcentajes llevan la cifra y el «%» como unidad aparte; el cruce y los alumnos, no', () => {
        simularEntorno();
        render(<TarjetasAnalitica {...caso} limitePct={20} />);
        const actual = within(tarjeta('Ausentismo actual'));
        expect(actual.getByText('26.4')).toBeInTheDocument();
        expect(actual.getByText('%')).toHaveClass('text-muted-foreground');
        expect(actual.getByText('+9.7 pp vs. semana previa')).toBeInTheDocument();
        const proyeccion = within(tarjeta('Proyección al cierre'));
        expect(proyeccion.getByText('31.3')).toBeInTheDocument();
        expect(proyeccion.getByText('%')).toBeInTheDocument();
        expect(proyeccion.getByText('Semana 12 (20 % a 40 %)')).toBeInTheDocument();
        expect(within(tarjeta('Cruce del límite')).getByText('Semana 14')).toBeInTheDocument();
        expect(within(tarjeta('Cruce del límite')).queryByText('%')).toBeNull();
        expect(within(tarjeta('Alumnos en riesgo')).getByText('4')).toBeInTheDocument();
        expect(within(tarjeta('Alumnos en riesgo')).queryByText('%')).toBeNull();
    });
    it('la pastilla y el apoyo toman el color del estado (ausentismo sobre el límite, cruce estimado, alumnos sobre el límite)', () => {
        simularEntorno();
        render(<TarjetasAnalitica {...caso} limitePct={20} />);
        const pastilla = (etiqueta) => tarjeta(etiqueta).querySelector('svg.lucide').parentElement;
        expect(pastilla('Ausentismo actual')).toHaveClass('bg-ausente-bg', 'text-ausente');
        expect(within(tarjeta('Ausentismo actual')).getByText('+9.7 pp vs. semana previa')).toHaveClass('text-ausente');
        expect(pastilla('Proyección al cierre')).toHaveClass('bg-muted');
        expect(pastilla('Cruce del límite')).toHaveClass('bg-retardo-bg', 'text-retardo');
        expect(within(tarjeta('Cruce del límite')).getByText('Estimada, límite de 20 %')).toHaveClass('text-retardo');
        expect(pastilla('Alumnos en riesgo')).toHaveClass('bg-ausente-bg', 'text-ausente');
        expect(within(tarjeta('Alumnos en riesgo')).getByText('de 12; 1 sobre el límite')).toHaveClass('text-ausente');
        // la cifra va en tinta aunque el estado sea de alerta
        expect(within(tarjeta('Ausentismo actual')).getByText('26.4').closest('p')).toHaveClass('text-foreground');
    });
    it('sin análisis suficiente no inventa cifras: guion, sin unidad ni línea, y los apoyos lo dicen', () => {
        simularEntorno();
        const { container } = render(<TarjetasAnalitica resumen={{ suficiente: false }} limitePct={20} />);
        for (const etiqueta of ['Ausentismo actual', 'Proyección al cierre', 'Cruce del límite', 'Alumnos en riesgo']) {
            expect(within(tarjeta(etiqueta)).getByText('-')).toBeInTheDocument();
        }
        expect(screen.queryByText('%')).toBeNull();
        expect(container.querySelector(LINEA)).toBeNull();
        expect(screen.getAllByText('Faltan semanas')).toHaveLength(2);
        expect(screen.getByText('Sin matriz de asistencia')).toBeInTheDocument();
    });
    it('a 360 px las tarjetas van en una columna (icono, cifra, apoyo y línea con holgura), pasan a 2 desde 480 px y a 4 solo en escritorio ancho (xl)', () => {
        simularEntorno();
        render(<TarjetasAnalitica {...a} limitePct={20} />);
        expect(screen.getByRole('region', { name: 'Indicadores del análisis' })).toHaveClass('grid-cols-1', 'min-[480px]:grid-cols-2', 'xl:grid-cols-4');
    });
    it('el selector avisa el cambio de grupo y limpia el grupo al cambiar el periodo', async () => {
        const onCambio = vi.fn();
        render(
            <SelectorGrupo periodos={['2026-1', '2026-2']} grupos={[{ id_grupo: 7, materia_nombre: 'Cálculo', clave_grupo: '3A' }]} valor={{ periodo: '2026-2', idGrupo: null }} onCambio={onCambio} />,
        );
        // El grupo se busca en un selector con búsqueda (materia y clave en la opción), no en un <select>.
        await userEvent.click(screen.getByRole('combobox', { name: 'Grupo' }));
        await userEvent.click(await screen.findByRole('option', { name: /Cálculo · 3A/ }));
        expect(onCambio).toHaveBeenLastCalledWith({ periodo: '2026-2', idGrupo: 7 });
        await userEvent.selectOptions(screen.getByLabelText('Periodo'), '2026-1');
        expect(onCambio).toHaveBeenLastCalledWith({ periodo: '2026-1', idGrupo: null });
    });
});
