// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ aulaObtener: vi.fn(), aulaGuardar: vi.fn(), camaraGuardar: vi.fn() }));
vi.mock('@/lib/api/admin.js', () => api);
vi.mock('@/lib/http/admin.js', () => ({ probarCamara: vi.fn() }));
import AulaCamaras from './AulaCamaras.jsx';

const FRENTE = { id_camara: 1, id_aula: 2, posicion: 'frente', tipo: 'navegador', direccion_ip: null, estatus: 'activa' };
const AULA = { id_aula: 2, clave: 'A-12', edificio: 'Edificio A', capacidad: 40, camaras: [FRENTE] };

beforeEach(() => {
    for (const fn of Object.values(api)) fn.mockReset();
    api.aulaObtener.mockResolvedValue(AULA);
    api.camaraGuardar.mockResolvedValue({ id_camara: 9 });
    api.aulaGuardar.mockResolvedValue({ id_aula: 2 });
});

describe('AulaCamaras', () => {
    it('muestra el aula sin repetir «Edificio», el modo del pase de lista y una tarjeta por posición', async () => {
        render(<AulaCamaras idAula={2} inscritosActivos={10} />);
        expect(await screen.findByRole('heading', { name: 'Aula A-12 · Edificio A' })).toBeTruthy();
        expect(screen.getByText('Pase de lista automático')).toBeTruthy();
        expect(screen.getByRole('form', { name: 'Cámara de frente' })).toBeTruthy();
        expect(screen.getByText('Sin cámara configurada en esta posición.')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Agregar cámara de fondo' })).toBeTruthy();
    });

    it('sin cámaras activas dice que el pase de lista será manual', async () => {
        api.aulaObtener.mockResolvedValue({ ...AULA, camaras: [{ ...FRENTE, estatus: 'mantenimiento' }] });
        render(<AulaCamaras idAula={2} />);
        expect(await screen.findByText('Pase de lista manual')).toBeTruthy();
    });

    it('«Agregar cámara» abre un panel lateral, valida la IP y crea la cámara con el payload de siempre', async () => {
        const onChanged = vi.fn();
        const user = userEvent.setup();
        render(<AulaCamaras idAula={2} onChanged={onChanged} />);
        await user.click(await screen.findByRole('button', { name: 'Agregar cámara de fondo' }));
        const panel = await screen.findByRole('dialog', { name: 'Agregar cámara de fondo' });
        expect(within(panel).getByText(/Podrás probar la conexión cuando esté guardada/)).toBeTruthy();
        expect(within(panel).getByText(/Ej\. 10\.20\.12\.2/)).toBeTruthy();
        await user.click(within(panel).getByRole('button', { name: 'Agregar cámara' }));
        expect(await within(panel).findByText(/Escribe la dirección IP de la cámara/)).toBeTruthy();
        expect(api.camaraGuardar).not.toHaveBeenCalled();
        await user.type(within(panel).getByLabelText(/Dirección IP/), '10.20.12.7');
        await user.click(within(panel).getByRole('button', { name: 'Agregar cámara' }));
        await waitFor(() => expect(api.camaraGuardar).toHaveBeenCalledWith({ datos: { id_aula: 2, posicion: 'fondo', tipo: 'ip', estatus: 'activa', direccion_ip: '10.20.12.7' } }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Agregar cámara de fondo' })).toBeNull());
        expect(onChanged).toHaveBeenCalled();
    });

    it('cancelar el panel con cambios pide confirmar y sin cambios cierra directo', async () => {
        const user = userEvent.setup();
        render(<AulaCamaras idAula={2} />);
        await user.click(await screen.findByRole('button', { name: 'Agregar cámara de fondo' }));
        let panel = await screen.findByRole('dialog', { name: 'Agregar cámara de fondo' });
        await user.click(within(panel).getByRole('button', { name: 'Cancelar' }));
        await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Agregar cámara de fondo' })).toBeNull());
        await user.click(screen.getByRole('button', { name: 'Agregar cámara de fondo' }));
        panel = await screen.findByRole('dialog', { name: 'Agregar cámara de fondo' });
        await user.type(within(panel).getByLabelText(/Dirección IP/), '10.');
        await user.click(within(panel).getByRole('button', { name: 'Cancelar' }));
        expect(await screen.findByText('¿Descartar los cambios?')).toBeTruthy();
    });

    it('suma los cambios sin guardar de las tarjetas para el contenedor', async () => {
        const onSucioChange = vi.fn();
        const user = userEvent.setup();
        render(<AulaCamaras idAula={2} inscritosActivos={10} onSucioChange={onSucioChange} />);
        await screen.findByRole('heading', { name: 'Aula A-12 · Edificio A' });
        expect(onSucioChange).toHaveBeenLastCalledWith(false);
        await user.click(screen.getByRole('button', { name: 'Agregar un lugar' }));
        await waitFor(() => expect(onSucioChange).toHaveBeenLastCalledWith(true));
        const camara = within(screen.getByRole('form', { name: 'Cámara de frente' }));
        await user.click(camara.getByRole('radio', { name: 'Inactiva' }));
        await user.click(camara.getByRole('button', { name: 'Descartar' }));
        // La capacidad sigue sucia aunque se descarte la cámara.
        expect(onSucioChange).toHaveBeenLastCalledWith(true);
    });
});
