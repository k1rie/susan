// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import PasoView, { TextoPaso } from './PasoView.jsx';

const LARGO = `${'Primera frase de bastante longitud para el paso numérico'}. ${'Segunda frase con más detalle que se pliega. '.repeat(3)}`.trim();

describe('TextoPaso', () => {
    it('muestra la primera frase y pliega el resto tras "Más", que alterna a "Menos"', async () => {
        const { container } = render(<TextoPaso texto={LARGO} />);
        const boton = screen.getByRole('button', { name: 'Más' });
        const resto = container.querySelector('span');
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(boton).toHaveAttribute('aria-controls', resto.id);
        expect(resto).toHaveTextContent('Segunda frase con más detalle');
        expect(resto.className).toContain('hidden');
        await userEvent.click(boton);
        expect(screen.getByRole('button', { name: 'Menos' })).toHaveAttribute('aria-expanded', 'true');
        expect(resto.className).not.toContain('hidden');
        await userEvent.click(screen.getByRole('button', { name: 'Menos' }));
        expect(resto.className).toContain('hidden');
    });
    it('el resto plegado se oculta con clases y no con el atributo hidden, para que se imprima', () => {
        const { container } = render(<TextoPaso texto={LARGO} />);
        const resto = container.querySelector('span');
        // `[hidden]` lleva display:none !important en el preflight de Tailwind: ninguna utilidad print: le gana
        expect(resto).not.toHaveAttribute('hidden');
        expect(resto.className.split(' ')).toEqual(expect.arrayContaining(['hidden', 'print:inline']));
        // el botón no se imprime
        expect(screen.getByRole('button', { name: 'Más' }).className).toContain('print:hidden');
    });
    it('un texto corto no lleva botón ni pliegue', () => {
        const { container } = render(<TextoPaso texto="Texto corto." />);
        expect(screen.queryByRole('button')).toBeNull();
        expect(container.querySelector('span')).toBeNull();
        expect(screen.getByText('Texto corto.')).toBeInTheDocument();
    });
});

describe('PasoView', () => {
    it('pinta título, texto, valores y tabla del paso', () => {
        render(<PasoView paso={{ titulo: 'Paso 1', texto: 'Breve.', valores: [{ etiqueta: 'Pendiente', valor: 1.23456789 }], tabla: { columnas: ['x', 'y'], filas: [[1, 2.5]] } }} />);
        expect(screen.getByRole('heading', { name: 'Paso 1' })).toBeInTheDocument();
        expect(screen.getByText('1.23457')).toBeInTheDocument();
        expect(screen.getByRole('columnheader', { name: 'x' })).toBeInTheDocument();
        expect(screen.getByText('2.5')).toBeInTheDocument();
    });
});
