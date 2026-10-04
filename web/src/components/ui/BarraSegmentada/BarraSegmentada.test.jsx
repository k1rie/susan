// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { CONFIG_ASISTENCIA } from '@/lib/graficas.js';
import BarraSegmentada from './BarraSegmentada.jsx';
import { anchoMinimoSegmento, normalizarSegmentos, resumenSegmentos } from './barraSegmentada.utils.js';

const DATOS = [
    { clave: 'presente', valor: 309 },
    { clave: 'retardo', valor: 28 },
    { clave: 'ausente', valor: 68 },
    { clave: 'justificado', valor: 4 },
    { clave: 'pendiente', valor: 0 },
];

function simularMatchMedia(coincide) {
    const mq = { matches: coincide, addEventListener: () => {}, removeEventListener: () => {} };
    vi.stubGlobal('matchMedia', () => mq);
}

class ObservadorFalso {
    static instancias = [];
    constructor(cb) {
        this.cb = cb;
        ObservadorFalso.instancias.push(this);
    }
    observe() {}
    disconnect() {}
    emitir(esVisible) { this.cb([{ isIntersecting: esVisible }]); }
}

const segmentos = (contenedor) => [...contenedor.querySelectorAll('[data-segmento]')];
const crecimiento = (nodo) => Number(nodo.style.flexGrow);
const esperarEntrada = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const filasLeyenda = () => screen.getAllByRole('listitem').map((li) => li.textContent);

afterEach(() => {
    vi.unstubAllGlobals();
    ObservadorFalso.instancias = [];
});

describe('BarraSegmentada: render', () => {
    it('dibuja un segmento por dato y la leyenda con cifra y porcentaje en el orden recibido', () => {
        const { container } = render(<BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} />);
        expect(segmentos(container).map((s) => s.dataset.segmento)).toEqual(['presente', 'retardo', 'ausente', 'justificado', 'pendiente']);
        expect(filasLeyenda()).toEqual(['Presentes30976 %', 'Retardos287 %', 'Ausencias6817 %', 'Justificadas41 %', 'Pendientes00 %']);
    });

    it('el ancho de cada segmento es proporcional a su valor y los de valor 0 quedan colapsados e invisibles', () => {
        const { container } = render(<BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} />);
        const s = segmentos(container);
        expect(crecimiento(s[0])).toBeCloseTo((309 * 100) / 409, 4);
        expect(crecimiento(s[4])).toBe(0);
        expect(s[4].style.opacity).toBe('0');
        expect(s[4].style.minWidth).toBe('0px');
        expect(s[0].style.opacity).toBe('1');
        // la suma de crecimientos es 100 aunque los valores sean fracciones (flex-grow < 1 no llenaría la barra)
        const { container: c2 } = render(<BarraSegmentada datos={[{ clave: 'a', valor: 0.2 }, { clave: 'b', valor: 0.1 }]} />);
        expect(segmentos(c2).reduce((a, n) => a + crecimiento(n), 0)).toBeCloseTo(100, 6);
    });

    it('los segmentos de valor 0 no dejan hueco entre vecinos (margen que compensa los 2 px)', () => {
        const { container } = render(<BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} />);
        const s = segmentos(container);
        expect(s[4].style.marginLeft).toBe('-2px');
        expect(s[0].style.marginLeft).toBe('0px');
    });

    it('usa colores de GRÁFICA y el azul si falta la configuración', () => {
        const { container } = render(<BarraSegmentada datos={[{ clave: 'presente', valor: 1 }, { clave: 'otro', valor: 1 }]} config={CONFIG_ASISTENCIA} />);
        const s = segmentos(container);
        expect(s[0].style.background).toContain('var(--g-presente)');
        expect(s[1].style.background).toContain('var(--g-azul)');
    });

    it('un solo segmento llena la barra', () => {
        const { container } = render(<BarraSegmentada datos={[{ clave: 'presente', valor: 7 }]} config={CONFIG_ASISTENCIA} />);
        expect(segmentos(container)).toHaveLength(1);
        expect(crecimiento(segmentos(container)[0])).toBe(100);
        expect(filasLeyenda()).toEqual(['Presentes7100 %']);
    });

    it('un valor que redondea a 0 % se escribe «<1 %» en la leyenda y su segmento tiene ancho mínimo', () => {
        const { container } = render(<BarraSegmentada datos={[{ clave: 'presente', valor: 900 }, { clave: 'ausente', valor: 1 }]} config={CONFIG_ASISTENCIA} alto={12} />);
        expect(filasLeyenda()[1]).toBe('Ausencias1<1 %');
        expect(segmentos(container)[1].style.minWidth).toBe('6px');
    });

    it('valores no numéricos o negativos cuentan como 0', () => {
        const { container } = render(<BarraSegmentada datos={[{ clave: 'presente', valor: '5' }, { clave: 'ausente', valor: -3 }, { clave: 'retardo', valor: null }, { clave: 'pendiente', valor: 'x' }]} config={CONFIG_ASISTENCIA} />);
        const s = segmentos(container);
        expect(s.map(crecimiento)).toEqual([100, 0, 0, 0]);
        expect(filasLeyenda()).toEqual(['Presentes5100 %', 'Ausencias00 %', 'Retardos00 %', 'Pendientes00 %']);
    });
});

