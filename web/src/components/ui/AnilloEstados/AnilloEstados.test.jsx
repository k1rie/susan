// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import { CONFIG_ASISTENCIA } from '@/lib/graficas.js';
import AnilloEstados from './AnilloEstados.jsx';
import { arcosEstables, CIRCUNFERENCIA, HUECO, ladoAnillo, tamanoCentro } from './anilloEstados.utils.js';

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
        this.desconectado = false;
        ObservadorFalso.instancias.push(this);
    }
    observe() {}
    disconnect() { this.desconectado = true; }
    emitir(esVisible) { this.cb([{ isIntersecting: esVisible }]); }
}

const arcos = (contenedor) => [...contenedor.querySelectorAll('svg circle')].slice(1); // el primero es la pista
const largoDe = (circulo) => Number(circulo.getAttribute('stroke-dasharray').split(' ')[0]);
const filasLeyenda = () => screen.getAllByRole('listitem').map((li) => li.textContent);
// Sin IntersectionObserver useEnVista marca «visto» en un setTimeout(0): se espera a que el anillo se dibuje.
const esperarEntrada = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

afterEach(() => {
    vi.unstubAllGlobals();
    ObservadorFalso.instancias = [];
});

describe('AnilloEstados: sin datos', () => {
    it('sin datos, con total 0 o con valores no positivos muestra el aviso y respeta alto y texto propio', () => {
        const { rerender, container } = render(<AnilloEstados datos={[]} config={CONFIG_ASISTENCIA} />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
        rerender(<AnilloEstados datos={[{ clave: 'presente', valor: 0 }]} config={CONFIG_ASISTENCIA} vacio="Sin sesiones" alto={180} />);
        expect(screen.getByText('Sin sesiones')).toHaveStyle({ height: '180px' });
        rerender(<AnilloEstados datos={[{ clave: 'presente', valor: -4 }, { clave: 'ausente', valor: null }]} config={CONFIG_ASISTENCIA} />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
        expect(container.querySelector('svg')).toBeNull();
    });

    it('tolera datos y config indefinidos o nulos', () => {
        const { rerender } = render(<AnilloEstados />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
        rerender(<AnilloEstados datos={null} config={null} />);
        expect(screen.getByText('Sin datos para graficar')).toBeInTheDocument();
        rerender(<AnilloEstados datos={[{ clave: 'x', valor: 2 }]} config={null} />);
        expect(filasLeyenda()).toEqual(['x2100 %']);
    });
});

describe('AnilloEstados: último estado diminuto', () => {
    it('cada arco declara pathLength = circunferencia (Chrome no pinta un punto de 0.01 pegado al final del trazo sin él)', () => {
        const { container } = render(<AnilloEstados datos={[{ clave: 'presente', valor: 1234 }, { clave: 'retardo', valor: 0 }, { clave: 'ausente', valor: 1 }]} config={CONFIG_ASISTENCIA} />);
        const c = arcos(container);
        expect(c).toHaveLength(3);
        for (const circulo of c) expect(Number(circulo.getAttribute('pathLength'))).toBeCloseTo(CIRCUNFERENCIA, 6);
        // la pista de fondo no lleva dash, así que no lo necesita
        expect(container.querySelector('svg circle').hasAttribute('pathLength')).toBe(false);
    });

    it('el último estado con < 0,3 % del total sigue teniendo un arco con largo > 0 centrado a menos de 0,4 del final', () => {
        const a = arcosEstables([{ clave: 'presente', valor: 1234 }, { clave: 'ausente', valor: 1 }]);
        const ultimo = a.at(-1);
        expect(ultimo.largo).toBeGreaterThan(0);
        // el punto queda centrado en su tramo, es decir, a menos de 0,4 unidades del final de la circunferencia
        expect(CIRCUNFERENCIA - (ultimo.inicio + ultimo.largo / 2)).toBeLessThan(0.4);
    });
});

describe('AnilloEstados: cifras y etiquetas', () => {
    it('la leyenda trae etiqueta, cifra y porcentaje de cada estado, también los de valor 0, en el orden de los datos', () => {
        render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        expect(filasLeyenda()).toEqual(['Presentes30976 %', 'Retardos287 %', 'Ausencias6817 %', 'Justificadas41 %', 'Pendientes00 %']);
    });

    it('un valor positivo que redondea a 0 % se escribe «<1 %»', () => {
        render(<AnilloEstados datos={[{ clave: 'presente', valor: 500 }, { clave: 'ausente', valor: 1 }]} config={CONFIG_ASISTENCIA} />);
        expect(filasLeyenda()).toEqual(['Presentes500100 %', 'Ausencias1<1 %']);
    });

    it('los estados en 0 salen atenuados en la leyenda y no dibujan arco visible', () => {
        const { container } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        const items = screen.getAllByRole('listitem');
        expect(items[4]).toHaveClass('opacity-55');
        expect(items[0]).not.toHaveClass('opacity-55');
        const c = arcos(container);
        expect(c).toHaveLength(5);
        expect(c[4].style.opacity).toBe('0');
    });

    it('sin `centro` el centro muestra el total y «Total»; `centro` sobrescribe cifra y etiqueta', () => {
        const { container, rerender } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        expect(container.querySelector('.absolute.inset-0')).toHaveTextContent('409Total');
        rerender(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} centro={{ valor: '82 %', etiqueta: 'Asistencia' }} />);
        expect(container.querySelector('.absolute.inset-0')).toHaveTextContent('82 %Asistencia');
        rerender(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} centro={{ etiqueta: 'Sesiones' }} />);
        expect(container.querySelector('.absolute.inset-0')).toHaveTextContent('409Sesiones');
        rerender(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} centro={{ valor: 0, etiqueta: 'en riesgo' }} />);
        expect(container.querySelector('.absolute.inset-0')).toHaveTextContent('0en riesgo');
    });

    it('al pasar el cursor por un estado el centro lo muestra y los demás arcos se atenúan; al salir vuelve al total', async () => {
        const { container } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        await esperarEntrada();
        const [presentes, , , , pendientes] = screen.getAllByRole('listitem');
        const centro = container.querySelector('.absolute.inset-0');
        fireEvent.mouseEnter(presentes);
        expect(centro).toHaveTextContent('309Presentes');
        expect(arcos(container)[1].style.opacity).toBe('0.22');
        expect(arcos(container)[0].style.opacity).toBe('1');
        fireEvent.mouseLeave(presentes);
        expect(centro).toHaveTextContent('409Total');
        // un estado en 0 no se puede elegir: no hay nada que resaltar
        fireEvent.mouseEnter(pendientes);
        expect(centro).toHaveTextContent('409Total');
    });

    it('si una actualización deja en 0 el estado elegido, el centro vuelve al total', async () => {
        const { container, rerender } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        await esperarEntrada();
        fireEvent.mouseEnter(screen.getAllByRole('listitem')[3]);
        expect(container.querySelector('.absolute.inset-0')).toHaveTextContent('4Justificadas');
        rerender(<AnilloEstados datos={DATOS.map((d) => (d.clave === 'justificado' ? { ...d, valor: 0 } : d))} config={CONFIG_ASISTENCIA} />);
        expect(container.querySelector('.absolute.inset-0')).toHaveTextContent('405Total');
        expect(arcos(container)[0].style.opacity).toBe('1');
    });

    it('el anillo es decorativo: aria-hidden, sin elementos focusables ni roles de imagen', () => {
        const { container } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
        expect(container.querySelector('[tabindex]')).toBeNull();
        expect(screen.queryByRole('img')).toBeNull();
    });

    it('usa los colores de GRÁFICA aunque la pantalla pase los de texto, y el azul si falta la configuración', () => {
        const { container } = render(<AnilloEstados datos={[{ clave: 'presente', valor: 1 }, { clave: 'otro', valor: 1 }]} config={CONFIG_ASISTENCIA} />);
        const c = arcos(container);
        expect(c[0]).toHaveAttribute('stroke', 'var(--g-presente)');
        expect(c[1]).toHaveAttribute('stroke', 'var(--g-azul)');
    });

    it('ignora valores negativos o no numéricos al sumar y los trata como 0', () => {
        render(<AnilloEstados datos={[{ clave: 'presente', valor: '6' }, { clave: 'ausente', valor: 4 }, { clave: 'retardo', valor: -3 }, { clave: 'pendiente', valor: 'x' }]} config={CONFIG_ASISTENCIA} />);
        expect(filasLeyenda()).toEqual(['Presentes660 %', 'Ausencias440 %', 'Retardos00 %', 'Pendientes00 %']);
    });
});

