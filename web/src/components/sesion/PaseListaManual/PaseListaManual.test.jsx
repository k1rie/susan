// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import PaseListaManual from './PaseListaManual.jsx';

const api = vi.hoisted(() => ({ paseListaManual: vi.fn(), cerrarSesion: vi.fn() }));
vi.mock('@/lib/api/sesiones.js', () => api);

const sesion = { id_sesion: 115, estatus: 'abierta', modo_registro: 'manual', minuto_actual: 15, limite_presente_min: 10, tolerancia_min: 20 };
const alumno = (id, nombre, extra = {}) => ({ id_alumno: id, nombre, matricula: `E26000${id}`, inscripcion: 'activa', estado: null, origen: null, ...extra });
const data = (alumnos) => ({ sesion, alumnos });
const TRES = [alumno(1, 'Ana Pérez'), alumno(2, 'Beto Núñez', { estado: 'presente', origen: 'manual' }), alumno(3, 'Carla Ruiz')];

const grupoDe = (nombre) => screen.getByRole('radiogroup', { name: `Estado de ${nombre}` });
const marcar = async (usuario, nombre, estado) => usuario.click(within(grupoDe(nombre)).getByRole('radio', { name: estado }));

beforeEach(() => {
    api.paseListaManual.mockReset().mockResolvedValue({ procesados: 2 });
    api.cerrarSesion.mockReset().mockResolvedValue({ ausentes_creados: 1, pendientes: 0 });
});

