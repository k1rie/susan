// @vitest-environment jsdom
import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MedidorLiquido from './MedidorLiquido.jsx';

// IntersectionObserver, matchMedia y rAF simulados (jsdom no trae los dos primeros ni un rAF controlable).
class ObservadorFalso {
    static instancias = [];
    constructor(cb) {
        this.cb = cb;
        ObservadorFalso.instancias.push(this);
    }
    observe() {}
    disconnect() {}
    emitir() {
        this.cb([{ isIntersecting: true }]);
    }
}
function preparar({ reducido = false } = {}) {
    vi.stubGlobal('matchMedia', () => ({ matches: reducido, addEventListener() {}, removeEventListener() {} }));
    vi.stubGlobal('IntersectionObserver', ObservadorFalso);
    let id = 0;
    let ahora = 0;
    const cola = new Map();
    vi.stubGlobal('requestAnimationFrame', (cb) => {
        id += 1;
        cola.set(id, cb);
        return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (i) => {
        cola.delete(i);
    });
    return {
        pendientes: () => cola.size,
        avanzar(n = 1, ms = 16) {
            for (let i = 0; i < n; i += 1) {
                ahora += ms;
                const lote = [...cola.values()];
                cola.clear();
                lote.forEach((cb) => cb(ahora));
            }
        },
    };
}
const entrar = () => act(() => ObservadorFalso.instancias.forEach((o) => o.emitir()));
// Líquido del tanque: el primer hijo marcado aria-hidden del medidor (showValue es false).
const arriba = () => {
    const m = /calc\(([-\d.]+)% \+/.exec(screen.getByRole('meter').querySelector('[aria-hidden="true"]').style.clipPath);
    return m ? Number(m[1]) : null;
};

afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    ObservadorFalso.instancias = [];
});

describe('MedidorLiquido: semántica', () => {
    it('es un meter con nombre «etiqueta: N %» y el valor real aunque el líquido aún no haya subido', () => {
        preparar();
        render(<MedidorLiquido valor={82} etiqueta="Asistencia promedio" descripcion="17 de 45 sesiones cerradas" />);
        const meter = screen.getByRole('meter', { name: 'Asistencia promedio: 82 %' });
        expect(meter).toHaveAttribute('aria-valuenow', '82');
        expect(meter).toHaveAttribute('aria-valuemin', '0');
        expect(meter).toHaveAttribute('aria-valuemax', '100');
        expect(meter).toHaveAccessibleDescription('17 de 45 sesiones cerradas');
        // El tanque todavía está vacío (no ha entrado en vista) pero el lector ya recibe 82.
        expect(arriba()).toBe(100);
        expect(screen.getAllByText('82 %')[0]).toHaveClass('sr-only');
        expect(screen.getByText('17 de 45 sesiones cerradas')).toBeInTheDocument();
    });

    it('sin etiqueta el nombre es «Nivel: N %»; lo no numérico es 0 y lo fuera de rango se acota', () => {
        preparar({ reducido: true });
        const { rerender } = render(<MedidorLiquido valor={NaN} />);
        expect(screen.getByRole('meter', { name: 'Nivel: 0 %' })).toHaveAttribute('aria-valuenow', '0');
        rerender(<MedidorLiquido valor={140} />);
        expect(screen.getByRole('meter', { name: 'Nivel: 100 %' })).toHaveAttribute('aria-valuenow', '100');
        rerender(<MedidorLiquido valor={-4} />);
        expect(screen.getByRole('meter', { name: 'Nivel: 0 %' })).toBeInTheDocument();
    });

    it('con decimales el nombre y aria-valuenow dicen lo mismo que la cifra (1 decimal)', () => {
        preparar({ reducido: true });
        render(<MedidorLiquido valor={82.35} etiqueta="Asistencia" />);
        const meter = screen.getByRole('meter');
        expect(meter).toHaveAttribute('aria-valuenow', '82.3');
        expect(meter).toHaveAccessibleName('Asistencia: 82.3 %');
        expect(screen.getAllByText('82.3 %')[0]).toHaveClass('sr-only');
    });

    it('className se suma a la maquetación base en lugar de reemplazarla', () => {
        preparar({ reducido: true });
        render(<MedidorLiquido valor={10} className="mt-4" />);
        const raiz = screen.getByRole('meter').closest('div[class*="flex-wrap"]');
        expect(raiz).toHaveClass('flex', 'flex-wrap', 'items-center', 'mt-4');
    });
});