describe('AnilloEstados: entrada y movimiento', () => {
    it('oculto antes de entrar en vista (igual que en el servidor) y se dibuja al intersectar', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        expect(arcos(container).every((c) => largoDe(c) === 0 && c.style.opacity === '0')).toBe(true);
        act(() => ObservadorFalso.instancias[0].emitir(true));
        const c = arcos(container);
        expect(largoDe(c[0])).toBeGreaterThan(100);
        expect(c[0].style.opacity).toBe('1');
        expect(c[0].style.transition).toContain('stroke-dasharray');
        // escalonado: cada arco empieza un poco después que el anterior
        expect(c[0].style.transition).toContain('0s');
        expect(c[2].style.transition).toContain('0.18s');
    });

    it('con «reducir movimiento» el anillo está completo de inmediato, sin transiciones ni observador', () => {
        simularMatchMedia(true);
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        const c = arcos(container);
        expect(largoDe(c[0])).toBeGreaterThan(100);
        expect(c[0].style.opacity).toBe('1');
        expect(c.every((x) => x.style.transition === '')).toBe(true);
        expect(ObservadorFalso.instancias).toHaveLength(0);
    });

    it('sin IntersectionObserver el anillo no se queda oculto', async () => {
        const { container } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        await esperarEntrada();
        expect(largoDe(arcos(container)[0])).toBeGreaterThan(100);
    });

    it('al cambiar los datos NO reinicia la entrada: mismos círculos, largos nuevos y sin volver a 0', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container, rerender } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        act(() => ObservadorFalso.instancias[0].emitir(true));
        const antes = arcos(container);
        const largoAntes = largoDe(antes[0]);
        rerender(<AnilloEstados datos={DATOS.map((d) => (d.clave === 'presente' ? { ...d, valor: 100 } : d))} config={CONFIG_ASISTENCIA} />);
        const despues = arcos(container);
        despues.forEach((c, i) => expect(c).toBe(antes[i]));
        expect(largoDe(despues[0])).toBeGreaterThan(0);
        expect(largoDe(despues[0])).toBeLessThan(largoAntes);
        expect(despues[0].style.opacity).toBe('1');
        // hay un solo observador y no se creó otro al actualizar
        expect(ObservadorFalso.instancias).toHaveLength(1);
    });

    it('los arcos animan largo Y posición para que los vecinos se muevan juntos', () => {
        const { container } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        const t = arcos(container)[1].style.transition;
        expect(t).toContain('stroke-dasharray');
        expect(t).toContain('stroke-dashoffset');
        expect(t).toContain('opacity');
    });

    it('un estado que pasa de 0 a positivo (y al revés) conserva su círculo y se desvanece en lugar de aparecer de golpe', async () => {
        const { container, rerender } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        await esperarEntrada();
        const pendiente = arcos(container)[4];
        expect(pendiente.style.opacity).toBe('0');
        rerender(<AnilloEstados datos={DATOS.map((d) => (d.clave === 'pendiente' ? { ...d, valor: 12 } : d))} config={CONFIG_ASISTENCIA} />);
        expect(arcos(container)[4]).toBe(pendiente);
        expect(pendiente.style.opacity).toBe('1');
        expect(largoDe(pendiente)).toBeGreaterThan(0);
        rerender(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        expect(pendiente.style.opacity).toBe('0');
        expect(largoDe(pendiente)).toBe(0);
    });

    it('tras la primera transición las actualizaciones no llevan retraso escalonado y son más cortas', () => {
        const { container } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        expect(arcos(container)[3].style.transition).toContain('0.27s');
        fireEvent.transitionEnd(container.querySelector('svg'), { propertyName: 'opacity' });
        expect(arcos(container)[3].style.transition).toContain('0.27s');
        const transicion = new Event('transitionend', { bubbles: true });
        transicion.propertyName = 'stroke-dasharray';
        act(() => { arcos(container)[0].dispatchEvent(transicion); });
        const t = arcos(container)[3].style.transition;
        expect(t).not.toContain('0.27s');
        expect(t).toContain('stroke-dasharray 0.5s');
    });

    it('pasar de «sin datos» a «con datos» (primer registro de la sesión) también hace la entrada', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container, rerender } = render(<AnilloEstados datos={[]} config={CONFIG_ASISTENCIA} />);
        // el contenedor observado existe aun sin datos
        expect(ObservadorFalso.instancias).toHaveLength(1);
        act(() => ObservadorFalso.instancias[0].emitir(true));
        rerender(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        expect(largoDe(arcos(container)[0])).toBeGreaterThan(100);
        expect(arcos(container)[0].style.opacity).toBe('1');
    });

    it('sin datos al montar y con datos antes de entrar en vista: espera al observador', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container, rerender } = render(<AnilloEstados datos={[]} config={CONFIG_ASISTENCIA} />);
        rerender(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} />);
        expect(largoDe(arcos(container)[0])).toBe(0);
        act(() => ObservadorFalso.instancias[0].emitir(true));
        expect(largoDe(arcos(container)[0])).toBeGreaterThan(100);
    });
});

