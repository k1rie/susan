// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ aulaGuardar: vi.fn() }));
vi.mock('@/lib/api/admin.js', () => api);
import { ApiError } from '@/lib/api/errors.js';
import CapacidadForm from './CapacidadForm.jsx';
import { ocupacion, validarCapacidad } from './capacidadForm.utils.js';

const AULA = { id_aula: 2, clave: 'A-12', edificio: 'A', capacidad: 40 };
const campo = () => screen.getByRole('textbox', { name: /Capacidad del aula/ });

beforeEach(() => {
    api.aulaGuardar.mockReset();
    api.aulaGuardar.mockResolvedValue({ id_aula: 2, capacidad: 45 });
});

describe('utilidades de capacidad', () => {
    it('exige un entero entre 1 y 1000 y no baja de los inscritos del grupo', () => {
        expect(validarCapacidad({ capacidad: '' }).capacidad).toMatch(/entero mayor que 0/);
        expect(validarCapacidad({ capacidad: '0' }).capacidad).toMatch(/entero mayor que 0/);
        expect(validarCapacidad({ capacidad: '2.5' }).capacidad).toMatch(/entero/);
        expect(validarCapacidad({ capacidad: '1001' }).capacidad).toMatch(/máxima es 1000/);
        expect(validarCapacidad({ capacidad: '20' }, { inscritosActivos: 24 }).capacidad).toMatch(/24 inscritos activos/);
        expect(validarCapacidad({ capacidad: '24' }, { inscritosActivos: 24 })).toEqual({});
        expect(validarCapacidad({ capacidad: '10' })).toEqual({});
    });
    it('mide la ocupación con su estado en texto', () => {
        expect(ocupacion({ inscritosActivos: 24, capacidad: 40 })).toMatchObject({ porcentaje: 60, tono: 'neutral', estado: null, texto: '24 de 40 lugares ocupados por este grupo' });
        expect(ocupacion({ inscritosActivos: 40, capacidad: 40 })).toMatchObject({ tono: 'warning', estado: 'Aula llena' });
        expect(ocupacion({ inscritosActivos: 45, capacidad: 40 })).toMatchObject({ tono: 'danger', estado: 'Sobre la capacidad', porcentaje: 100 });
        expect(ocupacion({ inscritosActivos: undefined, capacidad: 40 })).toBeNull();
    });
});

describe('CapacidadForm', () => {
    it('muestra los inscritos actuales frente a la capacidad', () => {
        render(<CapacidadForm aula={AULA} inscritosActivos={24} />);
        expect(screen.getByText('24 de 40 lugares ocupados por este grupo')).toBeTruthy();
        expect(campo()).toHaveValue('40');
        expect(screen.getByRole('button', { name: 'Guardar capacidad' })).toBeDisabled();
        expect(screen.getByText('Aún no hay cambios que guardar.')).toBeTruthy();
    });

    it('los botones − y + cambian la capacidad y el − se detiene en los inscritos', async () => {
        const user = userEvent.setup();
        render(<CapacidadForm aula={{ ...AULA, capacidad: 25 }} inscritosActivos={24} />);
        await user.click(screen.getByRole('button', { name: 'Quitar un lugar' }));
        expect(campo()).toHaveValue('24');
        expect(screen.getByRole('button', { name: 'Quitar un lugar' })).toBeDisabled();
        await user.click(screen.getByRole('button', { name: 'Agregar un lugar' }));
        expect(campo()).toHaveValue('25');
    });

    it('una capacidad menor que los inscritos se marca antes de guardar y no llega al servidor', async () => {
        const user = userEvent.setup();
        render(<CapacidadForm aula={AULA} inscritosActivos={24} />);
        await user.clear(campo());
        await user.type(campo(), '20');
        await user.tab();
        expect(await screen.findByText('Este grupo ya tiene 24 inscritos activos: la capacidad no puede ser menor.')).toBeTruthy();
        await user.click(screen.getByRole('button', { name: 'Guardar capacidad' }));
        expect(api.aulaGuardar).not.toHaveBeenCalled();
    });

    it('guarda con el payload de siempre, avisa al contenedor y ya no hay cambios', async () => {
        const onSaved = vi.fn();
        const onSucioChange = vi.fn();
        const user = userEvent.setup();
        render(<CapacidadForm aula={AULA} inscritosActivos={24} onSaved={onSaved} onSucioChange={onSucioChange} />);
        await user.clear(campo());
        await user.type(campo(), '45');
        expect(screen.getByText('1 cambio sin guardar')).toBeTruthy();
        expect(onSucioChange).toHaveBeenLastCalledWith(true);
        await user.click(screen.getByRole('button', { name: 'Guardar capacidad' }));
        await waitFor(() => expect(onSaved).toHaveBeenCalled());
        expect(api.aulaGuardar).toHaveBeenCalledWith({ datos: { id_aula: 2, clave: 'A-12', edificio: 'A', capacidad: 45 } });
        expect(onSucioChange).toHaveBeenLastCalledWith(false);
    });

    it('si el servidor rechaza por otro grupo del aula, el mensaje queda en el campo', async () => {
        api.aulaGuardar.mockRejectedValueOnce(new ApiError({ code: 'AULA_CAPACIDAD_INSUFICIENTE', message: 'Un grupo del aula tiene 38 inscritos activos; la capacidad no puede ser menor.', status: 409 }));
        const user = userEvent.setup();
        render(<CapacidadForm aula={AULA} inscritosActivos={10} />);
        await user.clear(campo());
        await user.type(campo(), '30');
        await user.click(screen.getByRole('button', { name: 'Guardar capacidad' }));
        expect(await screen.findByText(/Un grupo del aula tiene 38 inscritos activos/)).toBeTruthy();
        expect(campo()).toHaveAttribute('aria-invalid', 'true');
        expect(campo()).toHaveValue('30');
    });
});
