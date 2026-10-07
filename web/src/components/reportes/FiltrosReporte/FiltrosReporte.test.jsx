// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import FiltrosReporte from './FiltrosReporte.jsx';
import { etiquetaGrupo, filtrosActivos, opcionesAlumno, opcionesGrupo } from './filtrosReporte.utils.js';

const GRUPOS = [
    { id_grupo: 1, clave_grupo: '3A', materia_nombre: 'Finanzas', docente_nombre: 'Ana Pérez', inscritos: 30 },
    { id_grupo: 2, clave_grupo: '5C', materia_nombre: 'Álgebra Lineal', docente_nombre: 'Luis Gómez', inscritos: 24 },
    { id_grupo: 3, clave_grupo: '3B', materia_nombre: 'Finanzas', docente_nombre: 'Rosa Díaz', inscritos: 28 },
];
const ALUMNOS = [
    { idAlumno: 11, nombreCompleto: 'Ana Núñez (E260011)' },
    { idAlumno: 12, nombreCompleto: 'Beto Peña (E260012)' },
];
const vacio = { periodo: '2026-2', idGrupo: null, idAlumno: null };

const montar = (valor = vacio, props = {}) => {
    const alCambiar = vi.fn();
    const r = render(<FiltrosReporte periodos={['2026-1', '2026-2']} grupos={GRUPOS} alumnos={ALUMNOS} valor={valor} onCambio={alCambiar} {...props} />);
    return { alCambiar, ...r };
};

describe('filtrosReporte.utils', () => {
    it('opciones de grupo: «Materia · clave» arriba y docente e inscritos debajo', () => {
        expect(etiquetaGrupo(GRUPOS[0])).toBe('Finanzas · 3A');
        expect(opcionesGrupo(GRUPOS)[0]).toEqual({ value: '1', label: 'Finanzas · 3A', description: 'Ana Pérez · 30 inscritos' });
        expect(opcionesGrupo([{ id_grupo: 9, clave_grupo: '1A', materia_nombre: 'X' }])[0].description).toBeUndefined();
        expect(opcionesGrupo(undefined)).toEqual([]);
    });
    it('opciones de alumno: nombre arriba y matrícula debajo; si no trae matrícula, el texto completo', () => {
        expect(opcionesAlumno(ALUMNOS)[0]).toEqual({ value: '11', label: 'Ana Núñez', description: 'E260011', avatar: 'Ana Núñez' });
        expect(opcionesAlumno([{ idAlumno: 5, nombreCompleto: 'Sin matrícula' }])[0]).toMatchObject({ value: '5', label: 'Sin matrícula' });
    });
    it('filtros activos: solo grupo y alumno (el periodo siempre está), y quitar el grupo quita también al alumno', () => {
        expect(filtrosActivos({ valor: vacio, grupos: GRUPOS, alumnos: ALUMNOS })).toEqual([]);
        const activos = filtrosActivos({ valor: { periodo: '2026-2', idGrupo: 1, idAlumno: 12 }, grupos: GRUPOS, alumnos: ALUMNOS });
        expect(activos.map((f) => [f.id, f.texto])).toEqual([['grupo', 'Finanzas · 3A'], ['alumno', 'Beto Peña']]);
        expect(activos[0].quitar).toEqual({ idGrupo: null, idAlumno: null });
        expect(activos[1].quitar).toEqual({ idAlumno: null });
        // Mientras llegan las listas no se inventa un nombre.
        expect(filtrosActivos({ valor: { periodo: '2026-2', idGrupo: 1, idAlumno: 12 }, grupos: [], alumnos: [] })).toEqual([]);
    });
});

