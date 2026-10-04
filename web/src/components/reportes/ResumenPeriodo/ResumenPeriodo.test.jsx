// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ResumenPeriodo from './ResumenPeriodo.jsx';

const grupo = (o) => ({ id_grupo: 1, clave_grupo: '3A', materia_nombre: 'Finanzas', docente_nombre: 'Doc', inscritos: 30, sesiones_programadas: 45, sesiones_cerradas: 17,
    asistencia_promedio: 90, alumnos_en_limite: 2, alumnos_sin_derecho: 1, ...o });
const items = [grupo(), grupo({ id_grupo: 2, clave_grupo: '5C', materia_nombre: 'Costos', inscritos: 20, asistencia_promedio: 70, alumnos_en_limite: 0, alumnos_sin_derecho: 0 })];
const impacto = { minutos_recuperados: 85, horas_recuperadas: 1.42, sesiones_automaticas: 17, sesiones_manuales: 0, sesiones_cerradas: 17, minutos_pase_lista_base: 5 };

// Con "reducir movimiento" las barras se dibujan al instante: sin observadores ni temporizadores fuera de `act`.
beforeEach(() => {
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
});
afterEach(() => vi.unstubAllGlobals());

const tarjeta = (nombre) => screen.getByRole('group', { name: nombre });
const lectores = (nodo) => [...nodo.querySelectorAll('ul.sr-only > li')].map((li) => li.textContent);