describe('MedidorLiquido: animación', () => {
    it('el líquido sube al entrar en vista y se queda en el valor', () => {
        const reloj = preparar();
        render(<MedidorLiquido valor={60} etiqueta="Presentes" />);
        expect(arriba()).toBe(100);
        entrar();
        reloj.avanzar(400);
        expect(arriba()).toBe(40);
        expect(reloj.pendientes()).toBe(0);
    });

    it('con reducir movimiento el tanque aparece ya lleno, sin observador ni cuadros', () => {
        const reloj = preparar({ reducido: true });
        render(<MedidorLiquido valor={60} etiqueta="Presentes" />);
        expect(arriba()).toBe(40);
        expect(reloj.pendientes()).toBe(0);
        expect(ObservadorFalso.instancias).toHaveLength(0);
    });

    it('si el valor cambia por sondeo, el MISMO tanque chapotea hacia el nuevo nivel (sin remontar ni bajar a 0) y los atributos se actualizan', () => {
        const reloj = preparar();
        const { rerender } = render(<MedidorLiquido valor={38} etiqueta="Presentes ahora" />);
        const meter = screen.getByRole('meter');
        entrar();
        reloj.avanzar(400);
        expect(arriba()).toBe(62);

        rerender(<MedidorLiquido valor={64} etiqueta="Presentes ahora" />);
        expect(screen.getByRole('meter')).toBe(meter);
        expect(meter).toHaveAttribute('aria-valuenow', '64');
        expect(meter).toHaveAccessibleName('Presentes ahora: 64 %');
        reloj.avanzar(1);
        // Partió de donde estaba (62 % desde arriba) y sube; no se vació (100) ni se reinició.
        expect(arriba()).toBeLessThanOrEqual(62);
        expect(arriba()).toBeGreaterThan(50);
        reloj.avanzar(400);
        expect(arriba()).toBe(36);
        expect(reloj.pendientes()).toBe(0);
    });

    it('la cifra grande cuenta desde la anterior cuando cambia el valor (no desde 0)', () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
        const reloj = preparar();
        const { container, rerender } = render(<MedidorLiquido valor={40} />);
        entrar();
        act(() => vi.advanceTimersByTime(0));
        reloj.avanzar(120, 16);
        const cifra = () => container.querySelector('p span[aria-hidden="true"]');
        expect(cifra().textContent).toBe('40 %');

        rerender(<MedidorLiquido valor={70} />);
        act(() => vi.advanceTimersByTime(0));
        expect(cifra().textContent).toBe('40 %');
        reloj.avanzar(3, 16);
        const intermedio = parseFloat(cifra().textContent);
        expect(intermedio).toBeGreaterThanOrEqual(40);
        expect(intermedio).toBeLessThan(70);
        reloj.avanzar(120, 16);
        expect(cifra().textContent).toBe('70 %');
    });

    it('un valor igual en un re-render no reanima ni remonta', () => {
        const reloj = preparar();
        const { rerender } = render(<MedidorLiquido valor={50} />);
        entrar();
        reloj.avanzar(400);
        const meter = screen.getByRole('meter');
        rerender(<MedidorLiquido valor={50} descripcion="otra línea" />);
        expect(screen.getByRole('meter')).toBe(meter);
        expect(reloj.pendientes()).toBe(0);
        expect(arriba()).toBe(50);
    });
});