describe('PaseListaManual', () => {
    it('cada alumno trae su segmentado Presente / Retardo / Ausente, con el estado guardado ya marcado', () => {
        render(<PaseListaManual data={data(TRES)} />);
        expect(screen.getAllByRole('radiogroup')).toHaveLength(3);
        expect(within(grupoDe('Beto Núñez')).getByRole('radio', { name: 'Presente' })).toBeChecked();
        expect(within(grupoDe('Ana Pérez')).getAllByRole('radio').map((r) => r.textContent)).toEqual(['Presente', 'Retardo', 'Ausente']);
        for (const r of within(grupoDe('Ana Pérez')).getAllByRole('radio')) expect(r).not.toBeChecked();
        expect(screen.getByRole('progressbar', { name: 'Alumnos marcados' })).toHaveAttribute('aria-valuetext', '1 de 3');
        expect(screen.getByText(/marcados/)).toHaveTextContent('1 de 3 marcados');
        // Nada que guardar todavía: la barra de acciones lo dice y «Guardar» está apagado con su motivo.
        expect(screen.queryByText(/cambios? sin guardar/)).toBeNull();
        expect(screen.getByRole('button', { name: 'Guardar' })).toBeDisabled();
    });

    it('un toque marca al alumno, sube el avance y la barra cuenta el cambio sin guardar', async () => {
        const usuario = userEvent.setup();
        render(<PaseListaManual data={data(TRES)} />);
        await marcar(usuario, 'Ana Pérez', 'Ausente');
        expect(within(grupoDe('Ana Pérez')).getByRole('radio', { name: 'Ausente' })).toBeChecked();
        expect(screen.getByRole('progressbar', { name: 'Alumnos marcados' })).toHaveAttribute('aria-valuetext', '2 de 3');
        expect(screen.getByText('1 cambio sin guardar')).toBeInTheDocument();
        await marcar(usuario, 'Carla Ruiz', 'Retardo');
        expect(screen.getByText('2 cambios sin guardar')).toBeInTheDocument();
        expect(screen.getByText('Todos marcados')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled();
    });

    it('«Todos presentes» completa solo a los que no tienen marca y «Deshacer» lo revierte', async () => {
        const usuario = userEvent.setup();
        render(<PaseListaManual data={data([...TRES, alumno(4, 'Diego Peña', { estado: 'ausente', origen: 'manual' })])} />);
        await usuario.click(screen.getByRole('button', { name: 'Todos presentes' }));
        expect(within(grupoDe('Ana Pérez')).getByRole('radio', { name: 'Presente' })).toBeChecked();
        expect(within(grupoDe('Carla Ruiz')).getByRole('radio', { name: 'Presente' })).toBeChecked();
        // El ausente que ya estaba guardado no se pisa.
        expect(within(grupoDe('Diego Peña')).getByRole('radio', { name: 'Ausente' })).toBeChecked();
        expect(screen.getByText('Se marcó a 2 alumnos como Presente.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Todos presentes' })).toBeDisabled();
        await usuario.click(screen.getByRole('button', { name: /Deshacer/ }));
        expect(within(grupoDe('Ana Pérez')).getByRole('radio', { name: 'Presente' })).not.toBeChecked();
        expect(screen.queryByText('Se marcó a 2 alumnos como Presente.')).toBeNull();
        expect(screen.queryByText(/cambios? sin guardar/)).toBeNull();
    });

    it('«Marcar restantes según la hora» usa la sugerencia; con «presente» no se ofrece porque sería lo mismo que «Todos presentes»', async () => {
        const usuario = userEvent.setup();
        const { rerender } = render(<PaseListaManual data={data(TRES)} />);
        // minuto 15, límite de presente 10 y tolerancia 20: retardo
        await usuario.click(screen.getByRole('button', { name: 'Marcar restantes según la hora' }));
        expect(within(grupoDe('Ana Pérez')).getByRole('radio', { name: 'Retardo' })).toBeChecked();
        expect(within(grupoDe('Beto Núñez')).getByRole('radio', { name: 'Presente' })).toBeChecked();
        rerender(<PaseListaManual key="otra" data={{ sesion: { ...sesion, minuto_actual: 3 }, alumnos: TRES }} />);
        expect(screen.queryByRole('button', { name: 'Marcar restantes según la hora' })).toBeNull();
        expect(screen.getByText('Sugerido a esta hora').parentElement).toHaveTextContent('Sugerido a esta hora Presente');
    });

    it('«Limpiar» vuelve a lo guardado (el servidor no sabe desmarcar) y está apagado sin cambios', async () => {
        const usuario = userEvent.setup();
        render(<PaseListaManual data={data(TRES)} />);
        expect(screen.getByRole('button', { name: 'Limpiar' })).toBeDisabled();
        await marcar(usuario, 'Ana Pérez', 'Ausente');
        await marcar(usuario, 'Beto Núñez', 'Retardo');
        await usuario.click(screen.getByRole('button', { name: 'Limpiar' }));
        expect(within(grupoDe('Ana Pérez')).getByRole('radio', { name: 'Ausente' })).not.toBeChecked();
        expect(within(grupoDe('Beto Núñez')).getByRole('radio', { name: 'Presente' })).toBeChecked();
        expect(screen.queryByText(/cambios? sin guardar/)).toBeNull();
    });

    it('busca por nombre o matrícula sin acentos y avisa cuando nadie coincide', async () => {
        const usuario = userEvent.setup();
        render(<PaseListaManual data={data(TRES)} />);
        const caja = screen.getByRole('textbox', { name: /Buscar alumno/ });
        await usuario.type(caja, 'nunez');
        expect(screen.getAllByRole('radiogroup')).toHaveLength(1);
        expect(grupoDe('Beto Núñez')).toBeInTheDocument();
        expect(screen.getByText('Mostrando 1 de 3 alumnos.')).toBeInTheDocument();
        await usuario.clear(caja);
        await usuario.type(caja, 'zzz');
        expect(screen.queryAllByRole('radiogroup')).toHaveLength(0);
        expect(screen.getByText('Ningún alumno coincide con «zzz».')).toBeInTheDocument();
        await usuario.click(screen.getByRole('button', { name: 'Borrar búsqueda' }));
        expect(screen.getAllByRole('radiogroup')).toHaveLength(3);
    });

    it('lo marcado se conserva al buscar y limpiar la búsqueda', async () => {
        const usuario = userEvent.setup();
        render(<PaseListaManual data={data(TRES)} />);
        await marcar(usuario, 'Ana Pérez', 'Retardo');
        const caja = screen.getByRole('textbox', { name: /Buscar alumno/ });
        await usuario.type(caja, 'carla');
        await usuario.clear(caja);
        expect(within(grupoDe('Ana Pérez')).getByRole('radio', { name: 'Retardo' })).toBeChecked();
    });

    it('«Ir al primero sin marcar» lleva el foco al segmentado del primer alumno pendiente', async () => {
        const usuario = userEvent.setup();
        render(<PaseListaManual data={data(TRES)} />);
        await usuario.click(screen.getByRole('button', { name: 'Ir al primero sin marcar' }));
        await waitFor(() => expect(within(grupoDe('Ana Pérez')).getAllByRole('radio')[0]).toHaveFocus());
    });

    it('«Guardar» manda solo a los alumnos con estado, con el mismo payload de siempre, y deja de avisar cambios', async () => {
        const usuario = userEvent.setup();
        const alActualizar = vi.fn();
        render(<PaseListaManual data={data(TRES)} onActualizar={alActualizar} />);
        await marcar(usuario, 'Ana Pérez', 'Ausente');
        await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
        await waitFor(() => expect(api.paseListaManual).toHaveBeenCalledTimes(1));
        expect(api.paseListaManual).toHaveBeenCalledWith({
            idSesion: 115,
            registros: [
                { id_alumno: 1, estado: 'ausente' },
                { id_alumno: 2, estado: 'presente' },
            ],
        });
        await waitFor(() => expect(screen.queryByText(/cambios? sin guardar/)).toBeNull());
        expect(alActualizar).toHaveBeenCalled();
        expect(api.cerrarSesion).not.toHaveBeenCalled();
    });

    it('si guardar falla se conserva lo marcado y se sigue avisando que hay cambios', async () => {
        const usuario = userEvent.setup();
        api.paseListaManual.mockRejectedValue(new Error('Sin conexión'));
        render(<PaseListaManual data={data(TRES)} />);
        await marcar(usuario, 'Carla Ruiz', 'Presente');
        await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
        await waitFor(() => expect(api.paseListaManual).toHaveBeenCalled());
        expect(within(grupoDe('Carla Ruiz')).getByRole('radio', { name: 'Presente' })).toBeChecked();
        expect(screen.getByText('1 cambio sin guardar')).toBeInTheDocument();
    });

    it('«Guardar y cerrar» pide confirmación con el resumen, guarda primero y luego cierra', async () => {
        const usuario = userEvent.setup();
        const alActualizar = vi.fn();
        render(<PaseListaManual data={data(TRES)} onActualizar={alActualizar} />);
        await marcar(usuario, 'Ana Pérez', 'Retardo');
        await usuario.click(screen.getByRole('button', { name: 'Guardar y cerrar sesión de clase' }));
        const dialogo = await screen.findByRole('dialog');
        expect(within(dialogo).getByText('Cerrar sesión de clase')).toBeInTheDocument();
        expect(within(dialogo).getByText('Los alumnos sin marcar quedan como ausentes.')).toBeInTheDocument();
        // Ana (retardo) y Beto (presente) están marcados; Carla queda sin registro y pasará a ausente.
        const resumen = dialogo.querySelector('dl');
        expect(resumen).toHaveTextContent(/Presentes\s*1/);
        expect(resumen).toHaveTextContent(/Retardos\s*1/);
        expect(resumen).toHaveTextContent(/Sin registro\s*1/);
        expect(resumen).toHaveTextContent('Quedarán como ausentes');
        expect(api.paseListaManual).not.toHaveBeenCalled();
        await usuario.click(within(dialogo).getByRole('button', { name: 'Cerrar sesión' }));
        await waitFor(() => expect(api.cerrarSesion).toHaveBeenCalledWith({ idSesion: 115 }));
        expect(api.paseListaManual).toHaveBeenCalledWith({
            idSesion: 115,
            registros: [
                { id_alumno: 1, estado: 'retardo' },
                { id_alumno: 2, estado: 'presente' },
            ],
        });
        expect(api.paseListaManual.mock.invocationCallOrder[0]).toBeLessThan(api.cerrarSesion.mock.invocationCallOrder[0]);
        await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    });

    it('si no se puede guardar, no se cierra la sesión y el diálogo sigue abierto', async () => {
        const usuario = userEvent.setup();
        api.paseListaManual.mockRejectedValue(new Error('Sin conexión'));
        render(<PaseListaManual data={data(TRES)} />);
        await usuario.click(screen.getByRole('button', { name: 'Guardar y cerrar sesión de clase' }));
        const dialogo = await screen.findByRole('dialog');
        await usuario.click(within(dialogo).getByRole('button', { name: 'Cerrar sesión' }));
        await waitFor(() => expect(api.paseListaManual).toHaveBeenCalled());
        expect(api.cerrarSesion).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
        await usuario.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
        expect(screen.queryByRole('dialog')).toBeNull();
    });

    it('con marcas sin guardar avisa al recargar o cerrar la pestaña (beforeunload); sin cambios no', async () => {
        const usuario = userEvent.setup();
        render(<PaseListaManual data={data(TRES)} />);
        const intento = () => {
            const e = new Event('beforeunload', { cancelable: true });
            window.dispatchEvent(e);
            return e.defaultPrevented;
        };
        expect(intento()).toBe(false);
        await marcar(usuario, 'Ana Pérez', 'Presente');
        expect(intento()).toBe(true);
    });

    it('sin alumnos inscritos lo dice y no pinta lista', () => {
        render(<PaseListaManual data={data([])} />);
        expect(screen.getByText('El grupo no tiene alumnos inscritos.')).toBeInTheDocument();
        expect(screen.queryAllByRole('radiogroup')).toHaveLength(0);
    });

    it('los alumnos dados de baja no entran en la lista ni en el avance', () => {
        render(<PaseListaManual data={data([...TRES, alumno(9, 'Zoe Baja', { inscripcion: 'baja' })])} />);
        expect(screen.getAllByRole('radiogroup')).toHaveLength(3);
        expect(screen.getByRole('progressbar', { name: 'Alumnos marcados' })).toHaveAttribute('aria-valuetext', '1 de 3');
    });
});
