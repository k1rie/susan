// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import SelectorGrupo from './SelectorGrupo.jsx';

const GRUPOS = [
    { id_grupo: 7, clave_grupo: '3A', materia_nombre: 'Cálculo', docente_nombre: 'Ana Pérez', inscritos: 30 },
    { id_grupo: 8, clave_grupo: '5C', materia_nombre: 'Finanzas', docente_nombre: 'Luis Gómez', inscritos: 24 },
];

const montar = (valor, props = {}) => {
    const alCambiar = vi.fn();
    render(<SelectorGrupo periodos={['2026-1', '2026-2']} grupos={GRUPOS} valor={valor} onCambio={alCambiar} {...props} />);
    return alCambiar;
};

describe('SelectorGrupo', () => {
    it('el grupo se busca y cada opción trae materia y clave, docente e inscritos', async () => {
        const usuario = userEvent.setup();
        const alCambiar = montar({ periodo: '2026-2', idGrupo: null });
        const campo = screen.getByRole('combobox', { name: 'Grupo' });
        expect(campo).toHaveAttribute('placeholder', 'Busca o elige un grupo');
        await usuario.click(campo);
        // Las opciones de la lista del combobox (el periodo es un <select> con sus propias opciones).
        expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(2);
        await usuario.type(campo, 'luis');
        const opcion = within(screen.getByRole('listbox')).getByRole('option');
        expect(opcion).toHaveTextContent('Finanzas · 5C');
        expect(opcion).toHaveTextContent('Luis Gómez · 24 inscritos');
        await usuario.click(opcion);
        expect(alCambiar).toHaveBeenLastCalledWith({ periodo: '2026-2', idGrupo: 8 });
    });

    it('al cambiar el periodo se limpia el grupo', async () => {
        const usuario = userEvent.setup();
        const alCambiar = montar({ periodo: '2026-2', idGrupo: 7 });
        await usuario.selectOptions(screen.getByLabelText('Periodo'), '2026-1');
        expect(alCambiar).toHaveBeenLastCalledWith({ periodo: '2026-1', idGrupo: null });
    });

    it('el grupo elegido se ve como filtro activo; «Quitar» y «Limpiar» lo dejan sin grupo y conservan el periodo', async () => {
        const usuario = userEvent.setup();
        const alCambiar = montar({ periodo: '2026-2', idGrupo: 7 });
        expect(screen.getByRole('list', { name: 'Filtros activos' })).toHaveTextContent('Grupo:Cálculo · 3A');
        await usuario.click(screen.getByRole('button', { name: 'Quitar filtro Grupo: Cálculo · 3A' }));
        expect(alCambiar).toHaveBeenLastCalledWith({ periodo: '2026-2', idGrupo: null });
        await usuario.click(screen.getByRole('button', { name: 'Limpiar' }));
        expect(alCambiar).toHaveBeenLastCalledWith({ periodo: '2026-2', idGrupo: null });
    });

    it('sin grupo no hay chips, y deshabilitado apaga el selector', () => {
        montar({ periodo: '2026-2', idGrupo: null }, { deshabilitado: true });
        expect(screen.queryByRole('list', { name: 'Filtros activos' })).toBeNull();
        expect(screen.getByRole('combobox', { name: 'Grupo' })).toBeDisabled();
    });
});