describe('BarraSegmentada: sin datos o suma 0', () => {
    it('con leyenda muestra la pista y el texto «vacio»', () => {
        const { container, rerender } = render(<BarraSegmentada datos={[]} />);
        expect(screen.getByText('Sin datos')).toBeInTheDocument();
        expect(segmentos(container)).toHaveLength(0);
        rerender(<BarraSegmentada datos={[{ clave: 'presente', valor: 0 }]} config={CONFIG_ASISTENCIA} vacio="Sin sesiones" />);
        expect(screen.getByText('Sin sesiones')).toBeInTheDocument();
        rerender(<BarraSegmentada datos={null} config={null} />);
        expect(screen.getByText('Sin datos')).toBeInTheDocument();
    });

    it('sin leyenda (celda de tabla) es una imagen con el texto «vacio» como etiqueta y respeta el alto', () => {
        render(<BarraSegmentada datos={[{ clave: 'presente', valor: 0 }, { clave: 'ausente', valor: 0 }]} leyenda={false} alto={8} vacio="Sin registros" />);
        const pista = screen.getByRole('img', { name: 'Sin registros' });
        expect(pista).toHaveStyle({ height: '8px' });
        expect(screen.queryByText('Sin registros')).toBeNull();
    });
});

describe('BarraSegmentada: composición en una celda de tabla (leyenda={false})', () => {
    it('no pinta leyenda y el aria-label trae las cifras con su porcentaje, solo de los segmentos con valor', () => {
        render(
            <table>
                <tbody>
                    <tr>
                        <td>
                            <BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} alto={8} leyenda={false} />
                        </td>
                    </tr>
                </tbody>
            </table>,
        );
        expect(screen.queryByRole('listitem')).toBeNull();
        const barra = screen.getByRole('img');
        expect(barra).toHaveAttribute('aria-label', 'Presentes 309 (76 %); Retardos 28 (7 %); Ausencias 68 (17 %); Justificadas 4 (1 %)');
        expect(barra).toHaveAttribute('title', barra.getAttribute('aria-label'));
        expect(barra).toHaveStyle({ height: '8px' });
    });

    it('`etiqueta` reemplaza el texto alternativo', () => {
        render(<BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} leyenda={false} etiqueta="Asistencia de Luis: 8 de 17" />);
        expect(screen.getByRole('img', { name: 'Asistencia de Luis: 8 de 17' })).toBeInTheDocument();
    });

    it('con leyenda la barra se oculta a los lectores (las cifras ya están en la leyenda)', () => {
        const { container } = render(<BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} />);
        expect(screen.queryByRole('img')).toBeNull();
        expect(container.querySelector('[aria-hidden="true"][title]')).toBeInTheDocument();
        expect(container.querySelector('[tabindex]')).toBeNull();
    });
});

