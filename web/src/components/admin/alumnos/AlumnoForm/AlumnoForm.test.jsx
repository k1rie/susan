// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';
import AlumnoForm from './AlumnoForm.jsx';
import { datosAlumno, validarAlumno, VALORES_INICIALES } from './alumnoForm.utils.js';

const llenar = (etiqueta, valor) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

const FICHA = {
    id_alumno: 7,
    matricula: 'E260099',
    apellido_paterno: 'Soto',
    apellido_materno: 'Mena',
    nombres: 'Carla',
    correo_institucional: 'e260099@dominio.mx',
    estatus: 'activo',
};

describe('validarAlumno', () => {
    it('exige matrícula, apellido paterno, nombres y correo válido', () => {
        const e = validarAlumno({ ...VALORES_INICIALES, correo_institucional: 'x' });
        expect(Object.keys(e).sort()).toEqual(['apellido_paterno', 'correo_institucional', 'matricula', 'nombres']);
        expect(e.correo_institucional).toMatch(/válido/);
    });

    it('el apellido materno es opcional y los datos van por separado', () => {
        const v = { ...VALORES_INICIALES, matricula: ' E1 ', apellido_paterno: 'Ramos', nombres: 'Ana', correo_institucional: 'A@U.MX' };
        expect(validarAlumno(v)).toEqual({});
        expect(datosAlumno(v)).toEqual({
            matricula: 'E1', apellido_paterno: 'Ramos', apellido_materno: null, nombres: 'Ana', correo_institucional: 'a@u.mx',
        });
        expect(datosAlumno(v, 7).id_alumno).toBe(7);
    });
});

describe('AlumnoForm (alta simple)', () => {
    it('no envía con campos vacíos, muestra los errores y enfoca el primero', async () => {
        const onSubmit = vi.fn();
        render(<AlumnoForm onSubmit={onSubmit} submitLabel="Crear alumno" />);
        fireEvent.click(screen.getByText('Crear alumno'));
        expect(await screen.findByText('La matrícula es obligatoria.')).toBeInTheDocument();
        expect(screen.getByText('El apellido paterno es obligatorio.')).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
        expect(screen.getByLabelText(/Matrícula/)).toHaveFocus();
    });

    it('envía apellidos y nombres separados (sin selector de estatus: el alta nace activa)', async () => {
        const onSubmit = vi.fn();
        render(<AlumnoForm onSubmit={onSubmit} submitLabel="Crear alumno" />);
        expect(screen.queryByRole('radiogroup', { name: /Estatus/ })).not.toBeInTheDocument();
        llenar(/Matrícula/, 'E260099');
        llenar(/Apellido paterno/, 'Soto');
        llenar(/Apellido materno/, 'Mena');
        llenar(/Nombres/, 'Carla');
        llenar(/Correo institucional/, 'e260099@unach.mx');
        fireEvent.click(screen.getByText('Crear alumno'));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0]).toMatchObject({
            datos: { matricula: 'E260099', apellido_paterno: 'Soto', apellido_materno: 'Mena', nombres: 'Carla', correo_institucional: 'e260099@unach.mx' },
            estatus: 'activo',
            cambioDatos: true,
            cambioEstatus: false,
        });
    });

    it('declara los límites reales de la base en cada campo', () => {
        render(<AlumnoForm submitLabel="Crear alumno" />);
        expect(screen.getByLabelText(/Matrícula/)).toHaveAttribute('maxlength', '10');
        expect(screen.getByLabelText(/Nombres/)).toHaveAttribute('maxlength', '60');
        expect(screen.getByLabelText(/Apellido paterno/)).toHaveAttribute('maxlength', '40');
        expect(screen.getByLabelText(/Apellido materno/)).toHaveAttribute('maxlength', '40');
        expect(screen.getByLabelText(/Correo institucional/)).toHaveAttribute('maxlength', '120');
    });

    it('rotula lo opcional con la palabra y no autocompleta el correo', async () => {
        const user = userEvent.setup();
        render(<AlumnoForm submitLabel="Crear alumno" />);
        expect(screen.getByText('(opcional)')).toBeInTheDocument();
        await user.type(screen.getByLabelText(/Matrícula/), 'e260099');
        await user.tab();
        expect(screen.getByLabelText(/Correo institucional/)).toHaveValue('');
    });

    it('normaliza al salir del campo: matrícula en mayúsculas y solo letras y dígitos, nombres sin espacios sobrantes, correo en minúsculas', async () => {
        const user = userEvent.setup();
        render(<AlumnoForm submitLabel="Crear alumno" />);
        await user.type(screen.getByLabelText(/Matrícula/), ' e26-00 99 ');
        await user.tab();
        expect(screen.getByLabelText(/Matrícula/)).toHaveValue('E260099');
        await user.type(screen.getByLabelText(/Nombres/), '  Ana   María ');
        await user.tab();
        expect(screen.getByLabelText(/Nombres/)).toHaveValue('Ana María');
        await user.type(screen.getByLabelText(/Correo institucional/), ' ANA@Dominio.MX ');
        await user.tab();
        expect(screen.getByLabelText(/Correo institucional/)).toHaveValue('ana@dominio.mx');
    });

    it('valida al salir del campo, no mientras se escribe', async () => {
        const user = userEvent.setup();
        render(<AlumnoForm submitLabel="Crear alumno" />);
        const correo = screen.getByLabelText(/Correo institucional/);
        await user.type(correo, 'ana');
        expect(screen.queryByText(/correo válido/)).not.toBeInTheDocument();
        await user.tab();
        expect(await screen.findByText(/Escribe un correo válido/)).toBeInTheDocument();
        await user.type(correo, '@dominio.mx');
        await waitFor(() => expect(screen.queryByText(/Escribe un correo válido/)).not.toBeInTheDocument());
    });

    it('un DUPLICADO del servidor queda pegado a la matrícula, con foco, y conserva lo escrito', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new ApiError({ code: 'DUPLICADO', message: 'Ya existe un alumno con la matrícula E260099.', status: 409 }));
        render(<AlumnoForm onSubmit={onSubmit} submitLabel="Crear alumno" />);
        llenar(/Matrícula/, 'E260099');
        llenar(/Apellido paterno/, 'Soto');
        llenar(/Nombres/, 'Carla');
        llenar(/Correo institucional/, 'e260099@unach.mx');
        fireEvent.click(screen.getByText('Crear alumno'));
        expect(await screen.findByText('Esta matrícula ya está registrada.')).toBeInTheDocument();
        expect(screen.getByLabelText(/Matrícula/)).toHaveFocus();
        expect(screen.getByLabelText(/Matrícula/)).toHaveAttribute('aria-invalid', 'true');
        expect(screen.getByLabelText(/Nombres/)).toHaveValue('Carla');
        expect(screen.queryByText('No se pudo guardar')).not.toBeInTheDocument();
        // al corregir la matrícula, el error del servidor deja de aplicar
        llenar(/Matrícula/, 'E260098');
        await waitFor(() => expect(screen.queryByText('Esta matrícula ya está registrada.')).not.toBeInTheDocument());
    });

    it('un error general se muestra junto a los botones, sin duplicarlo', async () => {
        const onSubmit = vi.fn().mockRejectedValue(new ApiError({ code: 'ERROR_RED', message: 'Sin conexión con el servidor.', status: 503 }));
        render(<AlumnoForm onSubmit={onSubmit} submitLabel="Crear alumno" />);
        llenar(/Matrícula/, 'E1');
        llenar(/Apellido paterno/, 'Soto');
        llenar(/Nombres/, 'Carla');
        llenar(/Correo institucional/, 'e1@unach.mx');
        fireEvent.click(screen.getByText('Crear alumno'));
        expect(await screen.findByText('Sin conexión con el servidor.')).toBeInTheDocument();
        expect(screen.getAllByText('Sin conexión con el servidor.')).toHaveLength(1);
        expect(screen.getByText('No se pudo guardar')).toBeInTheDocument();
    });
});

