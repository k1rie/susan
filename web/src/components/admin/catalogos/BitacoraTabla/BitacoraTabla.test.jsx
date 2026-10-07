// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hoyLocal, sumarDias } from '@/lib/formularios';

const bitacoraListar = vi.hoisted(() => vi.fn());
const usuariosListar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/admin.js', () => ({ bitacoraListar: (...a) => bitacoraListar(...a), usuariosListar: (...a) => usuariosListar(...a) }));

import BitacoraTabla from './BitacoraTabla.jsx';
import { armarFiltros, ENTIDADES_BITACORA, etiquetaEntidad, FILTROS_VACIOS, hayFiltros, jsonLegible } from './bitacora.utils.js';

describe('filtros de bitácora', () => {
    it('omite los vacíos y convierte el usuario a número', () => {
        expect(armarFiltros(FILTROS_VACIOS)).toEqual({ args: {}, error: null });
        const { args } = armarFiltros({ accion: 'consulta', entidad: ' deteccion ', idUsuario: '7', desde: '2026-09-01', hasta: '2026-09-14' });
        expect(args).toEqual({ accion: 'consulta', entidad: 'deteccion', idUsuario: 7, desde: '2026-09-01', hasta: '2026-09-14' });
    });

    it('rechaza rango invertido y usuario no numérico', () => {
        expect(armarFiltros({ ...FILTROS_VACIOS, desde: '2026-09-10', hasta: '2026-09-01' }).error).toMatch(/fecha inicial/);
        expect(armarFiltros({ ...FILTROS_VACIOS, idUsuario: 'abc' }).error).toMatch(/número/);
    });

    it('formatea JSON legible', () => {
        expect(jsonLegible(null)).toBeNull();
        expect(jsonLegible({ a: 1 })).toBe('{\n  "a": 1\n}');
    });

    it('la entidad es una lista cerrada de las 18 tablas auditables, con nombre legible', () => {
        expect(ENTIDADES_BITACORA).toHaveLength(18);
        expect(etiquetaEntidad('indice_faiss')).toBe('Índice facial');
        expect(etiquetaEntidad('sesion_clase')).toBe('Sesión de clase');
        expect(etiquetaEntidad('otra')).toBe('otra');
    });

    it('sabe si hay algún filtro puesto', () => {
        expect(hayFiltros(FILTROS_VACIOS)).toBe(false);
        expect(hayFiltros({ ...FILTROS_VACIOS, accion: 'consulta' })).toBe(true);
        expect(hayFiltros({ ...FILTROS_VACIOS, entidad: '  ' })).toBe(false);
    });
});

const filas = {
    total: 1,
    items: [
        { id_bitacora: 1, usuario_correo: 'docente1@susan.local', accion: 'correccion', entidad: 'asistencia', id_registro: 40, ip_origen: '10.0.0.5', fecha_hora: '2026-09-14T07:12:00-06:00', valor_anterior: { estado: 'ausente' }, valor_nuevo: { estado: 'presente' } },
    ],
};

beforeEach(() => {
    bitacoraListar.mockReset().mockResolvedValue(filas);
    usuariosListar.mockReset().mockResolvedValue({ total: 1, items: [{ id_usuario: 7, correo: 'docente1@susan.local', rol: 'docente', nombre: 'Ortega Salinas Patricia' }] });
});

const ultimaConsulta = () => bitacoraListar.mock.calls.at(-1)[0];

