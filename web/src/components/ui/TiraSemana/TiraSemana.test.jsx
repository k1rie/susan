// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { hydrateRoot } from 'react-dom/client';
import { renderToString } from 'react-dom/server';
import TiraSemana from './TiraSemana.jsx';
import {
    COLUMNAS_MAX,
    escalaTira,
    estadoLimite,
    intensidadCasilla,
    limiteValido,
    mezclaCasilla,
    normalizarCasillas,
    tamanoEtiquetaCss,
    tamanoValorCss,
    textoLimite,
} from './tiraSemana.utils.js';

const SEMANA = [
    { etiqueta: 'Lun', valor: 14.9 },
    { etiqueta: 'Mar', valor: 14.6 },
    { etiqueta: 'Mié', valor: 9.8 },
    { etiqueta: 'Jue', valor: 11.2 },
    { etiqueta: 'Vie', valor: 19.7 },
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

const casillas = (contenedor) => [...contenedor.querySelectorAll('[data-casilla]')];
const esperarEntrada = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

afterEach(() => {
    vi.unstubAllGlobals();
    ObservadorFalso.instancias = [];
});

describe('TiraSemana: render', () => {
    it('una casilla por dato con su cifra, unidad y etiqueta', () => {
        const { container } = render(<TiraSemana datos={SEMANA} limite={20} />);
        const c = casillas(container);
        expect(c).toHaveLength(5);
        expect(c[0]).toHaveTextContent('Lun14.9%');
        expect(c[4]).toHaveTextContent('Vie19.7%');
        expect(screen.getAllByRole('listitem')).toHaveLength(5);
    });

    it('la etiqueta y la unidad usan el color de texto pleno: atenuarlas rompe el contraste 4,5:1 sobre la casilla más intensa', () => {
        const { container } = render(<TiraSemana datos={SEMANA} />);
        const intensa = casillas(container)[4];
        const etiqueta = intensa.firstElementChild;
        const unidad = [...intensa.querySelectorAll('span')].find((s) => s.textContent === '%');
        expect(etiqueta).toHaveTextContent('Vie');
        expect(unidad).toBeDefined();
        for (const nodo of [etiqueta, unidad]) {
            expect(nodo).toHaveClass('text-foreground');
            expect(nodo.className).not.toMatch(/text-foreground\/\d/);
        }
    });

    it('formatea las cifras (sin cola de decimales de coma flotante) y respeta la unidad propia', () => {
        const { container } = render(<TiraSemana datos={[{ etiqueta: 'A', valor: 0.1 + 0.2 }, { etiqueta: 'B', valor: 12 }]} unidad=" faltas" />);
        expect(casillas(container)[0]).toHaveTextContent('A0.3faltas');
        expect(casillas(container)[1]).toHaveTextContent('B12faltas');
        const { container: sinUnidad } = render(<TiraSemana datos={[{ etiqueta: 'A', valor: 3 }]} unidad="" />);
        expect(casillas(sinUnidad)[0]).toHaveTextContent('A3');
    });

    it('sin datos muestra el aviso (y el texto propio)', () => {
        const { rerender } = render(<TiraSemana datos={[]} />);
        expect(screen.getByText('Sin datos')).toBeInTheDocument();
        rerender(<TiraSemana datos={[]} vacio="Sin sesiones cerradas" />);
        expect(screen.getByText('Sin sesiones cerradas')).toBeInTheDocument();
        rerender(<TiraSemana datos={null} />);
        expect(screen.getByText('Sin datos')).toBeInTheDocument();
        rerender(<TiraSemana />);
        expect(screen.getByText('Sin datos')).toBeInTheDocument();
    });

    it('acepta de 1 a 7 casillas con las columnas justas y un ancho máximo para que una sola no se estire', () => {
        for (const n of [1, 2, 3, 5, 7]) {
            const datos = Array.from({ length: n }, (_, i) => ({ etiqueta: `D${i}`, valor: i }));
            const { container, unmount } = render(<TiraSemana datos={datos} />);
            expect(casillas(container)).toHaveLength(n);
            expect(container.querySelector('ul').style.gridTemplateColumns).toBe(`repeat(${n}, minmax(0, 1fr))`);
            expect(container.firstChild.style.maxWidth).toBe(`${n * 7}rem`);
            unmount();
        }
    });

    it('con más de 7 datos baja a otra fila sin pasar de 7 columnas', () => {
        const datos = Array.from({ length: 9 }, (_, i) => ({ etiqueta: `D${i}`, valor: i }));
        const { container } = render(<TiraSemana datos={datos} />);
        expect(casillas(container)).toHaveLength(9);
        expect(container.querySelector('ul').style.gridTemplateColumns).toBe(`repeat(${COLUMNAS_MAX}, minmax(0, 1fr))`);
    });

    it('la cifra y el nombre llevan un tamaño que depende del ancho disponible (consultas de contenedor)', () => {
        const { container } = render(<TiraSemana datos={SEMANA} limite={20} />);
        expect(container.firstChild).toHaveClass('@container');
        const li = casillas(container)[0];
        // jsdom no entiende `cqw` y descarta el valor: lo que importa es que el cálculo exista y sea el de tamanoValorCss
        const css = tamanoValorCss(5, ['14.9', '14.6', '9.8', '11.2', '19.7'], '%');
        expect(css).toContain('/ 5 -');
        expect(li.querySelector('.truncate')).toBeInTheDocument();
    });

    it('un nombre largo se corta con puntos suspensivos (el texto completo sigue en el DOM y en el title)', () => {
        const { container } = render(<TiraSemana datos={[{ etiqueta: 'Miércoles de examen', valor: 5 }]} />);
        const li = casillas(container)[0];
        expect(li.querySelector('.truncate')).toHaveTextContent('Miércoles de examen');
        expect(li).toHaveAttribute('title', 'Miércoles de examen: 5 %');
    });
});

describe('TiraSemana: valores nulos', () => {
    const CON_NULOS = [
        { etiqueta: 'Lun', valor: 12 },
        { etiqueta: 'Mar', valor: null },
        { etiqueta: 'Mié', valor: undefined },
        { etiqueta: 'Jue', valor: '' },
        { etiqueta: 'Vie', valor: 'x' },
        { etiqueta: 'Sáb', valor: 0 },
    ];

    it('null, undefined, vacío o no numérico dan una casilla neutra con «-» y texto accesible; un 0 real sí es dato', () => {
        const { container } = render(<TiraSemana datos={CON_NULOS} limite={20} />);
        const c = casillas(container);
        for (const i of [1, 2, 3, 4]) {
            expect(c[i]).toHaveClass('bg-muted');
            expect(c[i].style.backgroundColor).toBe('');
            expect(c[i]).toHaveTextContent('-');
            expect(c[i]).toHaveTextContent('sin datos');
            expect(c[i].querySelector('[aria-hidden="true"]')).toHaveTextContent('-');
            expect(c[i]).not.toHaveClass('ring-2');
            expect(c[i]).toHaveAttribute('title', `${['', 'Mar', 'Mié', 'Jue', 'Vie'][i]}: sin datos`);
        }
        expect(c[0]).not.toHaveClass('bg-muted');
        expect(c[5]).not.toHaveClass('bg-muted');
        expect(c[5]).toHaveTextContent('Sáb0%');
    });

    it('una tira solo de nulos no falla y no marca nada', () => {
        const { container } = render(<TiraSemana datos={[{ etiqueta: 'Lun', valor: null }, { etiqueta: 'Mar', valor: null }]} limite={20} />);
        expect(casillas(container)).toHaveLength(2);
        expect(container.querySelector('.ring-2')).toBeNull();
    });
});

describe('TiraSemana: límite', () => {
    it('quien rebasa el límite lleva anillo y texto accesible; quien lo iguala, también, con otra redacción', () => {
        const { container } = render(<TiraSemana datos={[{ etiqueta: 'Lun', valor: 20 }, { etiqueta: 'Mar', valor: 26.4 }, { etiqueta: 'Mié', valor: 19.9 }]} limite={20} />);
        const c = casillas(container);
        expect(c[0]).toHaveClass('ring-2');
        expect(c[0]).toHaveTextContent('(en el límite de 20 %)');
        expect(c[1]).toHaveClass('ring-2');
        expect(c[1]).toHaveTextContent('(sobre el límite de 20 %)');
        expect(c[2]).not.toHaveClass('ring-2');
        expect(c[2]).not.toHaveTextContent('límite');
        expect(c[1].querySelector('.sr-only')).toBeInTheDocument();
    });

    it('sin límite (o con límite inválido) nadie lleva anillo ni texto de límite', () => {
        for (const limite of [undefined, null, 0, -5, 'x']) {
            const { container, unmount } = render(<TiraSemana datos={[{ etiqueta: 'Lun', valor: 99 }]} limite={limite} />);
            expect(container.querySelector('.ring-2')).toBeNull();
            expect(container).not.toHaveTextContent('límite');
            unmount();
        }
    });

    it('con límite, un valor sobre el límite sigue mostrando su cifra real', () => {
        const { container } = render(<TiraSemana datos={[{ etiqueta: 'Lun', valor: 55 }]} limite={20} />);
        expect(casillas(container)[0]).toHaveTextContent('Lun55%');
    });
});

describe('TiraSemana: entrada y movimiento', () => {
    it('oculta antes de entrar en vista (igual que en el servidor) y aparece al intersectar', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container } = render(<TiraSemana datos={SEMANA} limite={20} />);
        expect(casillas(container)[0].style.opacity).toBe('0');
        expect(casillas(container)[0].style.transform).toBe('scale(0.92)');
        act(() => ObservadorFalso.instancias[0].emitir(true));
        expect(casillas(container)[0].style.opacity).toBe('1');
        expect(casillas(container)[0].style.transform).toBe('none');
        expect(casillas(container)[0].style.transition).toContain('opacity');
        expect(casillas(container)[1].style.transition).toContain('70ms');
    });

    it('con «reducir movimiento» las casillas se ven de inmediato, sin transiciones ni observador', () => {
        simularMatchMedia(true);
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container } = render(<TiraSemana datos={SEMANA} limite={20} />);
        const c = casillas(container);
        expect(c.every((li) => li.style.opacity === '1' && li.style.transition === '')).toBe(true);
        expect(ObservadorFalso.instancias).toHaveLength(0);
    });

    it('sin IntersectionObserver no se queda oculta', async () => {
        const { container } = render(<TiraSemana datos={SEMANA} limite={20} />);
        await esperarEntrada();
        expect(casillas(container)[0].style.opacity).toBe('1');
    });

    it('al cambiar los datos conserva las casillas, no reinicia la entrada y anima el color y el anillo', async () => {
        const { container, rerender } = render(<TiraSemana datos={SEMANA} limite={20} />);
        await esperarEntrada();
        const antes = casillas(container);
        rerender(<TiraSemana datos={SEMANA.map((d) => (d.etiqueta === 'Mié' ? { ...d, valor: 25 } : d))} limite={20} />);
        const despues = casillas(container);
        despues.forEach((li, i) => expect(li).toBe(antes[i]));
        expect(despues[2]).toHaveTextContent('Mié25%');
        expect(despues[2]).toHaveClass('ring-2');
        expect(despues[2].style.opacity).toBe('1');
        expect(despues[2].style.transition).toContain('background-color 0.5s');
        expect(despues[2].style.transition).toContain('box-shadow');
    });

    it('pasar de «sin datos» a «con datos» también hace la entrada', () => {
        vi.stubGlobal('IntersectionObserver', ObservadorFalso);
        const { container, rerender } = render(<TiraSemana datos={[]} />);
        expect(ObservadorFalso.instancias).toHaveLength(1);
        rerender(<TiraSemana datos={SEMANA} limite={20} />);
        expect(casillas(container)[0].style.opacity).toBe('0');
        act(() => ObservadorFalso.instancias[0].emitir(true));
        expect(casillas(container)[0].style.opacity).toBe('1');
    });
});