describe('AlumnoForm (edición de la ficha)', () => {
    it('agrupa los campos en secciones Identidad, Contacto y Estado', () => {
        render(<AlumnoForm alumno={FICHA} submitLabel="Guardar cambios" />);
        for (const nombre of ['Identidad', 'Contacto', 'Estado']) {
            expect(screen.getByRole('group', { name: new RegExp(nombre) })).toBeInTheDocument();
        }
        expect(screen.getByLabelText(/Matrícula/)).toHaveValue('E260099');
        expect(screen.getByRole('radiogroup', { name: 'Estatus del alumno' })).toBeInTheDocument();
    });

    it('sin cambios, guardar está apagado y dice por qué; al editar aparece «Cambios sin guardar»', async () => {
        const user = userEvent.setup();
        render(<AlumnoForm alumno={FICHA} submitLabel="Guardar cambios" />);
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
        expect(screen.getByText('Aún no hay cambios que guardar.')).toBeInTheDocument();
        await user.type(screen.getByLabelText(/Nombres/), 'ita');
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled();
        expect(screen.getByText(/1 cambio sin guardar/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Descartar' }));
        expect(screen.getByLabelText(/Nombres/)).toHaveValue('Carla');
        expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    });

    it('avisa que dar de baja da de baja sus inscripciones y manda los indicadores de cambio', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockResolvedValue(true);
        render(<AlumnoForm alumno={FICHA} onSubmit={onSubmit} submitLabel="Guardar cambios" />);
        await user.click(screen.getByRole('radio', { name: 'Baja temporal' }));
        expect(screen.getByText(/se darán de baja sus inscripciones activas/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0]).toMatchObject({ estatus: 'baja_temporal', cambioEstatus: true, cambioDatos: false });
    });

    it('reactivar avisa que no restituye las inscripciones', async () => {
        const user = userEvent.setup();
        render(<AlumnoForm alumno={{ ...FICHA, estatus: 'baja_temporal' }} submitLabel="Guardar cambios" />);
        await user.click(screen.getByRole('radio', { name: 'Activo' }));
        expect(screen.getByText(/no restituye sus inscripciones/)).toBeInTheDocument();
    });

    it('si quien llama devuelve false (canceló la confirmación) el formulario sigue sucio y sin error', async () => {
        const user = userEvent.setup();
        const onSubmit = vi.fn().mockResolvedValue(false);
        render(<AlumnoForm alumno={FICHA} onSubmit={onSubmit} submitLabel="Guardar cambios" />);
        await user.click(screen.getByRole('radio', { name: 'Egresado' }));
        await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        const barra = screen.getByText(/cambio sin guardar/);
        expect(barra).toBeInTheDocument();
        expect(screen.queryByText('No se pudo guardar')).not.toBeInTheDocument();
        expect(within(screen.getByRole('radiogroup', { name: 'Estatus del alumno' })).getByRole('radio', { name: 'Egresado' })).toBeChecked();
    });
});
