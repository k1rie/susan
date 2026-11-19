// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => ({ aulasListar: (...a) => listar(...a), aulaGuardar: vi.fn() }));
vi.mock('next/link', () => ({ default: ({ href, children, ...r }) => <a href={href} {...r}>{children}</a> }));

import ListadoAulas from './ListadoAulas.jsx';

beforeEach(() => {
    listar.mockReset();
});

describe('ListadoAulas', () => {
    it('un laboratorio lleva la insignia «Laboratorio» con texto y un aula no', async () => {
        listar.mockResolvedValue({
            total: 2,
            items: [
                { id_aula: 1, clave: 'A-12', edificio: 'Edificio A', capacidad: 40, tipo: 'aula', camaras_activas: 1, camaras_total: 2 },
                { id_aula: 3, clave: 'LAB-1', edificio: 'Edificio C', capacidad: 30, tipo: 'laboratorio', camaras_activas: 0, camaras_total: 0 },
            ],
        });
        render(<ListadoAulas />);
        const filaLab = (await screen.findByText('LAB-1')).closest('tr');
        expect(within(filaLab).getByText('Laboratorio')).toBeInTheDocument();
        const filaAula = screen.getByText('A-12').closest('tr');
        expect(within(filaAula).queryByText('Laboratorio')).toBeNull();
        expect(screen.getAllByText('Laboratorio')).toHaveLength(1);
    });

    it('un registro sin tipo (respuesta anterior) se muestra como aula, sin insignia', async () => {
        listar.mockResolvedValue({ total: 1, items: [{ id_aula: 1, clave: 'A-12', edificio: 'Edificio A', capacidad: 40 }] });
        render(<ListadoAulas />);
        await screen.findByText('A-12');
        expect(screen.queryByText('Laboratorio')).toBeNull();
    });
});
