// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CalendarioRacha from './CalendarioRacha.jsx';

beforeEach(() => {
    // «Reducir movimiento»: las casillas aparecen de inmediato y sin transición.
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));
});
afterEach(() => vi.unstubAllGlobals());

let n = 0;
const s = (fecha, estado, extra = {}) => ({ id_sesion: (n += 1), fecha, hora_inicio: '07:00:00', hora_fin: '09:00:00', estatus_sesion: 'cerrada', estado, ...extra });

// Forma real de `items` de api_alumno_historial: la más reciente primero, estado null = sin registro.
const HISTORIAL = [
    s('2026-10-02', 'presente'),
    s('2026-09-30', 'retardo'),
    s('2026-09-28', 'presente'),
    s('2026-09-25', 'ausente'),
    s('2026-09-23', 'presente'),
    s('2026-09-21', 'presente'),
    s('2026-09-18', 'justificado'),
    s('2026-09-16', 'presente'),
    s('2026-09-14', 'presente'),
];

const tarjeta = () => screen.getByRole('group', { name: 'Calendario de asistencia' });

describe('CalendarioRacha', () => {
    it('es una TarjetaGrafica «Calendario de asistencia» con una casilla por sesión y su estado', () => {
        const { container } = render(<CalendarioRacha items={HISTORIAL} materia="Álgebra" />);
        expect(tarjeta()).toBeInTheDocument();
        expect(container.querySelectorAll('[data-fecha]')).toHaveLength(9);
        expect(container.querySelector('[data-fecha="2026-10-02"]')).toHaveAttribute('data-estado', 'presente');
        expect(container.querySelector('[data-fecha="2026-09-30"]')).toHaveAttribute('data-estado', 'retardo');
        expect(container.querySelector('[data-fecha="2026-09-25"]')).toHaveAttribute('data-estado', 'ausente');
        expect(container.querySelector('[data-fecha="2026-09-18"]')).toHaveAttribute('data-estado', 'justificado');
        // Los colores salen de tokens de gráfica, nunca hex.
        expect(container.querySelector('[data-fecha="2026-09-25"]').style.backgroundColor).toBe('var(--g-ausente)');
        expect(within(tarjeta()).getByText('Cada cuadro es una sesión')).toBeInTheDocument();
    });

    it('la racha es la pieza destacada en las acciones: llama, «Racha de N sesiones» y «Mejor racha N»', () => {
        const { container } = render(<CalendarioRacha items={HISTORIAL} />);
        const racha = container.querySelector('[data-racha]');
        expect(racha).toHaveAttribute('data-racha', '3');
        expect(within(racha).getByText('Racha de 3 sesiones')).toBeInTheDocument();
        expect(within(racha).getByText('Mejor racha 4')).toBeInTheDocument();
        const llama = racha.querySelector('svg');
        expect(llama.getAttribute('class')).toContain('lucide-flame');
        expect(llama).toHaveAttribute('aria-hidden', 'true');
        // Dorado de marca (token) mientras la racha está activa.
        expect(llama).toHaveClass('text-brand-gold');
        expect(racha).toHaveClass('bg-brand-gold-soft');
    });

    it('racha de 1 sesión en singular', () => {
        render(<CalendarioRacha items={[s('2026-10-02', 'presente')]} />);
        expect(screen.getByText('Racha de 1 sesión')).toBeInTheDocument();
        expect(screen.getByText('Mejor racha 1')).toBeInTheDocument();
    });

    it('una ausencia reciente deja «Sin racha activa» en gris y conserva la mejor racha', () => {
        const { container } = render(<CalendarioRacha items={[s('2026-10-02', 'ausente'), s('2026-09-30', 'presente'), s('2026-09-28', 'presente')]} />);
        const racha = container.querySelector('[data-racha]');
        expect(racha).toHaveAttribute('data-racha', '0');
        expect(within(racha).getByText('Sin racha activa')).toBeInTheDocument();
        expect(within(racha).getByText('Mejor racha 2')).toBeInTheDocument();
        expect(racha.querySelector('svg')).toHaveClass('text-muted-foreground');
        expect(racha).toHaveClass('bg-muted');
    });

    it('si nunca hubo racha no escribe «mejor racha 0»', () => {
        render(<CalendarioRacha items={[s('2026-10-02', 'ausente')]} />);
        expect(screen.getByText('Sin racha activa')).toBeInTheDocument();
        expect(screen.queryByText(/Mejor racha/)).toBeNull();
    });

    it('texto alternativo: estados, racha y mejor racha, sin que el calendario lo repita', () => {
        const { container } = render(<CalendarioRacha items={HISTORIAL} materia="Álgebra" />);
        expect(tarjeta()).toHaveAccessibleDescription(
            'Calendario de asistencia de Álgebra: 9 sesiones (Presentes 6, Retardos 1, Ausencias 1, Justificadas 1). Racha de 3 sesiones. Mejor racha 4.',
        );
        // La cuadrícula es decorativa y su propio resumen oculto va vacío: el lector no oye lo mismo dos veces.
        expect(container.querySelector('[data-fecha]').closest('[aria-hidden="true"]')).not.toBeNull();
        const ocultos = [...container.querySelectorAll('.sr-only')].map((p) => p.textContent).filter(Boolean);
        expect(ocultos).toHaveLength(1);
    });

    it('la leyenda cuenta los estados con cifras', () => {
        render(<CalendarioRacha items={HISTORIAL} />);
        const leyenda = within(tarjeta()).getAllByRole('listitem').map((li) => li.textContent);
        expect(leyenda).toEqual(['Presentes6', 'Retardos1', 'Ausencias1', 'Justificadas1']);
    });

    it('una sesión sin registro, una suspendida y una abierta se dibujan aparte y no rompen la racha de las abiertas', () => {
        const items = [
            s('2026-10-05', null, { estatus_sesion: 'abierta' }),
            s('2026-10-02', 'presente'),
            s('2026-09-30', null, { estatus_sesion: 'suspendida' }),
            s('2026-09-28', 'presente'),
            s('2026-09-25', null),
        ];
        const { container } = render(<CalendarioRacha items={items} />);
        expect(container.querySelector('[data-fecha="2026-10-05"]')).toHaveAttribute('data-estado', 'sin_registro');
        expect(container.querySelector('[data-fecha="2026-09-30"]')).toHaveAttribute('data-estado', 'suspendida');
        expect(container.querySelector('[data-fecha="2026-09-25"]')).toHaveAttribute('data-estado', 'sin_registro');
        // Sesión abierta y suspendida ni cuentan ni cortan; la cerrada sin registro de hasta atrás sí es falta.
        expect(screen.getByText('Racha de 2 sesiones')).toBeInTheDocument();
    });

    it('con 26 semanas o más muestra solo las más recientes y lo dice', () => {
        // Un lunes por semana durante 40 semanas desde el 5 de enero de 2026.
        const base = Date.UTC(2026, 0, 5);
        const items = Array.from({ length: 40 }, (_, i) => s(new Date(base + i * 7 * 86400000).toISOString().slice(0, 10), 'presente')).reverse();
        const { container } = render(<CalendarioRacha items={items} />);
        expect(screen.getByText('Cada cuadro es una sesión · últimas 26 semanas')).toBeInTheDocument();
        expect(container.querySelectorAll('[data-fecha]')).toHaveLength(26);
        expect(tarjeta()).toHaveAccessibleDescription(/Se muestran las últimas 26 semanas\./);
        // La racha es de todas las sesiones recibidas, no solo de las dibujadas.
        expect(screen.getByText('Racha de 40 sesiones')).toBeInTheDocument();
    });

    it('«Cómo se cuenta la racha» está plegado y se abre con el botón', async () => {
        render(<CalendarioRacha items={HISTORIAL} />);
        const boton = screen.getByRole('button', { name: 'Cómo se cuenta la racha' });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        await userEvent.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'true');
        expect(screen.getByText(/La racha cuenta las sesiones seguidas en las que estuviste presente o con retardo/)).toBeInTheDocument();
    });

    describe('estado vacío', () => {
        it('sin sesiones: mensaje amable con icono, sin racha, sin cuadrícula y con texto alternativo', () => {
            const { container } = render(<CalendarioRacha items={[]} materia="Álgebra" />);
            expect(screen.getByText('Tu calendario empieza con la primera clase')).toBeInTheDocument();
            expect(screen.getByText(/Cuando haya sesiones en esta materia verás aquí cada una con su estado/)).toBeInTheDocument();
            expect(container.querySelector('[data-fecha]')).toBeNull();
            expect(container.querySelector('[data-racha]')).toBeNull();
            expect(screen.queryByRole('button', { name: 'Cómo se cuenta la racha' })).toBeNull();
            expect(container.querySelector('svg')?.parentElement).toHaveAttribute('aria-hidden', 'true');
            expect(tarjeta()).toHaveAccessibleDescription('Calendario de asistencia de Álgebra: aún no hay sesiones registradas.');
        });

        it('sin la propiedad items tampoco falla', () => {
            render(<CalendarioRacha />);
            expect(screen.getByText('Tu calendario empieza con la primera clase')).toBeInTheDocument();
        });

        it('el vacío se vuelve calendario cuando llegan las sesiones', () => {
            const { rerender, container } = render(<CalendarioRacha items={[]} />);
            rerender(<CalendarioRacha items={HISTORIAL} />);
            expect(container.querySelectorAll('[data-fecha]')).toHaveLength(9);
            expect(screen.queryByText('Tu calendario empieza con la primera clase')).toBeNull();
            expect(screen.getByText('Racha de 3 sesiones')).toBeInTheDocument();
        });
    });

    it('«reducir movimiento»: las casillas son visibles de inmediato y sin transición', () => {
        const { container } = render(<CalendarioRacha items={HISTORIAL} />);
        const casilla = container.querySelector('[data-fecha="2026-09-14"]');
        expect(casilla.style.opacity).toBe('1');
        expect(casilla.style.transition).toBe('');
    });

    it('el calendario lleva un tope de ancho según sus semanas (casillas de ~28 px como máximo en pantallas anchas)', () => {
        const { container } = render(<CalendarioRacha items={HISTORIAL} />);
        const tope = container.querySelector('[data-fecha]').closest('[style*="max-width"]');
        // HISTORIAL ocupa 3 semanas: del 14 de septiembre al 2 de octubre.
        expect(tope.style.maxWidth).toBe('calc(1.75rem + 3 * (1.75rem + 3px))');
    });

    it('360 px: la cuadrícula se reparte en fracciones (las casillas se encogen) y la tarjeta no fija anchos', () => {
        const { container } = render(<CalendarioRacha items={HISTORIAL} />);
        const rejilla = container.querySelector('.grid[style*="grid-template-columns"]');
        expect(rejilla.style.gridTemplateColumns).toContain('minmax(0, 1fr)');
        expect(container.querySelector('[class*="aspect-square"]')).not.toBeNull();
        expect(container.innerHTML).not.toMatch(/\bw-\[\d+px\]|min-w-\[/);
    });
});