describe('BarraSegmentada: entrada y movimiento', () => {
    it('oculta antes de entrar en vista y se revela al intersectar', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container } = render(<BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} />);
        expect(segmentos(container)[0].style.clipPath).toContain('100%');
        act(() => ObservadorFalso.instancias[0].emitir(true));
        expect(segmentos(container)[0].style.clipPath).toBe('inset(0 0 0 0 round 999px)');
        // revelado escalonado: cada segmento empieza 80 ms después del anterior
        expect(segmentos(container)[1].style.transition).toContain('80ms');
    });

    it('con «reducir movimiento» está completa de inmediato, sin transiciones ni observador', () => {
        simularMatchMedia(true);
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container } = render(<BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} />);
        const s = segmentos(container);
        expect(s[0].style.clipPath).toBe('inset(0 0 0 0 round 999px)');
        expect(s.every((n) => n.style.transition === '')).toBe(true);
        expect(ObservadorFalso.instancias).toHaveLength(0);
    });

    it('sin IntersectionObserver no se queda oculta', async () => {
        const { container } = render(<BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} />);
        await esperarEntrada();
        expect(segmentos(container)[0].style.clipPath).toBe('inset(0 0 0 0 round 999px)');
    });

    it('al cambiar los datos conserva los nodos, no reinicia el revelado y anima el ancho sin chocar con el clip-path', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container, rerender } = render(<BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} />);
        act(() => ObservadorFalso.instancias[0].emitir(true));
        const antes = segmentos(container);
        rerender(<BarraSegmentada datos={DATOS.map((d) => (d.clave === 'presente' ? { ...d, valor: 100 } : d))} config={CONFIG_ASISTENCIA} />);
        const despues = segmentos(container);
        despues.forEach((s, i) => expect(s).toBe(antes[i]));
        expect(crecimiento(despues[0])).toBeCloseTo((100 * 100) / 200, 4);
        expect(despues[0].style.clipPath).toBe('inset(0 0 0 0 round 999px)');
        // el ancho se anima en una transición propia, aparte de la del clip-path
        expect(despues[0].style.transition).toMatch(/flex-grow 0\.5s/);
        expect(despues[0].style.transition).toMatch(/clip-path 0\.8s/);
        expect(ObservadorFalso.instancias).toHaveLength(1);
    });

    it('un segmento que pasa de 0 a positivo conserva su nodo y se desvanece en lugar de aparecer de golpe', async () => {
        const { container, rerender } = render(<BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} />);
        await esperarEntrada();
        const pendiente = segmentos(container)[4];
        expect(pendiente.style.opacity).toBe('0');
        rerender(<BarraSegmentada datos={DATOS.map((d) => (d.clave === 'pendiente' ? { ...d, valor: 20 } : d))} config={CONFIG_ASISTENCIA} />);
        expect(segmentos(container)[4]).toBe(pendiente);
        expect(pendiente.style.opacity).toBe('1');
        expect(crecimiento(pendiente)).toBeGreaterThan(0);
        expect(pendiente.style.marginLeft).toBe('0px');
    });

    it('pasar de «sin datos» a «con datos» también hace la entrada (el contenedor observado existe siempre)', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container, rerender } = render(<BarraSegmentada datos={[]} leyenda={false} />);
        expect(ObservadorFalso.instancias).toHaveLength(1);
        rerender(<BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} leyenda={false} />);
        expect(segmentos(container)[0].style.clipPath).toContain('100%');
        act(() => ObservadorFalso.instancias[0].emitir(true));
        expect(segmentos(container)[0].style.clipPath).toBe('inset(0 0 0 0 round 999px)');
    });
});

describe('barraSegmentada.utils', () => {
    it('normalizarSegmentos recorta negativos, convierte textos y trata lo no numérico como 0', () => {
        expect(normalizarSegmentos([{ clave: 'a', valor: '3' }, { clave: 'b', valor: -1 }, { clave: 'c', valor: 'x' }, { clave: 'd', valor: NaN }, { clave: 'e' }])).toEqual([
            { clave: 'a', valor: 3 },
            { clave: 'b', valor: 0 },
            { clave: 'c', valor: 0 },
            { clave: 'd', valor: 0 },
            { clave: 'e', valor: 0 },
        ]);
        expect(normalizarSegmentos(undefined)).toEqual([]);
    });

    it('anchoMinimoSegmento es la mitad del grosor, con 4 px como mínimo', () => {
        expect(anchoMinimoSegmento(12)).toBe(6);
        expect(anchoMinimoSegmento(8)).toBe(4);
        expect(anchoMinimoSegmento(4)).toBe(4);
        expect(anchoMinimoSegmento(14)).toBe(7);
        expect(anchoMinimoSegmento('x')).toBe(6);
    });

    it('resumenSegmentos omite los valores 0 y usa las etiquetas', () => {
        const items = normalizarSegmentos(DATOS);
        expect(resumenSegmentos(items, (c) => CONFIG_ASISTENCIA[c].label)).toBe('Presentes 309 (76 %); Retardos 28 (7 %); Ausencias 68 (17 %); Justificadas 4 (1 %)');
        expect(resumenSegmentos(normalizarSegmentos([{ clave: 'x', valor: 1 }, { clave: 'y', valor: 999 }]), (c) => c)).toBe('x 1 (<1 %); y 999 (100 %)');
    });
});

describe('BarraSegmentada: contenedor e hidratación', () => {
    it('className va al contenedor, también sin datos', () => {
        const { container, rerender } = render(<BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} className="mi-clase" />);
        expect(container.firstChild).toHaveClass('mi-clase');
        rerender(<BarraSegmentada datos={[]} className="mi-clase" />);
        expect(container.firstChild).toHaveClass('mi-clase');
    });

    it('el HTML del servidor se hidrata sin diferencias (estado inicial oculto igual en servidor y cliente)', async () => {
        const jsx = <BarraSegmentada datos={DATOS} config={CONFIG_ASISTENCIA} />;
        const anfitrion = document.createElement('div');
        anfitrion.innerHTML = renderToString(jsx);
        document.body.appendChild(anfitrion);
        // el HTML del servidor llega oculto: la entrada solo ocurre en el cliente, al entrar en vista
        expect(segmentos(anfitrion)[0].style.clipPath).toContain('100%');
        const errores = [];
        const consola = vi.spyOn(console, 'error').mockImplementation((...a) => errores.push(a.join(' ')));
        await act(async () => {
            hydrateRoot(anfitrion, jsx, { onRecoverableError: (e) => errores.push(String(e)) });
        });
        consola.mockRestore();
        expect(errores).toEqual([]);
        anfitrion.remove();
    });
});
