// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import NuevoAlumno from './NuevoAlumno.jsx';

const mocks = vi.hoisted(() => ({
    alumnoGuardar: vi.fn(),
    alumnosListar: vi.fn(),
    crearUsuario: vi.fn(),
    push: vi.fn(),
}));
vi.mock('@/lib/api/admin.js', () => ({ alumnoGuardar: mocks.alumnoGuardar, alumnosListar: mocks.alumnosListar }));
vi.mock('@/lib/http/admin.js', () => ({ crearUsuario: mocks.crearUsuario }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mocks.push }) }));

const CREADO = { id_alumno: 9, matricula: 'E260099', nombre_completo: 'Soto Mena Carla', correo_institucional: 'e260099@dominio.mx', estatus: 'activo', creado: true };

beforeEach(() => {
    mocks.alumnoGuardar.mockReset().mockResolvedValue(CREADO);
    mocks.alumnosListar.mockReset().mockResolvedValue({ total: 0, items: [] });
    mocks.crearUsuario.mockReset().mockResolvedValue({ id_usuario: 4, correo: 'e260099@dominio.mx', rol: 'alumno', contrasena_temporal: 'Temporal-12345' });
    mocks.push.mockReset();
});

const escribir = (user, etiqueta, texto) => user.type(screen.getByLabelText(etiqueta), texto);
const siguiente = (user) => user.click(screen.getByRole('button', { name: /^Siguiente/ }));

async function llenarIdentidad(user) {
    await escribir(user, /Matrícula/, 'e260099');
    await escribir(user, /Nombres/, 'Carla');
    await escribir(user, /Apellido paterno/, 'Soto');
    await escribir(user, /Apellido materno/, 'Mena');
}
async function llegarARevision(user, { cuenta = false } = {}) {
    await llenarIdentidad(user);
    await siguiente(user);
    await escribir(user, /Correo institucional/, 'e260099@dominio.mx');
    if (cuenta) await user.click(screen.getByRole('switch', { name: /Crear su cuenta/ }));
    await siguiente(user);
}

describe('NuevoAlumno: pasos y validación', () => {
    it('arranca en Identidad, sin selector de estatus, y no avanza con datos faltantes', async () => {
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        expect(screen.getByRole('heading', { level: 2, name: 'Identidad' })).toBeInTheDocument();
        expect(screen.getAllByText(/Paso 1 de 3/).length).toBeGreaterThan(0);
        expect(screen.queryByText(/Estatus/)).not.toBeInTheDocument();
        await siguiente(user);
        expect(screen.getByRole('heading', { level: 2, name: 'Identidad' })).toBeInTheDocument();
        expect(screen.getByText('Revisa este paso antes de continuar')).toBeInTheDocument();
        expect(screen.getAllByText('La matrícula es obligatoria.').length).toBeGreaterThan(0);
        expect(screen.getByLabelText(/Matrícula/)).toHaveFocus();
        expect(mocks.alumnoGuardar).not.toHaveBeenCalled();
    });

    it('el segundo paso pide el correo (sin autocompletarlo) y deja la cuenta como opcional', async () => {
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        await llenarIdentidad(user);
        await siguiente(user);
        expect(screen.getByRole('heading', { level: 2, name: 'Contacto y acceso' })).toBeInTheDocument();
        expect(screen.getByLabelText(/Correo institucional/)).toHaveValue('');
        expect(screen.getByRole('switch', { name: /Crear su cuenta/ })).toHaveAttribute('aria-checked', 'false');
        expect(screen.getByText('(opcional)', { selector: 'span.font-normal.text-muted-foreground' })).toBeInTheDocument();
        await siguiente(user);
        expect(screen.getByText('El correo institucional es obligatorio.', { selector: 'p' })).toBeInTheDocument();
    });
});

