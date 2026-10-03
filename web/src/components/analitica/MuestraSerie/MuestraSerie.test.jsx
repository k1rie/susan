// @vitest-environment jsdom
import { render } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CONFIG_ACUMULADO, CONFIG_SERIE } from '../analitica.utils.js';
import MuestraSerie, { conIconos } from './index.js';

describe('MuestraSerie', () => {
    it('cada forma se distingue sin depender del color y se oculta a los lectores de pantalla', () => {
        const { container } = render(
            <>
                <MuestraSerie forma="linea" color="var(--chart-1)" />
                <MuestraSerie forma="discontinua" color="var(--chart-1)" />
                <MuestraSerie forma="banda" color="var(--chart-1)" />
                <MuestraSerie forma="punto" color="var(--chart-1)" />
                <MuestraSerie forma="inexistente" color="var(--chart-1)" />
            </>,
        );
        const muestras = [...container.querySelectorAll('[data-forma]')];
        expect(muestras.map((m) => m.dataset.forma)).toEqual(['linea', 'discontinua', 'banda', 'punto', 'punto']);
        muestras.forEach((m) => expect(m).toHaveAttribute('aria-hidden', 'true'));
        expect(muestras[1].className).toContain('border-dashed');
        expect(muestras[2].className).toContain('opacity-30');
        // el color solo viene de un token (nunca hex)
        expect(muestras[0].style.backgroundColor).toBe('var(--chart-1)');
        expect(muestras[1].style.borderColor).toBe('var(--chart-1)');
    });
});

describe('conIconos', () => {
    it('añade un icono por serie con forma, estable entre llamadas y sin mutar la configuración', () => {
        const antes = JSON.stringify(CONFIG_SERIE);
        const a = conIconos(CONFIG_SERIE);
        const b = conIconos(CONFIG_SERIE);
        expect(JSON.stringify(CONFIG_SERIE)).toBe(antes);
        for (const clave of Object.keys(CONFIG_SERIE)) {
            expect(typeof a[clave].icon).toBe('function');
            expect(a[clave].icon).toBe(b[clave].icon);
            expect(a[clave].label).toBe(CONFIG_SERIE[clave].label);
        }
        expect(conIconos({ sinForma: { label: 'X', color: 'var(--chart-1)' } }).sinForma.icon).toBeUndefined();
    });
    it('ajuste, proyección e intervalo comparten color pero no forma (ni icono)', () => {
        const c = conIconos(CONFIG_SERIE);
        expect(new Set(['ajuste', 'proyeccion', 'banda'].map((k) => c[k].color)).size).toBe(1);
        expect(new Set(['ajuste', 'proyeccion', 'banda'].map((k) => c[k].icon)).size).toBe(3);
        const Icono = c.proyeccion.icon;
        const { container } = render(<Icono />);
        expect(container.firstChild).toHaveAttribute('data-forma', 'discontinua');
    });
    it('el acumulado reutiliza las formas de la serie semanal', () => {
        for (const clave of ['ajuste', 'proyeccion', 'banda']) expect(CONFIG_ACUMULADO[clave].forma).toBe(CONFIG_SERIE[clave].forma);
        expect(conIconos(CONFIG_ACUMULADO).acumulado.icon).toBeTypeOf('function');
    });
});
