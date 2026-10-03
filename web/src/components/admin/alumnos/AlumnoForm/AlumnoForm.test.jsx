// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import AlumnoForm from './AlumnoForm.jsx';
import { datosAlumno, validarAlumno, VALORES_INICIALES } from './alumnoForm.utils.js';

const llenar = (etiqueta, valor) => fireEvent.change(screen.getByLabelText(etiqueta), { target: { value: valor } });

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

describe('AlumnoForm', () => {
    it('no envía con campos vacíos y muestra errores', async () => {
        const onSubmit = vi.fn();
        render(<AlumnoForm onSubmit={onSubmit} submitLabel="Crear alumno" />);
        fireEvent.click(screen.getByText('Crear alumno'));
        expect(await screen.findByText('La matrícula es obligatoria.')).toBeInTheDocument();
        expect(screen.getByText('El apellido paterno es obligatorio.')).toBeInTheDocument();
        expect(onSubmit).not.toHaveBeenCalled();
    });

    it('envía apellidos y nombres separados', async () => {
        const onSubmit = vi.fn();
        render(<AlumnoForm onSubmit={onSubmit} submitLabel="Crear alumno" />);
        llenar(/Matrícula/, 'E260099');
        llenar(/Apellido paterno/, 'Soto');
        llenar(/Apellido materno/, 'Mena');
        llenar(/Nombres/, 'Carla');
        llenar(/Correo institucional/, 'e260099@unach.mx');
        fireEvent.click(screen.getByText('Crear alumno'));
        await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
        expect(onSubmit.mock.calls[0][0]).toEqual({
            datos: { matricula: 'E260099', apellido_paterno: 'Soto', apellido_materno: 'Mena', nombres: 'Carla', correo_institucional: 'e260099@unach.mx' },
            estatus: 'activo',
        });
    });
});
