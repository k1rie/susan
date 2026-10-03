// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import CatalogoTabla from './CatalogoTabla.jsx';

const columnas = [{ key: 'clave', header: 'Clave', primary: true }];

describe('CatalogoTabla', () => {
    it('lista filas y consulta con búsqueda y paginación', async () => {
        const user = userEvent.setup();
        const listar = vi.fn().mockResolvedValue({ total: 1, items: [{ id: 1, clave: 'ADM101' }] });
        render(<CatalogoTabla titulo="Materias" listar={listar} columnas={columnas} rowKey="id" />);
        expect(await screen.findByText('ADM101')).toBeInTheDocument();
        expect(listar).toHaveBeenCalledWith({ limit: 25, offset: 0 });
        await user.type(screen.getByRole('searchbox'), ' mat ');
        await user.click(screen.getByRole('button', { name: 'Buscar' }));
        await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ q: 'mat', limit: 25, offset: 0 }));
    });

    it('muestra estado vacío y error con reintento', async () => {
        const listar = vi.fn().mockResolvedValue({ total: 0, items: [] });
        const { unmount } = render(<CatalogoTabla titulo="Aulas" listar={listar} columnas={columnas} rowKey="id" vacioTitulo="Nada aquí" />);
        expect(await screen.findByText('Nada aquí')).toBeInTheDocument();
        unmount();
        const falla = vi.fn().mockRejectedValue(new Error('boom'));
        render(<CatalogoTabla titulo="Aulas" listar={falla} columnas={columnas} rowKey="id" />);
        expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('abre el formulario en alta y en edición', async () => {
        const user = userEvent.setup();
        const listar = vi.fn().mockResolvedValue({ total: 1, items: [{ id: 1, clave: 'ADM101' }] });
        const Formulario = ({ item }) => <div role="dialog">{item ? `Editando ${item.clave}` : 'Alta'}</div>;
        render(<CatalogoTabla titulo="Materias" listar={listar} columnas={columnas} rowKey="id" Formulario={Formulario} nuevoLabel="Nueva materia" />);
        await screen.findByText('ADM101');
        await user.click(screen.getAllByRole('button', { name: 'Nueva materia' })[0]);
        expect(screen.getByText('Alta')).toBeInTheDocument();
    });
});
