// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import Detalles from './Detalles';

describe('Detalles', () => {
    it('plegado por defecto con aria-expanded; se oculta con clases (visible al imprimir) y el contenido sigue en el DOM', async () => {
        render(<Detalles titulo="Ver detalle" resumen="24 alumnos"><p>contenido largo</p></Detalles>);
        const boton = screen.getByRole('button', { name: /Ver detalle/ });
        const panel = screen.getByText('contenido largo').parentElement;
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(panel).toHaveClass('hidden', 'print:block');
        expect(panel).not.toHaveAttribute('hidden');
        await userEvent.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'true');
        expect(panel).not.toHaveClass('hidden');
        await userEvent.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(panel).toHaveClass('hidden');
    });
    it('abierto inicial', () => {
        render(<Detalles titulo="X" abierto><p>hola</p></Detalles>);
        expect(screen.getByRole('button', { name: /X/ })).toHaveAttribute('aria-expanded', 'true');
    });
    it('onAlternar avisa del estado; montarAlAbrir no monta los hijos hasta la primera apertura y luego los conserva', async () => {
        const avisos = [];
        render(<Detalles titulo="Perezoso" montarAlAbrir onAlternar={(v) => avisos.push(v)}><p>carga</p></Detalles>);
        expect(screen.queryByText('carga')).toBeNull();
        await userEvent.click(screen.getByRole('button', { name: /Perezoso/ }));
        expect(screen.getByText('carga')).toBeInTheDocument();
        await userEvent.click(screen.getByRole('button', { name: /Perezoso/ }));
        expect(screen.getByText('carga')).toBeInTheDocument();
        expect(avisos).toEqual([true, false]);
    });
    it('plano quita borde y radio del contenedor', () => {
        const { container } = render(<Detalles titulo="Plano" plano><p>x</p></Detalles>);
        expect(container.firstChild).not.toHaveClass('border');
        expect(container.firstChild).not.toHaveClass('rounded-xl');
    });
});