describe('tiraSemana.utils', () => {
    it('normalizarCasillas separa «sin dato» (null) de 0 y recorta negativos', () => {
        expect(normalizarCasillas([
            { etiqueta: 'a', valor: '4' },
            { etiqueta: 'b', valor: null },
            { etiqueta: 'c', valor: 0 },
            { etiqueta: 'd', valor: -2 },
            { etiqueta: 'e', valor: NaN },
            { etiqueta: 'f', valor: true },
            { valor: 1 },
        ])).toEqual([
            { etiqueta: 'a', valor: 4 },
            { etiqueta: 'b', valor: null },
            { etiqueta: 'c', valor: 0 },
            { etiqueta: 'd', valor: 0 },
            { etiqueta: 'e', valor: null },
            { etiqueta: 'f', valor: null },
            { etiqueta: '', valor: 1 },
        ]);
        expect(normalizarCasillas(undefined)).toEqual([]);
    });

    it('limiteValido solo acepta números mayores que 0', () => {
        expect(limiteValido(20)).toBe(20);
        expect(limiteValido('20')).toBe(20);
        for (const x of [0, -1, null, undefined, 'x', NaN, '']) expect(limiteValido(x)).toBeNull();
    });

    it('escalaTira: con límite es 1,25 x el límite; sin límite, el máximo; sin valores positivos, 0', () => {
        expect(escalaTira([5, 10, null], 20)).toBe(25);
        expect(escalaTira([5, 10, null], undefined)).toBe(10);
        expect(escalaTira([0.2, 0.4], null)).toBe(0.4);
        expect(escalaTira([0, 0], null)).toBe(0);
        expect(escalaTira([null, null], null)).toBe(0);
        expect(escalaTira([], null)).toBe(0);
    });

    it('intensidadCasilla va de 0 a 1, no tiñe sin dato ni con escala 0 y recorta los valores sobre la escala', () => {
        expect(intensidadCasilla(10, 20)).toBe(0.5);
        expect(intensidadCasilla(40, 20)).toBe(1);
        expect(intensidadCasilla(null, 20)).toBe(0);
        expect(intensidadCasilla(5, 0)).toBe(0);
        expect(intensidadCasilla(0, 20)).toBe(0);
        expect(mezclaCasilla(1)).toBe(72);
        expect(mezclaCasilla(0.5)).toBe(36);
        expect(mezclaCasilla(0)).toBe(0);
    });

    it('sin límite, la casilla más alta es la más intensa', () => {
        const escala = escalaTira([3, 9, 6], null);
        expect(intensidadCasilla(9, escala)).toBe(1);
        expect(intensidadCasilla(3, escala)).toBeCloseTo(1 / 3, 6);
    });

    it('estadoLimite distingue sobre, en y por debajo', () => {
        expect(estadoLimite(21, 20)).toBe('sobre');
        expect(estadoLimite(20, 20)).toBe('en');
        expect(estadoLimite(19.99, 20)).toBeNull();
        expect(estadoLimite(null, 20)).toBeNull();
        expect(estadoLimite(50, undefined)).toBeNull();
        expect(estadoLimite(50, 0)).toBeNull();
    });

    it('textoLimite usa la unidad tal como llega', () => {
        expect(textoLimite('sobre', 20, ' %')).toBe('(sobre el límite de 20 %)');
        expect(textoLimite('en', 20, '')).toBe('(en el límite de 20)');
    });

    it('tamanoValorCss acota entre 11 y 16 px y reparte el ancho entre las columnas', () => {
        const css = tamanoValorCss(7, ['14.9', '19.7'], '%');
        expect(css).toMatch(/^clamp\(11px, calc\(.+\), 16px\)$/);
        expect(css).toContain('100cqw');
        expect(css).toContain('- 48px'); // 6 separaciones de 8 px
        expect(css).toContain('/ 7 -'); // 7 columnas
        // un texto más largo exige dividir entre más «em»: la fuente resultante es menor
        const em = (s) => Number(/\/ ([\d.]+)\), 16px/.exec(s)[1]);
        expect(em(tamanoValorCss(7, ['100'], '%'))).toBeGreaterThan(em(tamanoValorCss(7, ['1'], '%')));
        expect(em(tamanoValorCss(5, ['14.9'], ' faltas'))).toBeGreaterThan(em(tamanoValorCss(5, ['14.9'], '%')));
        expect(tamanoValorCss(1, [], undefined)).toContain('calc(');
    });

    it('tamanoEtiquetaCss acota entre 10 y 12 px y el nombre más largo da la letra más pequeña', () => {
        const css = tamanoEtiquetaCss(7, ['Lun', 'Mar']);
        expect(css).toMatch(/^clamp\(10px, calc\(.+\), 12px\)$/);
        expect(css).toContain('100cqw');
        const em = (s) => Number(/\/ ([\d.]+)\), 12px/.exec(s)[1]);
        expect(em(tamanoEtiquetaCss(7, ['Miércoles']))).toBeGreaterThan(em(tamanoEtiquetaCss(7, ['Lun'])));
        expect(tamanoEtiquetaCss(3, [])).toContain('calc(');
    });
});

describe('TiraSemana: contenedor e hidratación', () => {
    it('className va al contenedor, también sin datos', () => {
        const { container, rerender } = render(<TiraSemana datos={SEMANA} className="mi-clase" />);
        expect(container.firstChild).toHaveClass('mi-clase', '@container');
        rerender(<TiraSemana datos={[]} className="mi-clase" />);
        expect(container.firstChild).toHaveClass('mi-clase');
    });

    it('el HTML del servidor se hidrata sin diferencias, con casillas sin dato y sobre el límite incluidas', async () => {
        const datos = [...SEMANA, { etiqueta: 'Sáb', valor: null }, { etiqueta: 'Dom', valor: 33 }];
        const jsx = <TiraSemana datos={datos} limite={20} />;
        const anfitrion = document.createElement('div');
        anfitrion.innerHTML = renderToString(jsx);
        document.body.appendChild(anfitrion);
        // el HTML del servidor llega oculto: la entrada solo ocurre en el cliente, al entrar en vista
        expect(casillas(anfitrion)[0].style.opacity).toBe('0');
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