describe('MedidorLiquido: marca de límite', () => {
    it('sin limite no hay marca', () => {
        preparar({ reducido: true });
        const { container } = render(<MedidorLiquido valor={70} etiqueta="Asistencia" />);
        expect(container.querySelector('[data-limite]')).toBeNull();
        expect(screen.getByRole('meter')).not.toHaveAttribute('aria-describedby');
    });

    it('dibuja la marca a la altura del límite con su etiqueta, sin duplicar el texto en el DOM', () => {
        preparar({ reducido: true });
        const { container } = render(<MedidorLiquido valor={64} tono="retardo" etiqueta="Asistencia" limite={{ valor: 80, etiqueta: 'Mínimo 80 %' }} alto={200} />);
        const marca = container.querySelector('[data-limite]');
        expect(marca).toHaveAttribute('data-limite', '80');
        expect(marca.style.bottom).toBe('80%');
        expect(marca.style.transform).toBe('translateY(50%)');
        // La línea es discontinua y decorativa; el texto de la etiqueta aparece una sola vez.
        expect(marca.querySelector('[aria-hidden="true"]').className).toContain('border-dashed');
        expect(screen.getAllByText('Mínimo 80 %')).toHaveLength(1);
        expect(marca).toHaveTextContent('Mínimo 80 %');
    });

    it('el medidor se describe con la etiqueta del límite (y con la descripción, si hay)', () => {
        preparar({ reducido: true });
        render(<MedidorLiquido valor={64} etiqueta="Asistencia" descripcion="A una falta del límite" limite={{ valor: 80, etiqueta: 'Mínimo 80 %' }} />);
        expect(screen.getByRole('meter')).toHaveAccessibleDescription('Mínimo 80 % A una falta del límite');
    });

    it('la etiqueta va en su propia columna: no se mete en el bloque de la cifra ni de la descripción', () => {
        preparar({ reducido: true });
        const { container } = render(<MedidorLiquido valor={64} etiqueta="Asistencia" descripcion="A una falta" limite={{ valor: 80, etiqueta: 'Mínimo 80 %' }} />);
        const marca = container.querySelector('[data-limite]');
        const bloqueTexto = screen.getByText('A una falta').parentElement;
        expect(bloqueTexto.contains(marca)).toBe(false);
        // El contenedor del tanque (relative) contiene tanque + marca; el bloque de texto es su hermano.
        const tanqueConMarca = marca.parentElement;
        expect(tanqueConMarca).toContainElement(screen.getByRole('meter'));
        expect(tanqueConMarca.nextElementSibling).toBe(bloqueTexto);
        expect(tanqueConMarca).toHaveClass('shrink-0');
    });

    it('la marca se acota a 0-100 y usa un texto por defecto si no hay etiqueta', () => {
        preparar({ reducido: true });
        const { container, rerender } = render(<MedidorLiquido valor={50} limite={{ valor: 140 }} />);
        expect(container.querySelector('[data-limite]').style.bottom).toBe('100%');
        expect(screen.getByText('Límite 100 %')).toBeInTheDocument();
        rerender(<MedidorLiquido valor={50} limite={{ valor: -3, etiqueta: 'Piso' }} />);
        expect(container.querySelector('[data-limite]').style.bottom).toBe('0%');
        expect(screen.getByText('Piso')).toBeInTheDocument();
    });

    it('un límite inválido se ignora sin romper el medidor', () => {
        preparar({ reducido: true });
        for (const limite of [{ valor: null }, { valor: 'abc' }, {}, 'x', 5]) {
            const { container, unmount } = render(<MedidorLiquido valor={50} limite={limite} />);
            expect(container.querySelector('[data-limite]')).toBeNull();
            expect(screen.getByRole('meter')).toBeInTheDocument();
            unmount();
        }
    });

    it('la marca sigue a `limite` cuando cambia', () => {
        preparar({ reducido: true });
        const { container, rerender } = render(<MedidorLiquido valor={50} limite={{ valor: 80, etiqueta: 'Mínimo 80 %' }} />);
        rerender(<MedidorLiquido valor={50} limite={{ valor: 60, etiqueta: 'Mínimo 60 %' }} />);
        expect(container.querySelector('[data-limite]').style.bottom).toBe('60%');
        expect(screen.getByText('Mínimo 60 %')).toBeInTheDocument();
        expect(screen.queryByText('Mínimo 80 %')).toBeNull();
    });
});

describe('MedidorLiquido: colores', () => {
    it('el tono elige un token de gráfica (nunca hex) y uno desconocido cae en presente', () => {
        preparar({ reducido: true });
        const { rerender } = render(<MedidorLiquido valor={50} tono="ausente" />);
        expect(screen.getByRole('meter').style.getPropertyValue('--sg-liquid')).toBe('var(--g-ausente)');
        rerender(<MedidorLiquido valor={50} tono="violeta" />);
        expect(screen.getByRole('meter').style.getPropertyValue('--sg-liquid')).toBe('var(--g-violeta)');
        rerender(<MedidorLiquido valor={50} tono="inexistente" />);
        expect(screen.getByRole('meter').style.getPropertyValue('--sg-liquid')).toBe('var(--g-presente)');
        expect(screen.getByRole('meter').style.getPropertyValue('--sg-glass')).toBe('var(--muted)');
    });
});