describe('BitacoraTabla', () => {
    it('lista los movimientos con la entidad en lenguaje legible y sin pedir nada al abrir más que la página', async () => {
        render(<BitacoraTabla />);
        expect(await screen.findByText('Corrección')).toBeInTheDocument();
        expect(screen.getByText('Asistencia #40')).toBeInTheDocument();
        expect(ultimaConsulta()).toEqual({ limit: 25, offset: 0 });
        expect(screen.queryByRole('button', { name: 'Filtrar' })).toBeNull();
    });

    it('filtra por acción y por entidad al elegirlas, sin botón «Filtrar»', async () => {
        const user = userEvent.setup();
        render(<BitacoraTabla />);
        await screen.findByText('Corrección');
        await user.click(screen.getByRole('combobox', { name: 'Acción' }));
        await user.click(await screen.findByRole('option', { name: 'Rechazo de justificante' }));
        await waitFor(() => expect(ultimaConsulta()).toEqual({ accion: 'rechazo_justificante', limit: 25, offset: 0 }));
        await user.click(screen.getByRole('combobox', { name: 'Entidad' }));
        await user.type(screen.getByRole('combobox', { name: 'Entidad' }), 'índice');
        await user.click(await screen.findByRole('option', { name: 'Índice facial' }));
        await waitFor(() => expect(ultimaConsulta()).toEqual({ accion: 'rechazo_justificante', entidad: 'indice_faiss', limit: 25, offset: 0 }));
    });

    it('busca al usuario por correo y filtra con su id', async () => {
        const user = userEvent.setup();
        render(<BitacoraTabla />);
        await screen.findByText('Corrección');
        const caja = screen.getByRole('combobox', { name: 'Usuario' });
        await user.click(caja);
        await user.type(caja, 'docente1');
        const opcion = await screen.findByRole('option', { name: /docente1@susan\.local/ });
        expect(within(opcion).getByText('Docente · Ortega Salinas Patricia')).toBeInTheDocument();
        await user.click(opcion);
        await waitFor(() => expect(ultimaConsulta()).toEqual({ idUsuario: 7, limit: 25, offset: 0 }));
        expect(usuariosListar).toHaveBeenCalledWith({ q: 'docente1', limit: 15 });
    });

    it('los atajos del periodo («Hoy», «7 días», «30 días») fijan el rango y se aplican', async () => {
        const user = userEvent.setup();
        render(<BitacoraTabla />);
        await screen.findByText('Corrección');
        const hoy = hoyLocal();
        await user.click(await screen.findByRole('button', { name: '7 días' }));
        await waitFor(() => expect(ultimaConsulta()).toEqual({ desde: sumarDias(hoy, -6), hasta: hoy, limit: 25, offset: 0 }));
        await user.click(screen.getByRole('button', { name: '30 días' }));
        await waitFor(() => expect(ultimaConsulta()).toEqual({ desde: sumarDias(hoy, -29), hasta: hoy, limit: 25, offset: 0 }));
        await user.click(screen.getByRole('button', { name: 'Hoy' }));
        await waitFor(() => expect(ultimaConsulta()).toEqual({ desde: hoy, hasta: hoy, limit: 25, offset: 0 }));
    });

    it('un rango invertido se explica junto a las fechas y no se aplica (se conserva el último filtro válido)', async () => {
        render(<BitacoraTabla />);
        await screen.findByText('Corrección');
        fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-09-10' } });
        await waitFor(() => expect(ultimaConsulta()).toEqual({ desde: '2026-09-10', limit: 25, offset: 0 }));
        const llamadas = bitacoraListar.mock.calls.length;
        fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-09-01' } });
        // jsdom aplica min/max del campo solo como atributo: la validación cruzada es la del componente.
        expect(await screen.findByText('La fecha inicial debe ser anterior o igual a la final.')).toBeInTheDocument();
        expect(bitacoraListar.mock.calls.length).toBe(llamadas);
    });

    it('«Limpiar filtros» solo aparece con algo puesto y lo quita todo', async () => {
        const user = userEvent.setup();
        render(<BitacoraTabla />);
        await screen.findByText('Corrección');
        expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull();
        await user.click(screen.getByRole('button', { name: '7 días' }));
        await user.click(await screen.findByRole('button', { name: 'Limpiar filtros' }));
        await waitFor(() => expect(ultimaConsulta()).toEqual({ limit: 25, offset: 0 }));
        expect(screen.getByLabelText('Desde')).toHaveValue('');
        expect(screen.queryByRole('button', { name: 'Limpiar filtros' })).toBeNull();
    });
});
