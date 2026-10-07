// @vitest-environment jsdom
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import CuentaAccesoPanel from './CuentaAccesoPanel.jsx';
import useCuentaAcceso from './useCuentaAcceso.js';

const mocks = vi.hoisted(() => ({ usuariosListar: vi.fn(), crearUsuario: vi.fn() }));
vi.mock('@/lib/api/admin.js', () => ({ usuariosListar: mocks.usuariosListar }));
vi.mock('@/lib/http/admin.js', () => ({ crearUsuario: mocks.crearUsuario }));

const ALUMNO = { id_alumno: 5, matricula: 'E260005', nombre_completo: 'Soto Mena Carla', correo_institucional: 'e260005@dominio.mx', estatus: 'activo' };
const USUARIO = { id_usuario: 11, correo: 'e260005@dominio.mx', rol: 'alumno', activo: true, id_alumno: 5, id_docente: null, nombre: 'Soto Mena Carla', vinculo: 'E260005' };
const lista = (items) => ({ total: items.length, items });

beforeEach(() => {
    mocks.usuariosListar.mockReset().mockResolvedValue(lista([]));
    mocks.crearUsuario.mockReset();
});

// El panel recibe el resultado del hook (la ficha lo comparte con su resumen): se arma igual que en DetalleAlumno.
function Panel({ alumno = ALUMNO }) {
    const cuenta = useCuentaAcceso(alumno);
    return <CuentaAccesoPanel alumno={alumno} cuenta={cuenta} />;
}

describe('useCuentaAcceso', () => {
    it('busca por matrícula y se queda con la cuenta de ESTE alumno (la búsqueda trae matrículas parecidas)', async () => {
        mocks.usuariosListar.mockResolvedValue(lista([{ ...USUARIO, id_usuario: 12, id_alumno: 50, vinculo: 'E2600050' }, USUARIO]));
        const { result } = renderHook(() => useCuentaAcceso(ALUMNO));
        expect(result.current.estado).toBe('cargando');
        await waitFor(() => expect(result.current.estado).toBe('activa'));
        expect(result.current.cuenta.id_usuario).toBe(11);
        expect(mocks.usuariosListar).toHaveBeenCalledWith({ q: 'E260005', rol: 'alumno', limit: 50 });
    });

    it('estados: sin cuenta, desactivada, error y sin ficha todavía', async () => {
        const sin = renderHook(() => useCuentaAcceso(ALUMNO));
        await waitFor(() => expect(sin.result.current.estado).toBe('sin'));

        mocks.usuariosListar.mockResolvedValue(lista([{ ...USUARIO, activo: false }]));
        const inactiva = renderHook(() => useCuentaAcceso(ALUMNO));
        await waitFor(() => expect(inactiva.result.current.estado).toBe('inactiva'));

        mocks.usuariosListar.mockRejectedValue(new ApiError({ code: 'ERROR_RED', message: 'Sin red.', status: 503 }));
        const fallo = renderHook(() => useCuentaAcceso(ALUMNO));
        await waitFor(() => expect(fallo.result.current.estado).toBe('error'));

        const sinFicha = renderHook(() => useCuentaAcceso(null));
        expect(sinFicha.result.current.estado).toBe('cargando');
    });
});

describe('CuentaAccesoPanel', () => {
    it('sin cuenta: lo dice, muestra con qué correo se crea y ofrece crearla', async () => {
        render(<Panel />);
        expect(await screen.findByRole('button', { name: 'Crear cuenta de acceso' })).toBeEnabled();
        expect(screen.getByText('Sin cuenta')).toBeInTheDocument();
        expect(screen.getByText('e260005@dominio.mx')).toBeInTheDocument();
        expect(screen.getByText(/una sola vez/)).toBeInTheDocument();
    });

    it('al crearla llama a la ruta de cuentas y muestra la contraseña temporal una sola vez; luego queda como cuenta activa', async () => {
        mocks.crearUsuario.mockImplementation(async () => {
            mocks.usuariosListar.mockResolvedValue(lista([USUARIO]));
            return { id_usuario: 11, correo: 'e260005@dominio.mx', rol: 'alumno', contrasena_temporal: 'Temporal-98765' };
        });
        const user = userEvent.setup();
        render(<Panel />);
        await user.click(await screen.findByRole('button', { name: 'Crear cuenta de acceso' }));
        expect(mocks.crearUsuario).toHaveBeenCalledWith({ correo: 'e260005@dominio.mx', rol: 'alumno', idAlumno: 5 });
        const dialogo = await screen.findByRole('dialog');
        expect(within(dialogo).getByDisplayValue('Temporal-98765')).toBeInTheDocument();
        await user.click(within(dialogo).getByRole('button', { name: /Ya la copié/ }));
        await waitFor(() => expect(screen.queryByDisplayValue('Temporal-98765')).not.toBeInTheDocument());
        expect(await screen.findByText('Cuenta activa')).toBeInTheDocument();
        expect(screen.getByText('Puede iniciar sesión.')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Crear cuenta de acceso' })).not.toBeInTheDocument();
    });

    it('un fallo al crear se dice en el panel y se puede reintentar', async () => {
        mocks.crearUsuario.mockRejectedValueOnce(new ApiError({ code: 'ERROR_RED', message: 'No se pudo conectar con el servidor.', status: 503 }));
        const user = userEvent.setup();
        render(<Panel />);
        await user.click(await screen.findByRole('button', { name: 'Crear cuenta de acceso' }));
        expect(await screen.findByText('No se pudo crear la cuenta')).toBeInTheDocument();
        expect(screen.getByText('No se pudo conectar con el servidor.')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Crear cuenta de acceso' })).toBeEnabled();
    });

    it('con cuenta desactivada lo dice y manda a Usuarios para gestionarla', async () => {
        mocks.usuariosListar.mockResolvedValue(lista([{ ...USUARIO, activo: false }]));
        render(<Panel />);
        expect(await screen.findByText('Cuenta desactivada')).toBeInTheDocument();
        expect(screen.getByText(/No puede iniciar sesión hasta que se reactive/)).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Usuarios' })).toHaveAttribute('href', '/admin/usuarios');
    });

    it('si no se pudo comprobar, no ofrece crear (podría ya existir) sino reintentar', async () => {
        mocks.usuariosListar.mockRejectedValueOnce(new ApiError({ code: 'ERROR_RED', message: 'Sin red.', status: 503 }));
        const user = userEvent.setup();
        render(<Panel />);
        expect(await screen.findByText('No se pudo comprobar la cuenta')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Crear cuenta de acceso' })).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Reintentar' }));
        expect(await screen.findByRole('button', { name: 'Crear cuenta de acceso' })).toBeInTheDocument();
    });

    it('un alumno en baja no puede tener cuenta nueva: el botón queda apagado y dice por qué', async () => {
        render(<Panel alumno={{ ...ALUMNO, estatus: 'baja_temporal' }} />);
        expect(await screen.findByRole('button', { name: 'Crear cuenta de acceso' })).toBeDisabled();
        expect(screen.getByText('Solo se crea cuenta para un alumno activo.')).toBeInTheDocument();
    });
});
