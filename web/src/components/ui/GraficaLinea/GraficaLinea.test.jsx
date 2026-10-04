// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cajasSeSolapan } from '@/lib/graficasGeometria.js';
import GraficaLinea from './GraficaLinea.jsx';

const pct = (v) => `${v} %`;

const SERIES = [
    { clave: 'observada', tipo: 'puntos', color: 'var(--foreground)', etiqueta: 'Observada' },
    { clave: 'ajuste', tipo: 'linea', color: 'var(--chart-1)', etiqueta: 'Ajuste' },
    { clave: 'proyeccion', tipo: 'linea', discontinua: true, color: 'var(--chart-1)', etiqueta: 'Proyección' },
    { clave: 'banda', tipo: 'banda', color: 'var(--chart-1)', etiqueta: 'Intervalo 95 %' },
];

// Semana 3 sin observación (hueco); proyección y banda solo desde la 4.
const DATOS = [
    { semana: 1, observada: 10, ajuste: 10.5 },
    { semana: 2, observada: 12, ajuste: 11.5 },
    { semana: 3, observada: null, ajuste: 12.5 },
    { semana: 4, observada: 15, ajuste: 13.5, proyeccion: 13.5, banda: [12, 15] },
    { semana: 5, proyeccion: 14.5, banda: [12.5, 16.5] },
];

// ResizeObserver de pruebas: avisa el ancho al observar (como hace el real).
function simularResize(ancho) {
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
}

function simularReducirMovimiento(reducir) {
    vi.stubGlobal('matchMedia', () => ({ matches: reducir, addEventListener() {}, removeEventListener() {} }));
}

class ObservadorInterseccion {
    static instancias = [];
    constructor(callback) {
        this.callback = callback;
        ObservadorInterseccion.instancias.push(this);
    }
    observe() {}
    disconnect() {}
    emitir(visible) {
        this.callback([{ isIntersecting: visible }]);
    }
}

function dibujar(props = {}, ancho = 600) {
    if (ancho !== null) simularResize(ancho);
    const resultado = render(
        <GraficaLinea datos={DATOS} ejeX="semana" series={SERIES} formatoX={(s) => `S${s}`} formatoY={pct} tituloTooltip={(f) => `Semana ${f.semana}`} ariaLabel="Ausentismo semanal" {...props} />,
    );
    return { ...resultado, grupo: screen.queryByRole('group', { name: 'Ausentismo semanal' }) };
}

const anuncio = (contenedor) => contenedor.querySelector('[aria-live="polite"]');
const puntosDe = (contenedor, clave) => [...contenedor.querySelectorAll(`circle[data-serie="${clave}"]`)];
const trazoDe = (contenedor, clave) => contenedor.querySelector(`path[data-serie="${clave}"]`);

afterEach(() => {
    vi.unstubAllGlobals();
    ObservadorInterseccion.instancias = [];
});

describe('GraficaLinea: tamaño e hidratación', () => {
    it('mientras no hay ancho medido reserva el alto y no dibuja nada', () => {
        vi.stubGlobal('ResizeObserver', undefined);
        const { container, grupo } = dibujar({}, null);
        expect(grupo).toHaveStyle({ height: '280px' });
        expect(container.querySelector('svg')).toBeNull();
        expect(container.querySelector('style')).toBeNull();
    });
    it('con ancho medido dibuja en píxeles reales (sin viewBox) y respeta el alto por prop', () => {
        const { container, grupo } = dibujar({ alto: 200 }, 480);
        const svg = container.querySelector('svg');
        expect(svg).toHaveAttribute('width', '480');
        expect(svg).toHaveAttribute('height', '200');
        expect(svg).not.toHaveAttribute('viewBox');
        expect(svg).toHaveAttribute('aria-hidden', 'true');
        expect(grupo).toHaveStyle({ height: '200px' });
    });
    it('el contenedor es focusable, es un grupo con nombre y acepta className', () => {
        const { grupo, container } = dibujar({ className: 'mi-clase' });
        expect(grupo).toHaveAttribute('tabindex', '0');
        expect(container.firstChild).toHaveClass('mi-clase');
    });
});

