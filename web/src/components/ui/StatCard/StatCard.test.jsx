// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { Clock, Users } from 'lucide-react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import StatCard from './StatCard.jsx';

afterEach(() => vi.unstubAllGlobals());

const sinMovimiento = () => vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }));

describe('StatCard', () => {
    it('muestra la cifra y la etiqueta; con href es un enlace con su flecha decorativa', () => {
        const { container } = render(<StatCard label="Alumnos activos" value={75} href="/admin/alumnos" />);
        expect(screen.getByRole('link')).toHaveAttribute('href', '/admin/alumnos');
        expect(screen.getByText('75')).toBeInTheDocument();
        expect(screen.getByText('Alumnos activos')).toBeInTheDocument();
        const flecha = container.querySelector('svg');
        expect(flecha).toHaveAttribute('aria-hidden', 'true');
    });
    it('sin href no es un enlace ni lleva flecha', () => {
        const { container } = render(<StatCard label="Docentes" value={4} />);
        expect(screen.queryByRole('link')).toBeNull();
        expect(container.querySelector('svg')).toBeNull();
    });
    it('loading muestra un guion y marca aria-busy', () => {
        const { container } = render(<StatCard label="x" value={5} unit="%" loading />);
        expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByText('-')).toBeInTheDocument();
        // la unidad no acompaña a un guion
        expect(screen.queryByText('%')).toBeNull();
    });
    it('animated con reducir movimiento deja la cifra final (lectores de pantalla leen siempre el final)', () => {
        sinMovimiento();
        render(<StatCard label="Docentes" value={2} animated />);
        expect(screen.getAllByText('2').length).toBeGreaterThan(0);
        expect(screen.getAllByText('2')[0]).toHaveClass('sr-only');
    });
    it('animated con un valor no numérico lo muestra tal cual', () => {
        render(<StatCard label="Estado" value="OK" animated />);
        expect(screen.getByText('OK')).toBeInTheDocument();
    });
    it('el nombre completo queda en title aunque la etiqueta se corte a dos líneas', () => {
        render(<StatCard label="Registros pendientes de revisión" value={4} />);
        expect(screen.getByText('Registros pendientes de revisión')).toHaveAttribute('title', 'Registros pendientes de revisión');
        expect(screen.getByText('Registros pendientes de revisión')).toHaveClass('line-clamp-2');
    });
    it('el resto de props (data-*, className) pasa al contenedor', () => {
        render(<StatCard label="x" value={1} data-testid="tarjeta" className="col-span-2" />);
        expect(screen.getByTestId('tarjeta')).toHaveClass('col-span-2');
    });
});

describe('StatCard: unidad, icono y estado', () => {
    it('unit va pegada a la cifra, más pequeña y en tinta suave', () => {
        render(<StatCard label="Asistencia" value="82.4" unit="%" />);
        const unidad = screen.getByText('%');
        expect(unidad).toHaveClass('text-muted-foreground', 'text-sm');
        expect(unidad.parentElement).toHaveTextContent('82.4%');
        expect(unidad.parentElement).toContainElement(screen.getByText('82.4', { exact: false }));
    });

    it('con icono dibuja una pastilla gris en neutro y la cifra va en tinta', () => {
        const { container } = render(<StatCard label="Inscritos" value={24} icon={Users} />);
        const icono = container.querySelector('svg');
        expect(icono).toHaveAttribute('aria-hidden', 'true');
        expect(icono.parentElement).toHaveClass('bg-muted', 'text-muted-foreground');
        expect(screen.getByText('24')).toHaveClass('text-foreground');
    });

    it('la pastilla toma el color del estado y la cifra se queda en tinta (el estado no depende solo del color de la cifra)', () => {
        const casos = [
            ['success', 'bg-presente-bg', 'text-presente'],
            ['warning', 'bg-retardo-bg', 'text-retardo'],
            ['danger', 'bg-ausente-bg', 'text-ausente'],
        ];
        for (const [tone, fondo, texto] of casos) {
            const { container, unmount } = render(<StatCard label="x" value={3} tone={tone} icon={Clock} />);
            expect(container.querySelector('svg').parentElement).toHaveClass(fondo, texto);
            expect(screen.getByText('3')).toHaveClass('text-foreground');
            unmount();
        }
    });

    it('sin icono no hay pastilla: la cifra toma el color del estado (como antes del rediseño)', () => {
        const { container, rerender } = render(<StatCard label="x" value={3} tone="danger" />);
        expect(container.querySelector('svg')).toBeNull();
        expect(screen.getByText('3')).toHaveClass('text-ausente');
        rerender(<StatCard label="x" value={3} />);
        expect(screen.getByText('3')).toHaveClass('text-foreground');
    });

    it('hint va en tinta suave en neutro y con el color del estado en los demás', () => {
        const { rerender } = render(<StatCard label="x" value={1} hint="de las programadas" />);
        expect(screen.getByText('de las programadas')).toHaveClass('text-muted-foreground');
        rerender(<StatCard label="x" value={1} hint="A una falta del límite" tone="warning" icon={Clock} />);
        expect(screen.getByText('A una falta del límite')).toHaveClass('text-retardo');
        rerender(<StatCard label="x" value={1} hint="Más del 20 %" tone="danger" icon={Clock} />);
        expect(screen.getByText('Más del 20 %')).toHaveClass('text-ausente');
    });

    it('un tono desconocido cae a neutral en vez de romper', () => {
        const { container } = render(<StatCard label="x" value={1} tone="rosa" icon={Users} hint="apoyo" />);
        expect(container.querySelector('svg').parentElement).toHaveClass('bg-muted');
        expect(screen.getByText('apoyo')).toHaveClass('text-muted-foreground');
    });

    it('con icono y href lleva dos svg decorativos (icono y flecha) y sigue siendo un solo enlace', () => {
        const { container } = render(<StatCard label="Justificantes por resolver" value={2} icon={Users} href="/docente/revision" tone="warning" />);
        const svgs = container.querySelectorAll('svg');
        expect(svgs).toHaveLength(2);
        svgs.forEach((s) => expect(s).toHaveAttribute('aria-hidden', 'true'));
        expect(screen.getAllByRole('link')).toHaveLength(1);
    });
});

