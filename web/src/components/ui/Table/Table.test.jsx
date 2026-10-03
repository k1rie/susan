// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Table from './Table.jsx';

const columns = [
    { key: 'nombre', header: 'Nombre', primary: true },
    { key: 'edad', header: 'Edad', render: (r) => `${r.edad} años` },
];

describe('Table', () => {
    it('muestra el mensaje de vacío', () => {
        render(<Table columns={columns} rows={[]} emptyMessage="Nada por aquí" />);
        expect(screen.getByText('Nada por aquí')).toBeInTheDocument();
        expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    });

    it('renderiza filas con render personalizado y rowKey', () => {
        render(<Table columns={columns} rows={[{ id: 1, nombre: 'Ana', edad: 20 }]} />);
        expect(screen.getByText('Ana')).toBeInTheDocument();
        expect(screen.getByText('20 años')).toBeInTheDocument();
    });

    it('fila enfocable activa onRowClick con Enter', async () => {
        const user = userEvent.setup();
        const onRowClick = vi.fn();
        render(<Table columns={columns} rows={[{ id: 1, nombre: 'Ana', edad: 20 }]} onRowClick={onRowClick} />);
        const fila = screen.getByText('Ana').closest('tr');
        fila.focus();
        await user.keyboard('{Enter}');
        expect(onRowClick).toHaveBeenCalledWith({ id: 1, nombre: 'Ana', edad: 20 });
    });

    it('con loading y sin filas muestra spinner en vez de vacío', () => {
        render(<Table columns={columns} rows={[]} loading />);
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.queryByText('Sin resultados')).toBeNull();
    });
});