describe('GraficaLinea: series', () => {
    it('dibuja puntos con aro del color de la tarjeta, líneas rectas, la discontinua y la banda', () => {
        const { container } = dibujar();
        // Observada: tres valores (la semana 3 es un hueco)
        const puntos = puntosDe(container, 'observada');
        expect(puntos).toHaveLength(3);
        expect(puntos[0]).toHaveAttribute('stroke', 'var(--card)');
        expect(puntos[0]).toHaveAttribute('fill', 'var(--foreground)');
        expect(puntos[0]).toHaveAttribute('r', '4');
        // Ajuste: línea recta por 4 puntos (sin curvas)
        const ajuste = trazoDe(container, 'ajuste');
        expect(ajuste.getAttribute('d')).toMatch(/^M[\d. ]+( L[\d. ]+){3}$/);
        expect(ajuste).toHaveAttribute('stroke', 'var(--g-azul)');
        expect(ajuste).not.toHaveAttribute('stroke-dasharray', '6 4');
        // Proyección: discontinua
        expect(trazoDe(container, 'proyeccion')).toHaveAttribute('stroke-dasharray', '6 4');
        // Banda: polígono cerrado con degradado suave
        const banda = trazoDe(container, 'banda');
        expect(banda.getAttribute('d')).toMatch(/Z$/);
        expect(banda.getAttribute('fill')).toMatch(/^url\(#.+\)$/);
        expect(container.querySelectorAll('stop')).toHaveLength(2);
    });
    it('un valor null/undefined es un hueco que se une por encima (connectNulls) y no pinta punto', () => {
        const datos = [{ s: 1, a: 1, b: 5 }, { s: 2, a: null, b: 6 }, { s: 3, b: 7 }, { s: 4, a: 4, b: 8 }];
        const { container } = dibujar({ datos, ejeX: 's', series: [{ clave: 'a', tipo: 'linea', color: 'var(--chart-1)', etiqueta: 'A' }, { clave: 'b', tipo: 'puntos', color: 'var(--chart-3)', etiqueta: 'B' }] });
        const d = trazoDe(container, 'a').getAttribute('d');
        expect(d.match(/M/g)).toHaveLength(1);
        expect(d.match(/L/g)).toHaveLength(1);
        expect(puntosDe(container, 'b')).toHaveLength(4);
    });
    it('una banda con extremos nulos no se dibuja en esa fila y la banda sigue siendo un solo polígono', () => {
        const datos = [{ s: 1, banda: [1, 3] }, { s: 2, banda: [null, null] }, { s: 3, banda: [2, 5] }];
        const { container } = dibujar({ datos, ejeX: 's', series: [{ clave: 'banda', tipo: 'banda', color: 'var(--chart-1)', etiqueta: 'B' }] });
        expect(container.querySelectorAll('path[data-serie="banda"]')).toHaveLength(1);
        expect(trazoDe(container, 'banda').getAttribute('d').match(/L/g)).toHaveLength(3); // 2 puntos arriba + 2 abajo, el primero es M
    });
    it('no usa colores hex: todo sale de tokens', () => {
        const { container } = dibujar({ limite: { valor: 20, etiqueta: 'Límite 20 %' }, marcaX: { valor: 4, etiqueta: 'S4' } });
        expect(container.innerHTML).not.toMatch(/(fill|stroke|stop-color|background|border-color)(=|:\s*)"?#[0-9a-f]{3,8}/i);
    });
});

describe('GraficaLinea: ejes', () => {
    it('el eje Y usa marcas amigables con formatoY y una cuadrícula horizontal por marca', () => {
        const { container } = dibujar();
        const textos = [...container.querySelectorAll('svg text')].map((t) => t.textContent);
        expect(textos).toContain('0 %');
        const marcasY = textos.filter((t) => t.endsWith(' %'));
        expect(marcasY.length).toBeGreaterThanOrEqual(3);
        expect(container.querySelectorAll('svg line.stroke-border')).toHaveLength(marcasY.length);
    });
    it('el eje X formatea con formatoX', () => {
        const { container } = dibujar();
        const textos = [...container.querySelectorAll('svg text')].map((t) => t.textContent);
        expect(textos).toEqual(expect.arrayContaining(['S1', 'S3', 'S5']));
    });
    it('si las marcas del eje X no caben las adelgaza, siempre con la primera y la última', () => {
        const datos = Array.from({ length: 30 }, (_, i) => ({ semana: i + 1, observada: i }));
        const { container } = dibujar({ datos }, 340);
        const etiquetas = [...container.querySelectorAll('svg text')].map((t) => t.textContent).filter((t) => /^S\d+$/.test(t));
        expect(etiquetas.length).toBeLessThan(30);
        expect(etiquetas[0]).toBe('S1');
        expect(etiquetas.at(-1)).toBe('S30');
    });
});

describe('GraficaLinea: límite y marca vertical', () => {
    it('muestra el texto del límite y de la marca con sus líneas', () => {
        const { container } = dibujar({ limite: { valor: 20, etiqueta: 'Límite 20 %' }, marcaX: { valor: 4, etiqueta: 'Cruce S4' } });
        expect(screen.getByText('Límite 20 %')).toBeInTheDocument();
        expect(screen.getByText('Cruce S4')).toBeInTheDocument();
        expect(container.querySelector('svg line[stroke-dasharray="4 4"]')).toBeInTheDocument();
        expect(container.querySelectorAll('svg line.stroke-destructive')).toHaveLength(2);
    });
    it('el dominio Y incluye el límite aunque los datos sean menores', () => {
        const datos = [{ semana: 1, observada: 3 }, { semana: 2, observada: 6 }];
        const { container } = dibujar({ datos, series: [SERIES[0]], limite: { valor: 20, etiqueta: 'Límite 20 %' } });
        const linea = container.querySelector('svg line[stroke-dasharray="4 4"]');
        const y = Number(linea.getAttribute('y1'));
        expect(y).toBeGreaterThan(0);
        expect(y).toBeLessThan(280);
        const ultimaMarca = [...container.querySelectorAll('svg text')].map((t) => t.textContent).filter((t) => t.endsWith(' %'));
        expect(ultimaMarca).toContain('20 %');
        // el punto más alto de los datos (6) queda por debajo de la línea del límite
        const yDato = Math.min(...puntosDe(container, 'observada').map((c) => Number(c.getAttribute('cy'))));
        expect(yDato).toBeGreaterThan(y);
    });
    it('caso 20 % con último punto 19.7 %: la etiqueta, pegada al borde derecho, no choca con el punto ni sale del lienzo', () => {
        const datos = [{ semana: 1, observada: 15 }, { semana: 2, observada: 18 }, { semana: 3, observada: 19.7 }];
        const { container } = dibujar({ datos, series: [SERIES[0]], limite: { valor: 20, etiqueta: 'Límite 20 %' } }, 640);
        const etiqueta = screen.getByText('Límite 20 %');
        expect(etiqueta.tagName).toBe('SPAN');
        const caja = { x: parseFloat(etiqueta.style.left), y: parseFloat(etiqueta.style.top), width: parseFloat(etiqueta.style.width), height: parseFloat(etiqueta.style.height) };
        const ultimo = puntosDe(container, 'observada').at(-1);
        const punto = { x: Number(ultimo.getAttribute('cx')) - 6, y: Number(ultimo.getAttribute('cy')) - 6, width: 12, height: 12 };
        expect(cajasSeSolapan(caja, punto, 4)).toBe(false);
        expect(caja.x + caja.width).toBeLessThanOrEqual(640);
        expect(caja.x).toBeGreaterThan(Number(ultimo.getAttribute('cx')));
        // la línea del límite termina donde empieza la etiqueta
        const linea = container.querySelector('svg line[stroke-dasharray="4 4"]');
        expect(Number(linea.getAttribute('x2'))).toBeLessThan(caja.x);
        // la cercanía entre el punto y la línea es real (menos de 6 px): justo el caso que antes chocaba
        expect(Math.abs(Number(linea.getAttribute('y1')) - Number(ultimo.getAttribute('cy')))).toBeLessThan(6);
    });
    it('en ancho angosto (360 px) la etiqueta del límite va en la leyenda, una sola vez, y no dentro de la gráfica', () => {
        const datos = [{ semana: 1, observada: 15 }, { semana: 2, observada: 18 }, { semana: 3, observada: 19.7 }];
        const { container } = dibujar({ datos, series: [SERIES[0]], limite: { valor: 20, etiqueta: 'Límite 20 %' } }, 300);
        const apariciones = screen.getAllByText('Límite 20 %');
        expect(apariciones).toHaveLength(1);
        expect(apariciones[0].closest('li')).toBeInTheDocument();
        expect(container.querySelector('[data-etiqueta="limite"]')).toBeNull();
    });
    it('con leyenda desactivada la etiqueta del límite se queda dentro de la gráfica aunque sea angosta', () => {
        const { container } = dibujar({ leyenda: false, limite: { valor: 20, etiqueta: 'Límite 20 %' } }, 300);
        expect(container.querySelector('[data-etiqueta="limite"]')).toBeInTheDocument();
        expect(container.querySelector('ul')).toBeNull();
    });
});

describe('GraficaLinea: leyenda', () => {
    it('lleva la forma de cada serie, no solo el color', () => {
        const { container } = dibujar();
        const formas = [...container.querySelectorAll('ul [data-forma]')].map((n) => n.getAttribute('data-forma'));
        expect(formas).toEqual(['punto', 'linea', 'discontinua', 'banda']);
        expect(within(container.querySelector('ul')).getByText('Intervalo 95 %')).toBeInTheDocument();
    });
    it('acepta un nodo propio y se puede apagar', () => {
        const { container, rerender } = dibujar({ leyenda: <p>Leyenda propia</p> });
        expect(screen.getByText('Leyenda propia')).toBeInTheDocument();
        expect(container.querySelector('ul')).toBeNull();
        rerender(<GraficaLinea datos={DATOS} ejeX="semana" series={SERIES} leyenda={false} ariaLabel="Ausentismo semanal" />);
        expect(screen.queryByText('Leyenda propia')).toBeNull();
        expect(container.querySelector('ul')).toBeNull();
    });
});

describe('GraficaLinea: teclado y lector de pantalla', () => {
    it('una lista oculta trae cada fila sin pulsar teclas, y los huecos no inventan valores', () => {
        const { container } = dibujar();
        const lista = container.querySelector('ol');
        expect(lista).toHaveClass('sr-only');
        expect(lista).not.toHaveAttribute('aria-label'); // sin `etiquetaLista` no repite el ariaLabel (lleva la instrucción de teclado)
        expect(within(lista).getAllByRole('listitem').map((li) => li.textContent)).toEqual([
            'Semana 1. Observada: 10 %; Ajuste: 10.5 %',
            'Semana 2. Observada: 12 %; Ajuste: 11.5 %',
            'Semana 3. Ajuste: 12.5 %', // observada nula: no se lee
            'Semana 4. Observada: 15 %; Ajuste: 13.5 %; Proyección: 13.5 %; Intervalo 95 %: 12 % a 15 %',
            'Semana 5. Proyección: 14.5 %; Intervalo 95 %: 12.5 % a 16.5 %',
        ]);
        // la lista no es la leyenda ni está dentro del grupo interactivo, y la región aria-live sigue vacía hasta que se use el teclado
        expect(container.querySelector('[role="group"] ol')).toBeNull();
        expect(anuncio(container)).toBeEmptyDOMElement();
    });
    it('la lista oculta usa descripcionActivo cuando existe y no depende de la leyenda', () => {
        dibujar({ descripcionActivo: (f) => `Fila ${f.semana}`, leyenda: false, etiquetaLista: 'Valores por semana' });
        const lista = screen.getByRole('list', { name: 'Valores por semana' });
        expect(within(lista).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Fila 1', 'Fila 2', 'Fila 3', 'Fila 4', 'Fila 5']);
    });
    it('sin interacción activa no anuncia nada ni muestra tooltip', () => {
        const { container } = dibujar();
        expect(anuncio(container)).toBeInTheDocument();
        expect(anuncio(container)).toBeEmptyDOMElement();
        expect(container.querySelector('[data-slot="tooltip-linea"]')).toBeNull();
        expect(container.querySelector('[data-guia]')).toBeNull();
    });
    it('← → Home End mueven la fila activa y el texto aria-live; Esc la cierra', async () => {
        const usuario = userEvent.setup();
        const { container } = dibujar();
        await usuario.tab();
        const region = anuncio(container);
        await usuario.keyboard('{ArrowRight}');
        expect(region).toHaveTextContent('Semana 1. Observada: 10 %; Ajuste: 10.5 %');
        await usuario.keyboard('{ArrowRight}');
        expect(region).toHaveTextContent(/^Semana 2\./);
        await usuario.keyboard('{ArrowLeft}');
        expect(region).toHaveTextContent(/^Semana 1\./);
        await usuario.keyboard('{ArrowLeft}');
        expect(region).toHaveTextContent(/^Semana 1\./); // no se pasa del primero
        await usuario.keyboard('{End}');
        expect(region).toHaveTextContent('Semana 5. Proyección: 14.5 %; Intervalo 95 %: 12.5 % a 16.5 %');
        await usuario.keyboard('{ArrowRight}');
        expect(region).toHaveTextContent(/^Semana 5\./); // ni del último
        await usuario.keyboard('{Home}');
        expect(region).toHaveTextContent(/^Semana 1\./);
        expect(container.querySelector('[data-slot="tooltip-linea"]')).toBeInTheDocument();
        await usuario.keyboard('{Escape}');
        expect(region).toBeEmptyDOMElement();
        expect(container.querySelector('[data-slot="tooltip-linea"]')).toBeNull();
    });
    it('la fila con hueco se anuncia sin inventar el valor faltante', async () => {
        const usuario = userEvent.setup();
        const { container } = dibujar();
        await usuario.tab();
        await usuario.keyboard('{ArrowRight}{ArrowRight}{ArrowRight}');
        expect(anuncio(container)).toHaveTextContent('Semana 3. Ajuste: 12.5 %');
        expect(anuncio(container).textContent).not.toMatch(/Observada/);
    });
    it('← desde cero filas activas va a la última, y Esc sin nada abierto no consume la tecla', async () => {
        const usuario = userEvent.setup();
        const { container } = dibujar();
        const alPulsar = vi.fn();
        container.addEventListener('keydown', alPulsar);
        await usuario.tab();
        await usuario.keyboard('{Escape}');
        expect(alPulsar).toHaveBeenCalledTimes(1);
        expect(alPulsar.mock.calls[0][0].defaultPrevented).toBe(false);
        await usuario.keyboard('{ArrowLeft}');
        expect(anuncio(container)).toHaveTextContent(/^Semana 5\./);
    });
    it('al perder el foco se cierra', async () => {
        const usuario = userEvent.setup();
        const { container } = dibujar();
        await usuario.tab();
        await usuario.keyboard('{Home}');
        expect(anuncio(container)).not.toBeEmptyDOMElement();
        await usuario.tab();
        expect(anuncio(container)).toBeEmptyDOMElement();
    });
    it('descripcionActivo personaliza lo que se anuncia', async () => {
        const usuario = userEvent.setup();
        const { container } = dibujar({ descripcionActivo: (f) => `Fila ${f.semana} personalizada` });
        await usuario.tab();
        await usuario.keyboard('{Home}');
        expect(anuncio(container)).toHaveTextContent('Fila 1 personalizada');
    });
});

describe('GraficaLinea: puntero y tooltip', () => {
    function conCaja(grupo, ancho = 600) {
        grupo.getBoundingClientRect = () => ({ left: 100, top: 0, right: 100 + ancho, bottom: 280, width: ancho, height: 280, x: 100, y: 0 });
    }
    const xDe = (container, clave, indice) => Number(puntosDe(container, clave)[indice].getAttribute('cx'));

    it('al pasar el puntero muestra la guía, resalta los puntos de esa x y el tooltip lista las series con su valor', () => {
        const { container, grupo } = dibujar();
        conCaja(grupo);
        // Semana 4 = tercer punto de "observada" (la 3 es un hueco)
        fireEvent.pointerMove(grupo, { clientX: 100 + xDe(container, 'observada', 2) + 3 });
        const tooltip = container.querySelector('[data-slot="tooltip-linea"]');
        expect(tooltip).toBeInTheDocument();
        const t = within(tooltip);
        expect(t.getByText('Semana 4')).toBeInTheDocument();
        expect(t.getByText('Observada').nextSibling).toHaveTextContent('15 %');
        expect(t.getByText('Ajuste').nextSibling).toHaveTextContent('13.5 %');
        expect(t.getByText('Proyección').nextSibling).toHaveTextContent('13.5 %');
        expect(t.getByText('Intervalo 95 %').nextSibling).toHaveTextContent('12 % a 15 %');
        expect(tooltip).toHaveClass('rounded-lg', 'bg-card', 'border');
        expect(tooltip.className).not.toMatch(/shadow/);
        expect(tooltip).toHaveAttribute('aria-hidden', 'true');
        // guía vertical en la x de esa fila y resalte de las series con valor
        const guia = container.querySelector('[data-guia]');
        expect(Number(guia.getAttribute('x1'))).toBeCloseTo(xDe(container, 'observada', 2), 1);
        expect([...container.querySelectorAll('[data-activo]')].map((n) => n.getAttribute('data-activo'))).toEqual(['banda', 'ajuste', 'proyeccion', 'observada']); // los puntos al final, sobre las líneas
        // el mismo texto se anuncia en la región aria-live
        expect(anuncio(container)).toHaveTextContent(/^Semana 4\./);
    });
    it('el tooltip muestra guion en las series sin valor en esa fila (y se pueden ocultar)', () => {
        const { container, grupo, rerender } = dibujar();
        conCaja(grupo);
        fireEvent.pointerMove(grupo, { clientX: 100 + xDe(container, 'observada', 0) });
        let t = within(container.querySelector('[data-slot="tooltip-linea"]'));
        expect(t.getByText('Proyección').nextSibling).toHaveTextContent('-');
        expect(t.getByText('Intervalo 95 %').nextSibling).toHaveTextContent('-');
        rerender(<GraficaLinea datos={DATOS} ejeX="semana" series={SERIES} formatoX={(s) => `S${s}`} formatoY={pct} ocultarVacios ariaLabel="Ausentismo semanal" />);
        t = within(container.querySelector('[data-slot="tooltip-linea"]'));
        expect(t.queryByText('Proyección')).toBeNull();
        expect(t.getByText('Observada')).toBeInTheDocument();
    });
    it('el título del tooltip por defecto es formatoX(x)', () => {
        const { container, grupo } = dibujar({ tituloTooltip: undefined });
        conCaja(grupo);
        fireEvent.pointerMove(grupo, { clientX: 100 + xDe(container, 'observada', 1) });
        expect(within(container.querySelector('[data-slot="tooltip-linea"]')).getByText('S2')).toBeInTheDocument();
    });
    it('el puntero elige la fila más cercana en x', () => {
        const { container, grupo } = dibujar();
        conCaja(grupo);
        fireEvent.pointerMove(grupo, { clientX: 100 });
        expect(anuncio(container)).toHaveTextContent(/^Semana 1\./);
        fireEvent.pointerMove(grupo, { clientX: 100 + 5000 });
        expect(anuncio(container)).toHaveTextContent(/^Semana 5\./);
    });
    it('al salir el ratón se cierra; un toque (táctil) se queda hasta tocar fuera', () => {
        const { container, grupo } = dibujar();
        conCaja(grupo);
        fireEvent.pointerDown(grupo, { clientX: 300, pointerType: 'touch' });
        expect(container.querySelector('[data-slot="tooltip-linea"]')).toBeInTheDocument();
        fireEvent.pointerLeave(grupo, { pointerType: 'touch' });
        expect(container.querySelector('[data-slot="tooltip-linea"]')).toBeInTheDocument();
        fireEvent.pointerLeave(grupo, { pointerType: 'mouse' });
        expect(container.querySelector('[data-slot="tooltip-linea"]')).toBeNull();
    });
    it('el tooltip se coloca dentro del contenedor (transform calculado) y respeta su ancho máximo', () => {
        const { container, grupo } = dibujar();
        conCaja(grupo);
        fireEvent.pointerMove(grupo, { clientX: 100 + 590 });
        const tooltip = container.querySelector('[data-slot="tooltip-linea"]');
        expect(tooltip.style.transform).toMatch(/^translate\(-?\d+px, \d+px\)$/);
        expect(tooltip.style.maxWidth).toBe('592px');
    });
    it('renderFila pinta las filas del tooltip con { serie, valor, fila }', () => {
        const renderFila = vi.fn(({ serie, valor }) => <span>{`${serie.clave}=${Array.isArray(valor) ? valor.join('..') : valor === null ? 'guion' : valor}`}</span>);
        const { container, grupo } = dibujar({ renderFila });
        conCaja(grupo);
        fireEvent.pointerMove(grupo, { clientX: 100 + xDe(container, 'observada', 2) });
        const t = within(container.querySelector('[data-slot="tooltip-linea"]'));
        expect(t.getByText('observada=15')).toBeInTheDocument();
        expect(t.getByText('banda=12..15')).toBeInTheDocument();
        fireEvent.pointerMove(grupo, { clientX: 100 + xDe(container, 'observada', 0) });
        expect(within(container.querySelector('[data-slot="tooltip-linea"]')).getByText('proyeccion=guion')).toBeInTheDocument();
        const llamada = renderFila.mock.calls.find(([a]) => a.serie.clave === 'banda' && a.valor === null)[0];
        expect(llamada.serie).toBe(SERIES[3]);
        expect(llamada.fila.semana).toBe(1);
    });
    it('sin datos de interacción (sin posiciones) el puntero no hace nada', () => {
        simularResize(600);
        const { container } = render(<GraficaLinea datos={[]} ejeX="semana" series={SERIES} />);
        const contenedor = container.querySelector('div > div');
        fireEvent.pointerMove(contenedor, { clientX: 50 });
        expect(container.querySelector('[data-slot="tooltip-linea"]')).toBeNull();
    });
});

describe('GraficaLinea: animación', () => {
    function lineaAjuste(container) {
        return trazoDe(container, 'ajuste');
    }
    it('las líneas se dibujan con pathLength=1 y stroke-dashoffset, en pausa hasta entrar en vista', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorInterseccion);
        simularReducirMovimiento(false);
        const { container } = dibujar();
        const linea = lineaAjuste(container);
        expect(linea).toHaveAttribute('pathLength', '1');
        expect(linea).toHaveAttribute('stroke-dasharray', '1');
        expect(linea.style.animationName).toBe('gl-dibujar');
        expect(linea.style.animationPlayState).toBe('paused');
        expect(container.querySelector('style').textContent).toMatch(/stroke-dashoffset/);
        // bandas y puntos aparecen con fundido / escala
        expect(trazoDe(container, 'banda').style.animationName).toBe('gl-aparecer');
        expect(puntosDe(container, 'observada')[0].style.animationName).toBe('gl-brotar');
        fireEvent.scroll(window);
        ObservadorInterseccion.instancias.forEach((o) => o.emitir(true));
    });
    it('al entrar en vista se reanuda, una sola vez, sin recrear los elementos', async () => {
        vi.stubGlobal('IntersectionObserver', ObservadorInterseccion);
        simularReducirMovimiento(false);
        const { container, rerender } = dibujar();
        const linea = lineaAjuste(container);
        const { act } = await import('@testing-library/react');
        act(() => ObservadorInterseccion.instancias.forEach((o) => o.emitir(true)));
        expect(lineaAjuste(container)).toBe(linea);
        expect(linea.style.animationPlayState).toBe('running');
        // salir y volver a verse no reinicia nada: el estado "visto" no se apaga
        act(() => ObservadorInterseccion.instancias.forEach((o) => o.emitir(false)));
        expect(linea.style.animationPlayState).toBe('running');
        rerender(<GraficaLinea datos={DATOS} ejeX="semana" series={SERIES} ariaLabel="Ausentismo semanal" />);
        expect(lineaAjuste(container)).toBe(linea);
    });
    it('reducir movimiento -> estado final inmediato: sin animaciones ni dasharray de dibujo', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorInterseccion);
        simularReducirMovimiento(true);
        const { container } = dibujar();
        const linea = lineaAjuste(container);
        expect(linea).not.toHaveAttribute('pathLength');
        expect(linea).not.toHaveAttribute('stroke-dasharray');
        expect(linea.style.animationName).toBe('');
        expect(trazoDe(container, 'banda').style.animationName).toBe('');
        expect(puntosDe(container, 'observada')[0].style.animationName).toBe('');
        // la discontinua queda tal cual, sin máscara
        expect(trazoDe(container, 'proyeccion')).not.toHaveAttribute('mask');
        expect(container.querySelector('mask')).toBeNull();
    });
    it('la discontinua se revela con una máscara cuyo trazo sólido se dibuja', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorInterseccion);
        simularReducirMovimiento(false);
        const { container } = dibujar();
        const mascara = container.querySelector('mask');
        expect(mascara).toBeInTheDocument();
        expect(trazoDe(container, 'proyeccion').getAttribute('mask')).toBe(`url(#${mascara.id})`);
        expect(mascara.querySelector('path')).toHaveAttribute('pathLength', '1');
        expect(mascara.querySelector('path').style.animationName).toBe('gl-dibujar');
    });
    it('una serie agregada después se dibuja sola; las demás conservan su elemento y su animación', () => {
        simularReducirMovimiento(false);
        const base = SERIES.slice(0, 2);
        const extra = { clave: 'ema', tipo: 'linea', color: 'var(--chart-2)', etiqueta: 'EMA', grosor: 1.75 };
        const datos = DATOS.map((f, i) => ({ ...f, ema: 9 + i }));
        const { container, rerender } = dibujar({ series: base, datos });
        const ajuste = lineaAjuste(container);
        const estiloAntes = ajuste.style.animationName;
        expect(trazoDe(container, 'ema')).toBeNull();
        rerender(<GraficaLinea datos={datos} ejeX="semana" series={[...base, extra]} ariaLabel="Ausentismo semanal" />);
        expect(lineaAjuste(container)).toBe(ajuste);
        expect(ajuste.style.animationName).toBe(estiloAntes);
        const ema = trazoDe(container, 'ema');
        expect(ema).toBeInTheDocument();
        expect(ema.style.animationName).toBe('gl-dibujar');
        expect(ema).toHaveAttribute('stroke-width', '1.75');
        // y al quitarla desaparece sin tocar las demás
        rerender(<GraficaLinea datos={datos} ejeX="semana" series={base} ariaLabel="Ausentismo semanal" />);
        expect(trazoDe(container, 'ema')).toBeNull();
        expect(lineaAjuste(container)).toBe(ajuste);
    });
    it('cambiar los datos no reinicia nada: mismos elementos, misma animación, nuevo trazo', () => {
        simularReducirMovimiento(false);
        const { container, rerender } = dibujar();
        const linea = lineaAjuste(container);
        const punto = puntosDe(container, 'observada')[0];
        const trazoAntes = linea.getAttribute('d');
        const nuevos = DATOS.map((f) => ({ ...f, ajuste: (f.ajuste ?? 0) + 3 }));
        rerender(<GraficaLinea datos={nuevos} ejeX="semana" series={SERIES} ariaLabel="Ausentismo semanal" />);
        expect(lineaAjuste(container)).toBe(linea);
        expect(puntosDe(container, 'observada')[0]).toBe(punto);
        expect(linea.getAttribute('d')).not.toBe(trazoAntes);
        expect(linea.style.animationName).toBe('gl-dibujar');
    });
});