describe('ResumenPeriodo: indicadores', () => {
    it('suma grupos, inscritos y alumnos en riesgo, y pondera la asistencia por inscritos', () => {
        render(<ResumenPeriodo reporte={{ items }} />);
        expect(screen.getByText('50 alumnos inscritos')).toBeInTheDocument();
        const asistencia = within(screen.getByText('Asistencia promedio').closest('.rounded-xl'));
        expect(asistencia.getByText('82.00')).toBeInTheDocument();
        expect(asistencia.getByText('%')).toBeInTheDocument();
        expect(screen.getByText('ponderada por inscritos')).toBeInTheDocument();
    });

    it('sin grupos no inventa cifras: asistencia con guion', () => {
        render(<ResumenPeriodo reporte={{ items: [] }} />);
        expect(screen.getByText('0 alumnos inscritos')).toBeInTheDocument();
        expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('muestra el impacto en tiempo solo si llega', () => {
        const { rerender } = render(<ResumenPeriodo reporte={{ items }} />);
        expect(screen.queryByText(/Estimación, no una medición/)).toBeNull();
        rerender(<ResumenPeriodo reporte={{ items }} impacto={impacto} />);
        expect(screen.getByText(/Estimación, no una medición/)).toBeInTheDocument();
    });
});

// La tarjeta (panel blanco) que lleva una etiqueta, su icono de Lucide y la pastilla donde va el icono.
const tarjetaCifra = (etiqueta) => screen.getByText(etiqueta).closest('.rounded-xl');
const iconoDe = (nodo) => nodo.querySelector('svg.lucide');

describe('ResumenPeriodo: tarjetas con icono, unidad y apoyo', () => {
    it('cada indicador lleva su icono de Lucide, decorativo', () => {
        render(<ResumenPeriodo reporte={{ items }} />);
        const esperados = { Grupos: 'lucide-users', 'Asistencia promedio': 'lucide-trending-up', 'Alumnos en el límite': 'lucide-triangle-alert', 'Sin derecho a examen': 'lucide-user-x' };
        for (const [etiqueta, clase] of Object.entries(esperados)) {
            const icono = iconoDe(tarjetaCifra(etiqueta));
            expect(icono, etiqueta).toHaveClass(clase);
            expect(icono).toHaveAttribute('aria-hidden', 'true');
        }
    });

    it('la asistencia es la cifra con dos decimales y el «%» como unidad aparte, en tinta suave', () => {
        render(<ResumenPeriodo reporte={{ items }} />);
        const tarjeta = within(tarjetaCifra('Asistencia promedio'));
        const unidad = tarjeta.getByText('%');
        expect(unidad).toHaveClass('text-muted-foreground');
        expect(unidad.parentElement).toHaveTextContent('82.00%');
        expect(tarjeta.getByText('ponderada por inscritos')).toBeInTheDocument();
    });

    it('con alumnos en el límite o sin derecho la pastilla y el apoyo toman el color del estado', () => {
        render(<ResumenPeriodo reporte={{ items }} />);
        const limite = tarjetaCifra('Alumnos en el límite');
        expect(iconoDe(limite).parentElement).toHaveClass('bg-retardo-bg', 'text-retardo');
        expect(within(limite).getByText('Una falta más y pierden el derecho')).toHaveClass('text-retardo');
        // En singular: un solo alumno sin derecho.
        const sin = tarjetaCifra('Sin derecho a examen');
        expect(iconoDe(sin).parentElement).toHaveClass('bg-ausente-bg', 'text-ausente');
        expect(within(sin).getByText('Superó el límite de faltas')).toHaveClass('text-ausente');
        // La cifra sigue en tinta: el estado lo dicen la pastilla y el texto, no solo el color.
        expect(within(sin).getAllByText('1')[0]).toHaveClass('sr-only');
    });

    it('sin nadie en riesgo las dos tarjetas quedan neutras y lo dicen con texto', () => {
        render(<ResumenPeriodo reporte={{ items: [grupo({ alumnos_en_limite: 0, alumnos_sin_derecho: 0 })] }} />);
        for (const etiqueta of ['Alumnos en el límite', 'Sin derecho a examen']) {
            const tarjeta = tarjetaCifra(etiqueta);
            expect(iconoDe(tarjeta).parentElement).toHaveClass('bg-muted');
            expect(within(tarjeta).getByText('Ninguno por ahora')).toHaveClass('text-muted-foreground');
        }
    });

    it('el apoyo de los grupos concuerda en singular y sin grupos no inventa cifras (guion y sin unidad)', () => {
        const { rerender } = render(<ResumenPeriodo reporte={{ items: [grupo({ inscritos: 1 })] }} />);
        expect(screen.getByText('1 alumno inscrito')).toBeInTheDocument();
        rerender(<ResumenPeriodo reporte={{ items: [] }} />);
        const asistencia = within(tarjetaCifra('Asistencia promedio'));
        expect(asistencia.getByText('—')).toBeInTheDocument();
        expect(asistencia.queryByText('%')).toBeNull();
    });

    it('la cuadrícula es de dos columnas desde 360 px y de cuatro en escritorio', () => {
        render(<ResumenPeriodo reporte={{ items }} />);
        expect(tarjetaCifra('Grupos').parentElement).toHaveClass('grid-cols-2', 'lg:grid-cols-4');
    });
});

describe('ResumenPeriodo: asistencia promedio por grupo', () => {
    it('lista los grupos de menor a mayor asistencia con su cifra, sin línea de mínimo si el reporte no trae el límite', () => {
        render(<ResumenPeriodo reporte={{ items }} />);
        const tarjetaAsistencia = tarjeta('Asistencia promedio por grupo');
        expect(lectores(tarjetaAsistencia)).toEqual(['5C · Costos: 70 %', '3A · Finanzas: 90 %']);
        expect(within(tarjetaAsistencia).getByText('Los grupos con menor asistencia, primero')).toBeInTheDocument();
        expect(tarjetaAsistencia.querySelector('[data-limite]')).toBeNull();
        expect(tarjetaAsistencia).toHaveAccessibleDescription('5C · Costos: 70 %; 3A · Finanzas: 90 %');
    });

    it('con el límite de faltas del reporte dibuja la línea de asistencia mínima (100 - límite) con su etiqueta', () => {
        render(<ResumenPeriodo reporte={{ items, limite_pct: 20 }} />);
        const tarjetaAsistencia = tarjeta('Asistencia promedio por grupo');
        expect(tarjetaAsistencia.querySelectorAll('[data-limite]')).toHaveLength(1);
        expect(within(tarjetaAsistencia).getAllByText('Mínimo 80 %').length).toBeGreaterThan(0);
        expect(within(tarjetaAsistencia).getByText('Menor a mayor · mínimo de 80 %')).toBeInTheDocument();
    });

    it('con más de 10 grupos muestra los 10 de menor asistencia y avisa que el resto está en la pestaña Grupos', () => {
        const muchos = Array.from({ length: 12 }, (_, i) => grupo({ id_grupo: i + 1, clave_grupo: `G${i + 1}`, materia_nombre: `M${i + 1}`, asistencia_promedio: 50 + i }));
        render(<ResumenPeriodo reporte={{ items: muchos }} />);
        const tarjetaAsistencia = tarjeta('Asistencia promedio por grupo');
        expect(tarjetaAsistencia.querySelectorAll('[data-fila]')).toHaveLength(10);
        expect(within(tarjetaAsistencia).getByText('Se muestran hasta 10 grupos; el resto está en la pestaña Grupos.')).toBeInTheDocument();
    });

    it('un grupo sin asistencia registrada no entra y sin ninguno sale el aviso', () => {
        render(<ResumenPeriodo reporte={{ items: [grupo({ asistencia_promedio: null })] }} />);
        const tarjetaAsistencia = tarjeta('Asistencia promedio por grupo');
        expect(within(tarjetaAsistencia).getByText('Aún no hay asistencia registrada')).toBeInTheDocument();
        expect(tarjetaAsistencia).toHaveAccessibleDescription('Sin datos de asistencia.');
    });
});

describe('ResumenPeriodo: alumnos por situación', () => {
    it('una barra apilada por grupo con el total al final, leyenda de las tres situaciones y texto para lectores', () => {
        render(<ResumenPeriodo reporte={{ items }} />);
        const situacion = tarjeta('Alumnos por situación');
        // Primero los grupos con más alumnos en riesgo.
        expect(lectores(situacion)).toEqual([
            '3A · Finanzas: Con derecho 27 · En el límite 2 · Sin derecho 1 · total 30',
            '5C · Costos: Con derecho 20 · En el límite 0 · Sin derecho 0 · total 20',
        ]);
        expect(situacion.querySelectorAll('[data-fila]')).toHaveLength(2);
        // 3 segmentos por barra: nada de series solapadas lado a lado.
        expect(situacion.querySelectorAll('[data-fila="3A · Finanzas"] [data-segmento]')).toHaveLength(3);
        const leyenda = [...situacion.querySelectorAll('ul:not(.sr-only) > li')].map((li) => li.textContent);
        expect(leyenda).toEqual(['Con derecho', 'En el límite', 'Sin derecho']);
        expect(situacion).toHaveAccessibleDescription(/3A · Finanzas: 27 con derecho, 2 en el límite, 1 sin derecho/);
    });

    it('sin alumnos inscritos muestra el aviso', () => {
        render(<ResumenPeriodo reporte={{ items: [grupo({ inscritos: 0, alumnos_en_limite: 0, alumnos_sin_derecho: 0, asistencia_promedio: null })] }} />);
        const situacion = tarjeta('Alumnos por situación');
        expect(within(situacion).getByText('Aún no hay alumnos inscritos')).toBeInTheDocument();
        expect(situacion).toHaveAccessibleDescription('Sin alumnos inscritos.');
    });
});