describe('StatCard con serie (sparkline)', () => {
    const SERIE = [9, 16, 18, 14, 17, 26.4];

    it('sin serie no hay línea de tendencia: ningún svg ni contenedor decorativo', () => {
        sinMovimiento();
        const { container } = render(<StatCard label="Ausentismo" value="26.4 %" hint="+9.7 pp" tone="danger" />);
        expect(container.querySelector('svg')).toBeNull();
        expect(container.querySelector('[aria-hidden="true"]')).toBeNull();
    });

    it('con serie dibuja un sparkline decorativo (aria-hidden) a la derecha de la cifra, con la altura de la cifra', () => {
        sinMovimiento();
        const { container } = render(<StatCard label="Ausentismo" value="26.4 %" hint="+9.7 pp vs. semana previa" tone="danger" serie={SERIE} />);
        const svg = container.querySelector('svg');
        expect(svg).toBeInTheDocument();
        expect(svg).toHaveAttribute('aria-hidden', 'true');
        expect(svg).toHaveAttribute('height', '28');
        // Cifra y apoyo a la izquierda, línea a la derecha (oculta a lectores de pantalla).
        const fila = screen.getByText('26.4 %').parentElement.parentElement;
        expect(fila).toHaveClass('flex', 'items-end', 'justify-between');
        expect(fila.lastChild).toContainElement(svg);
        expect(fila.lastChild).toHaveAttribute('aria-hidden', 'true');
        // La tendencia sigue diciéndose en texto.
        expect(screen.getByText('+9.7 pp vs. semana previa')).toBeInTheDocument();
        expect(screen.getByText('Ausentismo')).toBeInTheDocument();
    });

    it('el color de la línea sale del estado o de serieColor (token)', () => {
        sinMovimiento();
        const { container, rerender } = render(<StatCard label="x" value={1} tone="danger" serie={SERIE} />);
        expect(container.querySelector('svg').style.color).toBe('var(--g-ausente)');
        rerender(<StatCard label="x" value={1} tone="success" serie={SERIE} />);
        expect(container.querySelector('svg').style.color).toBe('var(--g-presente)');
        rerender(<StatCard label="x" value={1} serie={SERIE} />);
        expect(container.querySelector('svg').style.color).toBe('var(--g-azul)');
        rerender(<StatCard label="x" value={1} tone="danger" serie={SERIE} serieColor="var(--chart-5)" />);
        expect(container.querySelector('svg').style.color).toBe('var(--g-violeta)');
    });

    it('una serie sin 2 puntos reales (o inválida) deja la tarjeta como sin serie: nunca se inventan datos', () => {
        sinMovimiento();
        for (const serie of [undefined, [], [5], [null, NaN, 4], 'abc', [undefined, undefined]]) {
            const { container, unmount } = render(<StatCard label="x" value={3} serie={serie} />);
            expect(container.querySelector('svg')).toBeNull();
            unmount();
        }
    });

    it('loading no dibuja la línea (solo el guion y aria-busy)', () => {
        sinMovimiento();
        const { container } = render(<StatCard label="x" value={5} serie={SERIE} loading />);
        expect(container.querySelector('svg')).toBeNull();
        expect(container.firstChild).toHaveAttribute('aria-busy', 'true');
        expect(screen.getByText('-')).toBeInTheDocument();
    });

    it('con href sigue siendo un enlace completo que contiene la línea', () => {
        sinMovimiento();
        render(<StatCard label="Alumnos en riesgo" value={9} href="/docente/analitica" serie={[3, 4, 5, 6, 8, 9]} />);
        const enlace = screen.getByRole('link');
        expect(enlace).toHaveAttribute('href', '/docente/analitica');
        expect(enlace.querySelectorAll('svg')).toHaveLength(2); // flecha + sparkline
        expect(enlace).toHaveTextContent('Alumnos en riesgo');
    });

    it('animated con serie sigue contando la cifra (valor final para lectores de pantalla) y conserva la línea', () => {
        sinMovimiento();
        const { container } = render(<StatCard animated label="Docentes" value={12} serie={[2, 5, 9, 12]} />);
        expect(screen.getAllByText('12')[0]).toHaveClass('sr-only');
        expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('serie, serieColor, icon y unit no se cuelan como atributos del DOM y el resto de props sí pasa', () => {
        sinMovimiento();
        const { container } = render(<StatCard label="x" value={1} unit="%" icon={Users} serie={SERIE} serieColor="var(--chart-5)" data-testid="tarjeta" className="col-span-2" />);
        const tarjeta = screen.getByTestId('tarjeta');
        expect(tarjeta).toHaveClass('col-span-2');
        expect(container.querySelector('[serie]')).toBeNull();
        expect(container.querySelector('[seriecolor]')).toBeNull();
        expect(tarjeta.getAttributeNames().sort()).toEqual(['class', 'data-testid']);
    });

    it('una serie con ceros y valores numéricos en texto también cuenta como real', () => {
        sinMovimiento();
        const { container } = render(<StatCard label="x" value={1} serie={['0', 0]} />);
        expect(container.querySelector('svg')).toBeInTheDocument();
    });
});
