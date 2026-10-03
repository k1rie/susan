// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/revision.js', () => ({ misJustificantes: (...a) => listar(...a) }));

import MisJustificantes from './MisJustificantes.jsx';

const just = (id, extra = {}) => ({
    id_justificante: id, materia: { nombre: 'Cálculo' }, grupo: { clave_grupo: '3A' }, fecha: '2026-09-10', fecha_registro: '2026-09-11T10:00:00',
    motivo: `Motivo ${id}`, estatus: 'pendiente', ...extra,
});

beforeEach(() => listar.mockReset());

describe('MisJustificantes', () => {
    it('sin justificantes dice que no hay, dentro de su tarjeta', async () => {
        listar.mockResolvedValue({ total: 0, items: [] });
        render(<MisJustificantes />);
        expect(await screen.findByText('Aún no has enviado justificantes.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Mis justificantes' })).toBeInTheDocument();
    });
    it('muestra materia, sesión, motivo y estatus de cada justificante', async () => {
        listar.mockResolvedValue({ total: 2, items: [just(1), just(2, { estatus: 'aprobado' })] });
        render(<MisJustificantes />);
        expect(await screen.findAllByText('Cálculo · 3A')).toHaveLength(2);
        expect(screen.getAllByText('Sesión 10/09/2026 · enviado 11/09/2026')).toHaveLength(2);
        expect(screen.getByText('Motivo 1')).toBeInTheDocument();
        expect(screen.getByText('Pendiente')).toBeInTheDocument();
        expect(screen.getByText('Aprobado')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Ver todos/ })).not.toBeInTheDocument();
    });
    it('con más de cuatro oculta el resto tras "Ver todos" (siguen en el DOM para imprimir)', async () => {
        listar.mockResolvedValue({ total: 6, items: [1, 2, 3, 4, 5, 6].map((i) => just(i)) });
        render(<MisJustificantes />);
        const boton = await screen.findByRole('button', { name: 'Ver todos (6)' });
        expect(screen.getByText('Motivo 5').closest('li')).toHaveClass('hidden', 'print:flex');
        expect(screen.getByText('Motivo 4').closest('li')).not.toHaveClass('hidden');
        await userEvent.click(boton);
        expect(screen.getByText('Motivo 5').closest('li')).not.toHaveClass('hidden');
        expect(screen.getByRole('button', { name: 'Ver menos' })).toHaveAttribute('aria-expanded', 'true');
    });
    it('con pocos justificantes el motivo se lee completo (sin recorte) y conserva su título', async () => {
        listar.mockResolvedValue({ total: 2, items: [just(1, { motivo: 'Cita médica con constancia' }), just(2)] });
        render(<MisJustificantes />);
        const motivo = await screen.findByText('Cita médica con constancia');
        expect(motivo).not.toHaveClass('line-clamp-2');
        expect(motivo).toHaveAttribute('title', 'Cita médica con constancia');
    });
    it('en listas largas el motivo se recorta en pantalla, no al imprimir ni tras "Ver todos"', async () => {
        listar.mockResolvedValue({ total: 6, items: [1, 2, 3, 4, 5, 6].map((i) => just(i)) });
        render(<MisJustificantes />);
        const boton = await screen.findByRole('button', { name: 'Ver todos (6)' });
        expect(screen.getByText('Motivo 1')).toHaveClass('line-clamp-2', 'print:line-clamp-none');
        await userEvent.click(boton);
        expect(screen.getByText('Motivo 1')).not.toHaveClass('line-clamp-2');
    });
    it('ninguna fila lleva divide-y: el borde va arriba de cada fila menos la primera (sin línea colgando)', async () => {
        listar.mockResolvedValue({ total: 6, items: [1, 2, 3, 4, 5, 6].map((i) => just(i)) });
        render(<MisJustificantes />);
        await screen.findByRole('button', { name: 'Ver todos (6)' });
        const lista = screen.getByText('Motivo 1').closest('ul');
        expect(lista.className).not.toMatch(/divide-y/);
        const filas = [...lista.querySelectorAll('li')];
        expect(filas[0]).toHaveClass('first:border-t-0');
        expect(filas.every((f) => f.classList.contains('border-t'))).toBe(true);
    });
});
