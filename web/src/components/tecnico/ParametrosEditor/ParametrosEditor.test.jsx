// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const listar = vi.fn();
const actualizar = vi.fn();
vi.mock('@/lib/api/biometria.js', () => ({ parametrosListar: (...a) => listar(...a), parametroActualizar: (...a) => actualizar(...a) }));

import ParametrosEditor from './ParametrosEditor.jsx';

const base = { tipo: 'decimal', unidad: 'score', descripcion: 'd', actualizado_por: null, fecha_actualizacion: null };
const items = [
    { ...base, clave: 'umbral_similitud', valor: '0.850', minimo: '0.500', maximo: '0.999' },
    { ...base, clave: 'tolerancia_min', tipo: 'entero', valor: '20', minimo: '0', maximo: '60', unidad: 'min' },
];

beforeEach(() => {
    listar.mockResolvedValue({ total: 2, items });
    actualizar.mockResolvedValue({ cambio: true, advertencias: [] });
});

describe('ParametrosEditor', () => {
    it('rechaza valores fuera de rango y deshabilita Guardar', async () => {
        const user = userEvent.setup();
        render(<ParametrosEditor />);
        const campo = await screen.findByLabelText('umbral_similitud');
        await user.clear(campo);
        await user.type(campo, '1.5');
        expect(screen.getByText(/Fuera de rango/)).toBeInTheDocument();
        expect(screen.getAllByRole('button', { name: 'Guardar' })[0]).toBeDisabled();
    });

    it('muestra aviso especial en un parametro critico y guarda al confirmar', async () => {
        const user = userEvent.setup();
        render(<ParametrosEditor />);
        const campo = await screen.findByLabelText('umbral_similitud');
        await user.clear(campo);
        await user.type(campo, '0.9');
        await user.click(screen.getAllByRole('button', { name: 'Guardar' })[0]);
        expect(await screen.findByText(/capturas siguientes/)).toBeInTheDocument();
        expect(screen.getByText(/queda en bitácora/)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Guardar cambio' }));
        await waitFor(() => expect(actualizar).toHaveBeenCalledWith({ clave: 'umbral_similitud', valor: '0.9' }));
    });

    it('no muestra aviso critico en parametros normales y cancelar no guarda', async () => {
        const user = userEvent.setup();
        render(<ParametrosEditor />);
        const campo = await screen.findByLabelText('tolerancia_min');
        await user.clear(campo);
        await user.type(campo, '25');
        await user.click(screen.getAllByRole('button', { name: 'Guardar' })[1]);
        expect(screen.queryByText(/capturas siguientes/)).not.toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(actualizar).not.toHaveBeenCalled();
    });

    it('en solo lectura no hay botones de guardar', async () => {
        render(<ParametrosEditor soloLectura />);
        await screen.findByLabelText('umbral_similitud');
        expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
    });
});
