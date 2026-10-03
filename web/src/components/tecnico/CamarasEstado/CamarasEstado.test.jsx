// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.hoisted(() => vi.fn());
const cambiar = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/biometria.js', () => ({ camarasEstado: (...a) => estado(...a), camaraCambiarEstatus: (...a) => cambiar(...a) }));

import CamarasEstado from './CamarasEstado.jsx';

const cam = (id, extra = {}) => ({
    id_camara: id, aula_clave: `A-${id}`, posicion: 'frontal', edificio: 'Edificio C', tipo: 'IP', direccion_ip: `10.0.0.${id}`,
    estatus: 'activa', ultima_captura: null, capturas_24h: 12, sesion_abierta: false, ...extra,
});

beforeEach(() => {
    estado.mockReset();
    cambiar.mockReset();
    estado.mockResolvedValue({ total: 3, items: [cam(1), cam(2, { capturas_24h: 0 }), cam(3, { estatus: 'inactiva', capturas_24h: 0 })] });
});

describe('CamarasEstado', () => {
    it('resume en contadores y en una gráfica de capturas con texto alternativo', async () => {
        const { container } = render(<CamarasEstado />);
        const resumen = await screen.findByRole('region', { name: 'Resumen de cámaras' });
        expect(within(resumen).getByText('Activas').previousElementSibling).toHaveTextContent('2');
        expect(within(resumen).getByText('Inactivas').previousElementSibling).toHaveTextContent('1');
        expect(within(resumen).getByText('Sin capturas').previousElementSibling).toHaveTextContent('1');
        expect(screen.getByRole('group', { name: 'Capturas en 24 h por cámara' })).toHaveAccessibleDescription(/A-1 · frontal: 12/);
        expect(container.querySelectorAll('[data-slot="chart"]')).toHaveLength(1);
    });
    it('a ancho de teléfono los contadores van en dos columnas (la tercera a todo el ancho) para no partir las etiquetas', async () => {
        render(<CamarasEstado />);
        const resumen = await screen.findByRole('region', { name: 'Resumen de cámaras' });
        expect(resumen).toHaveClass('grid-cols-2', 'min-[520px]:grid-cols-3');
        expect(resumen).not.toHaveClass('grid-cols-3');
        expect(within(resumen).getByText('Sin capturas').closest('div')).toHaveClass('col-span-2', 'min-[520px]:col-span-1');
    });
    it('la tarjeta es compacta: estado, última captura y capturas; el resto está plegado pero en el DOM', async () => {
        render(<CamarasEstado />);
        const tarjeta = (await screen.findByRole('heading', { name: 'Aula A-1 · frontal' })).closest('section');
        expect(within(tarjeta).getAllByText('Activa').length).toBeGreaterThan(0);
        expect(within(tarjeta).getByText('Última captura')).toBeInTheDocument();
        expect(within(tarjeta).getByText('Capturas 24 h')).toBeInTheDocument();
        const boton = within(tarjeta).getByRole('button', { name: /Más datos/ });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(within(tarjeta).getByText('10.0.0.1', { selector: 'dd' })).toBeInTheDocument();
        await userEvent.click(boton);
        expect(boton).toHaveAttribute('aria-expanded', 'true');
    });
    it('avisa de la cámara activa sin capturas, pero no de la inactiva', async () => {
        render(<CamarasEstado />);
        await screen.findByRole('heading', { name: 'Aula A-2 · frontal' });
        expect(screen.getAllByText('Sin capturas en 24 h: revise la conexión.')).toHaveLength(1);
    });
    it('cambiar el estatus pide confirmación y solo entonces llama a la base', async () => {
        cambiar.mockResolvedValue({ advertencias: [] });
        const user = userEvent.setup();
        render(<CamarasEstado />);
        const selector = await screen.findByLabelText('Estatus de la cámara A-1 frontal');
        await user.selectOptions(selector, 'mantenimiento');
        expect(cambiar).not.toHaveBeenCalled();
        await user.click(screen.getByRole('button', { name: 'Cambiar' }));
        expect(cambiar).toHaveBeenCalledWith({ idCamara: 1, estatus: 'mantenimiento' });
    });
    it('en solo lectura no hay selectores de estatus', async () => {
        render(<CamarasEstado soloLectura />);
        await screen.findByRole('heading', { name: 'Aula A-1 · frontal' });
        expect(screen.queryByLabelText(/Estatus de la cámara/)).not.toBeInTheDocument();
    });
    it('sin cámaras muestra el aviso', async () => {
        estado.mockResolvedValue({ total: 0, items: [] });
        render(<CamarasEstado />);
        expect(await screen.findByText('No hay cámaras registradas.')).toBeInTheDocument();
    });
});