describe('NuevoAlumno: revisión y alta', () => {
    it('la revisión muestra los datos normalizados y «Editar» vuelve al paso exacto', async () => {
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        await llegarARevision(user);
        expect(screen.getByRole('heading', { level: 2, name: 'Revisión' })).toBeInTheDocument();
        const identidad = screen.getByRole('region', { name: 'Identidad' });
        expect(within(identidad).getByText('E260099')).toBeInTheDocument();
        expect(within(identidad).getByText('Soto')).toBeInTheDocument();
        const contacto = screen.getByRole('region', { name: 'Contacto y acceso' });
        expect(within(contacto).getByText('e260099@dominio.mx')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Crear alumno' })).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Editar Identidad' }));
        expect(screen.getByRole('heading', { level: 2, name: 'Identidad' })).toBeInTheDocument();
        expect(screen.getByLabelText(/Nombres/)).toHaveValue('Carla');
        expect(screen.getByRole('button', { name: 'Volver a la revisión' })).toBeInTheDocument();
    });

    it('crea el alumno con la misma RPC (sin estatus) y muestra la pantalla de éxito con los siguientes pasos', async () => {
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        await llegarARevision(user);
        await user.click(screen.getByRole('button', { name: 'Crear alumno' }));

        expect(await screen.findByRole('heading', { name: 'Alumno creado' })).toBeInTheDocument();
        expect(mocks.alumnoGuardar).toHaveBeenCalledTimes(1);
        expect(mocks.alumnoGuardar).toHaveBeenCalledWith({
            datos: { matricula: 'E260099', apellido_paterno: 'Soto', apellido_materno: 'Mena', nombres: 'Carla', correo_institucional: 'e260099@dominio.mx' },
        });
        expect(mocks.crearUsuario).not.toHaveBeenCalled();
        expect(screen.getByText('Soto Mena Carla (E260099) ya está activo.')).toBeInTheDocument();

        const siguientes = screen.getByRole('region', { name: 'Siguientes pasos' });
        expect(within(siguientes).getByRole('link', { name: /Registrar consentimiento/ })).toHaveAttribute('href', '/admin/alumnos/9#consentimiento');
        expect(within(siguientes).getByRole('link', { name: /Tomar plantilla facial/ })).toHaveAttribute('href', '/admin/alumnos/9#plantilla');
        expect(within(siguientes).getByRole('link', { name: /Inscribirlo en un grupo/ })).toHaveAttribute('href', '/admin/grupos');
        expect(within(siguientes).getByText('Recomendado')).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Ir a la ficha' })).toHaveAttribute('href', '/admin/alumnos/9');
    });

    it('«Crear otro alumno» vuelve a empezar con el formulario vacío', async () => {
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        await llegarARevision(user);
        await user.click(screen.getByRole('button', { name: 'Crear alumno' }));
        await user.click(await screen.findByRole('button', { name: 'Crear otro alumno' }));
        expect(screen.getByRole('heading', { level: 2, name: 'Identidad' })).toBeInTheDocument();
        expect(screen.getByLabelText(/Matrícula/)).toHaveValue('');
    });

    it('con «Crear su cuenta» llama a la ruta de cuentas y muestra la contraseña temporal una sola vez', async () => {
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        await llegarARevision(user, { cuenta: true });
        await user.click(screen.getByRole('button', { name: 'Crear alumno y su cuenta' }));

        expect(await screen.findByRole('heading', { name: 'Alumno creado' })).toBeInTheDocument();
        expect(mocks.crearUsuario).toHaveBeenCalledWith({ correo: 'e260099@dominio.mx', rol: 'alumno', idAlumno: 9 });
        const dialogo = await screen.findByRole('dialog');
        expect(within(dialogo).getByDisplayValue('Temporal-12345')).toBeInTheDocument();
        expect(screen.getByText('Cuenta de acceso creada', { selector: 'span' })).toBeInTheDocument();

        await user.click(within(dialogo).getByRole('button', { name: /Ya la copié/ }));
        await waitFor(() => expect(screen.queryByDisplayValue('Temporal-12345')).not.toBeInTheDocument());
    });

    it('si la cuenta falla, el alumno ya existe: lo dice y ofrece reintentar sin volver a crear al alumno', async () => {
        mocks.crearUsuario.mockRejectedValueOnce(new ApiError({ code: 'ERROR_RED', message: 'No se pudo conectar con el servidor.', status: 503 }));
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        await llegarARevision(user, { cuenta: true });
        await user.click(screen.getByRole('button', { name: 'Crear alumno y su cuenta' }));

        expect(await screen.findByText('El alumno se creó, pero su cuenta de acceso no')).toBeInTheDocument();
        expect(screen.getByText(/No se pudo conectar con el servidor\./)).toBeInTheDocument();
        expect(screen.queryByText(/No se pudo guardar/)).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Reintentar la cuenta/ }));
        expect(await screen.findByRole('dialog')).toBeInTheDocument();
        expect(mocks.crearUsuario).toHaveBeenCalledTimes(2);
        expect(mocks.alumnoGuardar).toHaveBeenCalledTimes(1);
        await waitFor(() => expect(screen.queryByText('El alumno se creó, pero su cuenta de acceso no')).not.toBeInTheDocument());
    });
});