describe('anilloEstados.utils', () => {
    it('ladoAnillo deja sitio a la leyenda y acota el tamaño', () => {
        expect(ladoAnillo(240)).toBe(152);
        expect(ladoAnillo(100)).toBe(120);
        expect(ladoAnillo(600)).toBe(196);
        expect(ladoAnillo(undefined)).toBe(152);
        expect(ladoAnillo('x')).toBe(152);
    });

    it('tamanoCentro reduce la cifra cuando el texto es largo y nunca baja de 16 px ni pasa de 30 px', () => {
        expect(tamanoCentro('82', 152)).toBe(30);
        expect(tamanoCentro('100 %', 122)).toBeLessThan(30);
        expect(tamanoCentro('100 %', 122)).toBeGreaterThanOrEqual(16);
        expect(tamanoCentro('1234567890123', 120)).toBe(16);
        expect(tamanoCentro('', 152)).toBe(30);
        expect(tamanoCentro(undefined, 152)).toBe(30);
        expect(tamanoCentro('100 %', 196)).toBeGreaterThan(tamanoCentro('100 %', 122));
    });

    it('arcosEstables devuelve un arco por dato (también los de valor 0) en el orden recibido', () => {
        const a = arcosEstables([{ clave: 'a', valor: 3 }, { clave: 'b', valor: 0 }, { clave: 'c', valor: 1 }]);
        expect(a.map((x) => x.clave)).toEqual(['a', 'b', 'c']);
        expect(a[1].largo).toBe(0);
        expect(a[1].valor).toBe(0);
        // el arco en 0 queda donde empezaría: justo al terminar el tramo anterior
        expect(a[1].inicio).toBeCloseTo(0.75 * CIRCUNFERENCIA, 5);
    });

    it('cada arco queda centrado en su tramo y entre arcos hay exactamente el hueco', () => {
        const a = arcosEstables([{ clave: 'a', valor: 1 }, { clave: 'b', valor: 1 }]);
        const mitad = CIRCUNFERENCIA / 2;
        expect(a[0].inicio + a[0].largo / 2).toBeCloseTo(mitad / 2, 5);
        expect(a[1].inicio + a[1].largo / 2).toBeCloseTo(mitad + mitad / 2, 5);
        expect(a[1].inicio - (a[0].inicio + a[0].largo)).toBeCloseTo(HUECO, 5);
    });

    it('un solo segmento llena el anillo sin hueco', () => {
        const [a] = arcosEstables([{ clave: 'a', valor: 5 }, { clave: 'b', valor: 0 }]);
        expect(a.inicio).toBeCloseTo(0, 5);
        expect(a.largo).toBeCloseTo(CIRCUNFERENCIA, 5);
    });

    it('un segmento menor que el hueco se dibuja como punto centrado en su posición real', () => {
        const a = arcosEstables([{ clave: 'a', valor: 997 }, { clave: 'b', valor: 3 }]);
        const tramoA = 0.997 * CIRCUNFERENCIA;
        const tramoB = 0.003 * CIRCUNFERENCIA;
        expect(a[1].largo).toBeLessThan(0.1);
        expect(a[1].inicio + a[1].largo / 2).toBeCloseTo(tramoA + tramoB / 2, 3);
    });
});