describe('GraficaLinea: sin datos', () => {
    it('sin filas muestra el aviso y no es un grupo focusable', () => {
        simularResize(600);
        const { container } = render(<GraficaLinea datos={[]} ejeX="semana" series={SERIES} vacio="Sin semanas" ariaLabel="Ausentismo semanal" />);
        expect(screen.getByText('Sin semanas')).toBeInTheDocument();
        expect(screen.queryByRole('group')).toBeNull();
        expect(container.querySelector('svg')).toBeNull();
        expect(container.querySelector('[tabindex]')).toBeNull();
        expect(screen.queryByRole('list')).toBeNull();
    });
    it('aviso por defecto; sin series o con filas sin x numérico también cuenta como vacío', () => {
        simularResize(600);
        const { rerender } = render(<GraficaLinea datos={DATOS} ejeX="semana" series={[]} />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
        rerender(<GraficaLinea datos={[{ semana: null, observada: 1 }]} ejeX="semana" series={SERIES} />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
    });
    it('pasar de vacío a con datos dibuja la gráfica (el observador de ancho sigue vivo)', () => {
        simularResize(600);
        const { container, rerender } = render(<GraficaLinea datos={[]} ejeX="semana" series={SERIES} ariaLabel="Ausentismo semanal" />);
        expect(container.querySelector('svg')).toBeNull();
        rerender(<GraficaLinea datos={DATOS} ejeX="semana" series={SERIES} ariaLabel="Ausentismo semanal" />);
        expect(container.querySelector('svg')).toBeInTheDocument();
        expect(screen.getByRole('group', { name: 'Ausentismo semanal' })).toBeInTheDocument();
    });
    it('una sola fila con banda y puntos tampoco revienta (la banda de un punto es una cápsula vertical)', () => {
        simularResize(600);
        const { container } = render(<GraficaLinea datos={[{ s: 1, v: 5, b: [3, 8] }]} ejeX="s" series={[{ clave: 'v', tipo: 'puntos', color: 'var(--foreground)', etiqueta: 'V' }, { clave: 'b', tipo: 'banda', color: 'var(--chart-1)', etiqueta: 'B' }]} />);
        expect(container.querySelector('circle[data-serie="v"]')).toBeInTheDocument();
        expect(container.querySelector('line[stroke-linecap="round"]')).toBeInTheDocument();
        expect(container.querySelector('path[data-serie="b"]')).toBeNull();
    });
    it('una sola fila con una sola serie de línea no revienta (la línea de un punto se dibuja como punto)', () => {
        simularResize(600);
        const { container } = render(<GraficaLinea datos={[{ s: 1, v: 5 }]} ejeX="s" series={[{ clave: 'v', tipo: 'linea', color: 'var(--chart-1)', etiqueta: 'V' }]} />);
        expect(container.querySelector('circle[data-serie="v"]')).toBeInTheDocument();
        expect(container.querySelector('path[data-serie="v"]')).toBeNull();
    });
});
