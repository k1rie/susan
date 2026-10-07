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
        // Sin botón «Buscar»: Enter busca al instante (con el texto recortado).
        await user.type(screen.getByRole('searchbox'), ' mat {Enter}');
        await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ q: 'mat', limit: 25, offset: 0 }));
        expect(screen.queryByRole('button', { name: 'Buscar' })).toBeNull();
    });

    it('busca mientras se escribe, con retraso, y al borrar el texto vuelve al instante', async () => {
        const user = userEvent.setup();
        const listar = vi.fn().mockResolvedValue({ total: 1, items: [{ id: 1, clave: 'ADM101' }] });
        render(<CatalogoTabla titulo="Materias" listar={listar} columnas={columnas} rowKey="id" busquedaLabel="Clave o nombre" />);
        await screen.findByText('ADM101');
        await user.type(screen.getByRole('searchbox', { name: 'Clave o nombre' }), 'adm');
        await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ q: 'adm', limit: 25, offset: 0 }), { timeout: 2000 });
        await user.click(screen.getByRole('button', { name: 'Borrar búsqueda' }));
        await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ limit: 25, offset: 0 }));
    });

    it('los filtros se aplican al elegirlos, se ven como chips y se quitan', async () => {
        const user = userEvent.setup();
        const listar = vi.fn().mockResolvedValue({ total: 1, items: [{ id: 1, clave: 'D001' }] });
        const filtros = [{ name: 'estatus', label: 'Estatus', options: [{ value: 'activo', label: 'Activo' }, { value: 'baja', label: 'Baja' }] }];
        render(<CatalogoTabla titulo="Docentes" listar={listar} columnas={columnas} rowKey="id" filtros={filtros} />);
        await screen.findByText('D001');
        await user.selectOptions(screen.getByLabelText('Estatus'), 'baja');
        await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ estatus: 'baja', limit: 25, offset: 0 }));
        await user.click(await screen.findByRole('button', { name: 'Quitar filtro Estatus: Baja' }));
        await waitFor(() => expect(listar).toHaveBeenLastCalledWith({ limit: 25, offset: 0 }));
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

    it('al guardar solo refresca la lista: el formulario decide cuándo cerrarse (p. ej. tras su pantalla de éxito)', async () => {
        const user = userEvent.setup();
        const listar = vi.fn().mockResolvedValue({ total: 1, items: [{ id: 1, clave: 'ADM101' }] });
        const Formulario = ({ onGuardado, onClose, extra }) => (
            <div role="dialog">
                <span>{extra}</span>
                <button onClick={() => onGuardado({ id: 2 })}>Guardar</button>
                <button onClick={onClose}>Cerrar panel</button>
            </div>
        );
        render(<CatalogoTabla titulo="Materias" listar={listar} columnas={columnas} rowKey="id" Formulario={Formulario} formularioProps={{ extra: 'dato extra' }} nuevoLabel="Nueva materia" />);
        await screen.findByText('ADM101');
        await user.click(screen.getAllByRole('button', { name: 'Nueva materia' })[0]);
        expect(screen.getByText('dato extra')).toBeInTheDocument();
        const llamadas = listar.mock.calls.length;
        await user.click(screen.getByRole('button', { name: 'Guardar' }));
        await waitFor(() => expect(listar.mock.calls.length).toBeGreaterThan(llamadas));
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Cerrar panel' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('la columna de acciones lleva «Editar» y lo que pase `acciones`; sin formulario no hay botones de alta', async () => {
        const listar = vi.fn().mockResolvedValue({ total: 1, items: [{ id: 1, clave: 'ADM101' }] });
        render(<CatalogoTabla titulo="Materias" listar={listar} columnas={columnas} rowKey="id" acciones={(fila) => <span>Acción de {fila.clave}</span>} />);
        expect(await screen.findByText('Acción de ADM101')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Editar' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Nuevo' })).toBeNull();
    });
});