describe('AnilloEstados: contenedor e hidratación', () => {
    it('className va al contenedor, también sin datos', () => {
        const { container, rerender } = render(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} className="mi-clase" />);
        expect(container.firstChild).toHaveClass('mi-clase', '@container');
        rerender(<AnilloEstados datos={[]} className="mi-clase" />);
        expect(container.firstChild).toHaveClass('mi-clase');
    });

    it('el HTML del servidor se hidrata sin diferencias (estado inicial oculto igual en servidor y cliente)', async () => {
        const html = renderToString(<AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} centro={{ valor: '82 %', etiqueta: 'Asistencia' }} />);
        const anfitrion = document.createElement('div');
        anfitrion.innerHTML = html;
        document.body.appendChild(anfitrion);
        // el HTML del servidor llega oculto: la entrada solo ocurre en el cliente, al entrar en vista
        expect(anfitrion.querySelectorAll('svg circle')[1].getAttribute('stroke-dasharray')).toMatch(/^0 /);
        const errores = [];
        const consola = vi.spyOn(console, 'error').mockImplementation((...a) => errores.push(a.join(' ')));
        await act(async () => {
            hydrateRoot(anfitrion, <AnilloEstados datos={DATOS} config={CONFIG_ASISTENCIA} centro={{ valor: '82 %', etiqueta: 'Asistencia' }} />, { onRecoverableError: (e) => errores.push(String(e)) });
        });
        consola.mockRestore();
        expect(errores).toEqual([]);
        anfitrion.remove();
    });
});
