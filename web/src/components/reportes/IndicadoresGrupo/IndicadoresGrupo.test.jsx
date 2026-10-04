// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import IndicadoresGrupo from './IndicadoresGrupo.jsx';

const kpis = (o) => ({ sesiones_programadas: 45, sesiones_cerradas: 17, asistencia_promedio: 82.35, alumnos_en_limite: 2, alumnos_sin_derecho: 1, ...o });

// Con "reducir movimiento" las cifras animadas quedan en su valor final: sin observadores ni temporizadores fuera de `act`.
beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => vi.unstubAllGlobals());

// La tarjeta (panel blanco) de una etiqueta y su icono de Lucide, que va dentro de una pastilla de color.
const tarjeta = (etiqueta) => screen.getByText(etiqueta).closest('.rounded-xl');
const icono = (nodo) => nodo.querySelector('svg.lucide');

describe('IndicadoresGrupo', () => {
    it('lleva los cuatro indicadores del grupo, cada uno con su icono decorativo', () => {
        render(<IndicadoresGrupo kpis={kpis()} />);
        const esperados = {
            'Sesiones cerradas': 'lucide-calendar-check',
            'Asistencia promedio': 'lucide-trending-up',
            'Alumnos en el límite': 'lucide-triangle-alert',
            'Sin derecho a examen': 'lucide-user-x',
        };
        for (const [etiqueta, clase] of Object.entries(esperados)) {
            expect(icono(tarjeta(etiqueta)), etiqueta).toHaveClass(clase);
            expect(icono(tarjeta(etiqueta))).toHaveAttribute('aria-hidden', 'true');
        }
    });

    it('sesiones cerradas: la cifra son las cerradas y las programadas van como unidad ("/ 45")', () => {
        render(<IndicadoresGrupo kpis={kpis()} />);
        const t = within(tarjeta('Sesiones cerradas'));
        expect(t.getAllByText('17')[0]).toHaveClass('sr-only');
        const unidad = t.getByText('/ 45');
        expect(unidad).toHaveClass('text-muted-foreground', 'text-sm');
        expect(unidad.parentElement).toHaveTextContent('17/ 45');
        expect(t.getByText('de las programadas')).toBeInTheDocument();
    });

    it('asistencia promedio: dos decimales y «%» aparte, con el apoyo de dónde sale', () => {
        render(<IndicadoresGrupo kpis={kpis()} />);
        const t = within(tarjeta('Asistencia promedio'));
        expect(t.getByText('82.35')).toBeInTheDocument();
        expect(t.getByText('%')).toHaveClass('text-muted-foreground');
        expect(t.getByText('en sesiones cerradas')).toBeInTheDocument();
        expect(icono(tarjeta('Asistencia promedio')).parentElement).toHaveClass('bg-muted');
    });

    it('sin asistencia (null) muestra guion, sin unidad ni apoyo: no se inventa un dato', () => {
        render(<IndicadoresGrupo kpis={kpis({ asistencia_promedio: null })} />);
        const t = within(tarjeta('Asistencia promedio'));
        expect(t.getByText('—')).toBeInTheDocument();
        expect(t.queryByText('%')).toBeNull();
        expect(t.queryByText('en sesiones cerradas')).toBeNull();
    });

    it('en el límite y sin derecho: la pastilla y el apoyo toman el color del estado, la cifra se queda en tinta', () => {
        render(<IndicadoresGrupo kpis={kpis()} />);
        const limite = tarjeta('Alumnos en el límite');
        expect(icono(limite).parentElement).toHaveClass('bg-retardo-bg', 'text-retardo');
        expect(within(limite).getByText('Una falta más y pierden el derecho')).toHaveClass('text-retardo');
        expect(within(limite).getAllByText('2')[0].closest('p')).toHaveClass('text-foreground');
        const sin = tarjeta('Sin derecho a examen');
        expect(icono(sin).parentElement).toHaveClass('bg-ausente-bg', 'text-ausente');
        expect(within(sin).getByText('Superó el límite de faltas')).toHaveClass('text-ausente');
    });

    it('con un solo alumno en el límite el apoyo va en singular', () => {
        render(<IndicadoresGrupo kpis={kpis({ alumnos_en_limite: 1 })} />);
        expect(screen.getByText('Una falta más y pierde el derecho')).toBeInTheDocument();
    });

    it('sin nadie en riesgo las dos tarjetas quedan neutras y lo dicen con texto', () => {
        render(<IndicadoresGrupo kpis={kpis({ alumnos_en_limite: 0, alumnos_sin_derecho: 0 })} />);
        for (const etiqueta of ['Alumnos en el límite', 'Sin derecho a examen']) {
            expect(icono(tarjeta(etiqueta)).parentElement).toHaveClass('bg-muted');
            expect(within(tarjeta(etiqueta)).getByText('Ninguno por ahora')).toHaveClass('text-muted-foreground');
        }
    });

    it('sin kpis (o con campos nulos) no revienta: ceros y guion', () => {
        const { rerender } = render(<IndicadoresGrupo kpis={null} />);
        expect(within(tarjeta('Sesiones cerradas')).getByText('/ 0')).toBeInTheDocument();
        expect(within(tarjeta('Asistencia promedio')).getByText('—')).toBeInTheDocument();
        rerender(<IndicadoresGrupo kpis={{ alumnos_en_limite: null, alumnos_sin_derecho: null }} />);
        expect(within(tarjeta('Alumnos en el límite')).getByText('Ninguno por ahora')).toBeInTheDocument();
    });

    it('la cuadrícula es de dos columnas desde 360 px y de cuatro en escritorio', () => {
        render(<IndicadoresGrupo kpis={kpis()} />);
        expect(tarjeta('Sesiones cerradas').parentElement).toHaveClass('grid-cols-2', 'lg:grid-cols-4');
    });
});
