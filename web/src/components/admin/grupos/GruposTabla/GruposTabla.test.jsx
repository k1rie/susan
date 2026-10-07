// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ gruposListar: vi.fn() }));
const ahoraMock = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => api);
vi.mock('@/lib/api/plataforma.js', () => ({ ahora: (...a) => ahoraMock(...a) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
import GruposTabla from './GruposTabla.jsx';
import { opcionesPeriodo } from './gruposTabla.utils.js';

const ITEMS = [
    { id_grupo: 1, periodo: '2026-2', clave_grupo: '3A', materia_clave: 'ADM301', materia_nombre: 'Administración', docente_nombre: 'Ortega Patricia', aula_clave: 'A-12', inscritos_activos: 24, sesiones_total: 8 },
    { id_grupo: 2, periodo: '2026-1', clave_grupo: '3B', materia_clave: 'CON302', materia_nombre: 'Contabilidad', docente_nombre: 'Balderas Ernesto', aula_clave: 'A-12', inscritos_activos: 10, sesiones_total: 0 },
];

beforeEach(() => {
    api.gruposListar.mockReset();
    push.mockReset();
    ahoraMock.mockReset();
    ahoraMock.mockResolvedValue({ fecha: '2026-09-14' });
    api.gruposListar.mockResolvedValue({ total: 2, items: ITEMS });
});

describe('opcionesPeriodo', () => {
    it('junta los cercanos a hoy, el filtrado y los de la página, de más reciente a más antiguo', () => {
        expect(opcionesPeriodo({ hoy: '2026-09-14' })).toEqual(['2027-1', '2026-2', '2026-1', '2025-2', '2025-1']);
        expect(opcionesPeriodo({ hoy: '2026-09-14', actual: '2019-2', items: [{ periodo: '2024-1' }, { periodo: '2026-2' }] })).toEqual([
            '2027-1', '2026-2', '2026-1', '2025-2', '2025-1', '2024-1', '2019-2',
        ]);
    });
});

describe('GruposTabla', () => {
    it('lista los grupos con el total y sin botón «Buscar»', async () => {
        render(<GruposTabla />);
        expect(await screen.findByText('3A')).toBeTruthy();
        expect(screen.getByText('2 grupos')).toBeTruthy();
        expect(screen.queryByRole('button', { name: 'Buscar' })).toBeNull();
        expect(api.gruposListar).toHaveBeenCalledWith({ q: undefined, periodo: undefined, limit: 25, offset: 0 });
    });

    it('busca mientras se escribe (con retraso) y muestra el filtro como chip con «Limpiar»', async () => {
        const user = userEvent.setup();
        render(<GruposTabla />);
        await screen.findByText('3A');
        await user.type(screen.getByRole('searchbox', { name: 'Materia, docente o clave' }), 'conta');
        await waitFor(() => expect(api.gruposListar).toHaveBeenLastCalledWith({ q: 'conta', periodo: undefined, limit: 25, offset: 0 }), { timeout: 2000 });
        // Una sola consulta por la búsqueda completa, no una por tecla.
        expect(api.gruposListar.mock.calls.filter(([a]) => a.q).length).toBe(1);
        await user.click(screen.getByRole('button', { name: 'Limpiar' }));
        await waitFor(() => expect(api.gruposListar).toHaveBeenLastCalledWith({ q: undefined, periodo: undefined, limit: 25, offset: 0 }));
    });

    it('el periodo es un selector con los periodos cercanos y deja un chip del filtro activo', async () => {
        render(<GruposTabla />);
        await screen.findByText('3A');
        const selector = screen.getByRole('combobox', { name: 'Periodo' });
        await waitFor(() => expect(within(selector).getAllByRole('option').map((o) => o.textContent)).toContain('2027-1'));
        expect(within(selector).getAllByRole('option').map((o) => o.textContent)).toEqual(['Todos los periodos', '2027-1', '2026-2', '2026-1', '2025-2', '2025-1']);
        fireEvent.change(selector, { target: { value: '2026-2' } });
        await waitFor(() => expect(api.gruposListar).toHaveBeenLastCalledWith({ q: undefined, periodo: '2026-2', limit: 25, offset: 0 }));
        expect(screen.getByRole('button', { name: 'Quitar filtro Periodo: 2026-2' })).toBeTruthy();
    });

    it('cada fila tiene un menú de acciones que lleva a la pestaña correcta del grupo', async () => {
        const user = userEvent.setup();
        render(<GruposTabla />);
        await screen.findByText('3A');
        await user.click(screen.getByRole('button', { name: 'Acciones del grupo 3A' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Editar horario' }));
        expect(push).toHaveBeenCalledWith('/admin/grupos/1?tab=horario');
        await user.click(screen.getByRole('button', { name: 'Acciones del grupo 3B' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Inscribir alumnos' }));
        expect(push).toHaveBeenLastCalledWith('/admin/grupos/2?tab=inscripciones');
    });

    it('sin resultados dice si es por los filtros o porque aún no hay grupos', async () => {
        api.gruposListar.mockResolvedValue({ total: 0, items: [] });
        render(<GruposTabla />);
        expect(await screen.findByText('Aún no hay grupos registrados. Crea el primero.')).toBeTruthy();
    });
});