describe('NuevoAlumno: errores del servidor y duplicados', () => {
    it('un DUPLICADO de la matrícula al crear regresa a Identidad con el error pegado al campo', async () => {
        mocks.alumnoGuardar.mockRejectedValueOnce(new ApiError({ code: 'DUPLICADO', message: 'Ya existe un alumno con la matrícula E260099.', status: 409 }));
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        await llegarARevision(user);
        await user.click(screen.getByRole('button', { name: 'Crear alumno' }));

        expect(await screen.findByRole('heading', { level: 2, name: 'Identidad' })).toBeInTheDocument();
        expect(await screen.findAllByText('Esta matrícula ya está registrada.')).not.toHaveLength(0);
        expect(screen.getByLabelText(/Matrícula/)).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText(/Nombres/)).toHaveValue('Carla');
        expect(screen.getByText('Corrige el dato marcado y vuelve a intentarlo.')).toBeInTheDocument();
    });

    it('un error general se muestra en la revisión y conserva todo para reintentar', async () => {
        mocks.alumnoGuardar.mockRejectedValueOnce(new ApiError({ code: 'ERROR_INTERNO', message: 'Ocurrió un error inesperado.', status: 500 }));
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        await llegarARevision(user);
        await user.click(screen.getByRole('button', { name: 'Crear alumno' }));
        expect(await screen.findByText('No se pudo completar')).toBeInTheDocument();
        expect(screen.getByText('Ocurrió un error inesperado.')).toBeInTheDocument();
        expect(screen.getByRole('heading', { level: 2, name: 'Revisión' })).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Crear alumno' }));
        expect(await screen.findByRole('heading', { name: 'Alumno creado' })).toBeInTheDocument();
    });

    it('avisa antes de la revisión que la matrícula ya existe y enlaza a su ficha', async () => {
        mocks.alumnosListar.mockResolvedValue({ total: 1, items: [{ id_alumno: 3, matricula: 'E260099', nombre_completo: 'Ramos Díaz Beatriz' }] });
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        await escribir(user, /Matrícula/, 'e260099');
        await user.tab();
        const enlace = await screen.findByRole('link', { name: /Ver la ficha de Ramos Díaz Beatriz/ }, { timeout: 2500 });
        expect(enlace).toHaveAttribute('href', '/admin/alumnos/3');
        expect(mocks.alumnosListar).toHaveBeenCalledWith({ q: 'E260099', limit: 5 });
        await escribir(user, /Nombres/, 'Carla');
        await escribir(user, /Apellido paterno/, 'Soto');
        await siguiente(user);
        expect(screen.getByRole('heading', { level: 2, name: 'Identidad' })).toBeInTheDocument();
        expect(screen.getAllByText('Esta matrícula ya está registrada.').length).toBeGreaterThan(0);
    });

    it('una matrícula libre se marca como disponible', async () => {
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        await escribir(user, /Matrícula/, 'E260101');
        await user.tab();
        expect(await screen.findByText('Matrícula disponible', {}, { timeout: 2500 })).toBeInTheDocument();
    });
});

describe('NuevoAlumno: cancelar', () => {
    it('Cancelar sin escribir nada vuelve al listado', async () => {
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(mocks.push).toHaveBeenCalledWith('/admin/alumnos');
    });

    it('con datos escritos pide confirmar antes de salir', async () => {
        const user = userEvent.setup();
        render(<NuevoAlumno />);
        await escribir(user, /Nombres/, 'Carla');
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(await screen.findByText('¿Salir sin guardar?')).toBeInTheDocument();
        expect(mocks.push).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: 'Salir' }));
        expect(mocks.push).toHaveBeenCalledWith('/admin/alumnos');
    });
});