describe('FiltrosReporte', () => {
    it('periodo, grupo y alumno; el alumno espera a que se elija un grupo y lo dice', () => {
        montar();
        expect(screen.getByRole('combobox', { name: 'Grupo' })).toHaveAttribute('placeholder', 'Todos los grupos');
        const alumno = screen.getByRole('combobox', { name: 'Alumno' });
        expect(alumno).toBeDisabled();
        expect(alumno).toHaveAttribute('placeholder', 'Elige un grupo primero');
        expect(screen.getByLabelText('Periodo')).toHaveValue('2026-2');
    });

    it('el grupo se busca sin acentos y cada opción trae dos líneas', async () => {
        const usuario = userEvent.setup();
        const { alCambiar } = montar();
        const campo = screen.getByRole('combobox', { name: 'Grupo' });
        await usuario.click(campo);
        // Las opciones de la lista del combobox (el periodo es un <select> con sus propias opciones).
        expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(3);
        await usuario.type(campo, 'algebra');
        const opcion = within(screen.getByRole('listbox')).getByRole('option');
        expect(opcion).toHaveTextContent('Álgebra Lineal · 5C');
        expect(opcion).toHaveTextContent('Luis Gómez · 24 inscritos');
        await usuario.click(opcion);
        expect(alCambiar).toHaveBeenLastCalledWith({ periodo: '2026-2', idGrupo: 2, idAlumno: null });
    });

    it('el alumno se busca por nombre o matrícula', async () => {
        const usuario = userEvent.setup();
        const { alCambiar } = montar({ periodo: '2026-2', idGrupo: 1, idAlumno: null });
        const campo = screen.getByRole('combobox', { name: 'Alumno' });
        expect(campo).toBeEnabled();
        await usuario.click(campo);
        await usuario.type(campo, 'e260012');
        await usuario.click(within(screen.getByRole('listbox')).getByRole('option', { name: /Beto Peña/ }));
        expect(alCambiar).toHaveBeenLastCalledWith({ periodo: '2026-2', idGrupo: 1, idAlumno: 12 });
    });

    it('al cambiar el periodo se limpian grupo y alumno', async () => {
        const usuario = userEvent.setup();
        const { alCambiar } = montar({ periodo: '2026-2', idGrupo: 1, idAlumno: 12 });
        await usuario.selectOptions(screen.getByLabelText('Periodo'), '2026-1');
        expect(alCambiar).toHaveBeenLastCalledWith({ periodo: '2026-1', idGrupo: null, idAlumno: null });
    });

    it('muestra los filtros activos con «Quitar» en cada uno y «Limpiar» para todos (el periodo se conserva)', async () => {
        const usuario = userEvent.setup();
        const { alCambiar } = montar({ periodo: '2026-2', idGrupo: 1, idAlumno: 12 });
        const lista = screen.getByRole('list', { name: 'Filtros activos' });
        expect(within(lista).getAllByRole('listitem').map((li) => li.textContent)).toEqual(['Grupo:Finanzas · 3A', 'Alumno:Beto Peña']);

        await usuario.click(screen.getByRole('button', { name: 'Quitar filtro Alumno: Beto Peña' }));
        expect(alCambiar).toHaveBeenLastCalledWith({ periodo: '2026-2', idGrupo: 1, idAlumno: null });
        await usuario.click(screen.getByRole('button', { name: 'Quitar filtro Grupo: Finanzas · 3A' }));
        expect(alCambiar).toHaveBeenLastCalledWith({ periodo: '2026-2', idGrupo: null, idAlumno: null });
        await usuario.click(screen.getByRole('button', { name: 'Limpiar' }));
        expect(alCambiar).toHaveBeenLastCalledWith({ periodo: '2026-2', idGrupo: null, idAlumno: null });
    });

    it('sin filtros opcionales no hay chips ni «Limpiar»', () => {
        montar();
        expect(screen.queryByRole('list', { name: 'Filtros activos' })).toBeNull();
        expect(screen.queryByRole('button', { name: 'Limpiar' })).toBeNull();
    });

    it('la X del propio campo también deja el filtro en «todos»', async () => {
        const usuario = userEvent.setup();
        const { alCambiar } = montar({ periodo: '2026-2', idGrupo: 1, idAlumno: null });
        expect(screen.getByRole('combobox', { name: 'Grupo' })).toHaveValue('Finanzas · 3A');
        await usuario.click(screen.getByRole('button', { name: 'Quitar selección' }));
        expect(alCambiar).toHaveBeenLastCalledWith({ periodo: '2026-2', idGrupo: null, idAlumno: null });
    });

    it('deshabilitado apaga todo, incluidos los chips; no se imprime', () => {
        montar({ periodo: '2026-2', idGrupo: 1, idAlumno: null }, { deshabilitado: true });
        expect(screen.getByRole('combobox', { name: 'Grupo' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Limpiar' })).toBeDisabled();
        expect(screen.getByRole('form', { name: 'Filtros del reporte' })).toHaveClass('print:hidden');
    });
});
