// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/api/errors.js';

const listar = vi.fn();
const actualizar = vi.fn();
vi.mock('@/lib/api/biometria.js', () => ({ parametrosListar: (...a) => listar(...a), parametroActualizar: (...a) => actualizar(...a) }));

import ParametrosEditor from './ParametrosEditor.jsx';

const base = { tipo: 'decimal', unidad: 'score', descripcion: 'd', actualizado_por: null, fecha_actualizacion: null };
const items = [
    { ...base, clave: 'umbral_similitud', valor: '0.850', minimo: '0.500', maximo: '0.999' },
    { ...base, clave: 'tolerancia_min', tipo: 'entero', valor: '20', minimo: '2', maximo: '120', unidad: 'minutos' },
    { ...base, clave: 'limite_presente_min', tipo: 'entero', valor: '10', minimo: '1', maximo: '59', unidad: 'minutos' },
];

beforeEach(() => {
    listar.mockReset();
    actualizar.mockReset();
    listar.mockResolvedValue({ total: items.length, items });
    actualizar.mockResolvedValue({ cambio: true, advertencias: [] });
});

// La tarjeta (<li>) de un parámetro, localizada por su campo.
const tarjeta = async (nombre) => (await screen.findByLabelText(nombre)).closest('li');

describe('ParametrosEditor', () => {
    it('rechaza valores fuera de rango y deshabilita Guardar', async () => {
        const user = userEvent.setup();
        render(<ParametrosEditor />);
        const campo = await screen.findByLabelText('Umbral de similitud');
        await user.clear(campo);
        await user.type(campo, '1.5');
        expect(screen.getByText(/Fuera de rango/)).toBeInTheDocument();
        expect(within(await tarjeta('Umbral de similitud')).getByRole('button', { name: 'Guardar' })).toBeDisabled();
    });

    it('muestra aviso especial en un parametro critico y guarda al confirmar', async () => {
        const user = userEvent.setup();
        render(<ParametrosEditor />);
        const campo = await screen.findByLabelText('Umbral de similitud');
        await user.clear(campo);
        await user.type(campo, '0.9');
        await user.click(within(await tarjeta('Umbral de similitud')).getByRole('button', { name: 'Guardar' }));
        expect(await screen.findByText(/capturas siguientes/)).toBeInTheDocument();
        expect(screen.getByText(/queda en bitácora/)).toBeInTheDocument();
        expect(screen.getByText(/Se cambiará el valor de 0\.850 a 0\.9\./)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Guardar cambio' }));
        await waitFor(() => expect(actualizar).toHaveBeenCalledWith({ clave: 'umbral_similitud', valor: '0.9' }));
    });

    it('no muestra aviso critico en parametros normales y cancelar no guarda', async () => {
        const user = userEvent.setup();
        render(<ParametrosEditor />);
        const campo = await screen.findByLabelText('Tolerancia de retardo');
        await user.clear(campo);
        await user.type(campo, '25');
        await user.click(within(await tarjeta('Tolerancia de retardo')).getByRole('button', { name: 'Guardar' }));
        expect(screen.queryByText(/capturas siguientes/)).not.toBeInTheDocument();
        expect(screen.getByText(/Se cambiará el valor de 20 min a 25 min\./)).toBeInTheDocument();
        await user.click(screen.getByRole('button', { name: 'Cancelar' }));
        expect(actualizar).not.toHaveBeenCalled();
    });

    it('resume la lista y marca como crítico solo al parámetro crítico', async () => {
        render(<ParametrosEditor />);
        expect(await screen.findByText(/3 parámetros, 1 crítico/)).toBeInTheDocument();
        expect(screen.getAllByText('Crítico')).toHaveLength(1);
    });

    it('en solo lectura no hay botones de guardar ni deslizador', async () => {
        render(<ParametrosEditor soloLectura />);
        await screen.findByLabelText('Umbral de similitud');
        expect(screen.queryByRole('button', { name: 'Guardar' })).not.toBeInTheDocument();
        expect(screen.queryByRole('slider')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /valor de fábrica/ })).not.toBeInTheDocument();
    });
});

describe('ParametrosEditor: guía para teclear un valor válido', () => {
    it('agrupa los parámetros por lo que controlan y conserva todos', async () => {
        render(<ParametrosEditor />);
        await screen.findByLabelText('Umbral de similitud');
        const titulos = screen.getAllByRole('heading', { level: 2 }).map((h) => h.textContent);
        expect(titulos).toEqual(['Reconocimiento facial', 'Ventanas de asistencia']);
        const ventanas = screen.getByRole('region', { name: 'Ventanas de asistencia' });
        expect(within(ventanas).getByLabelText('Límite para marcar presente')).toBeInTheDocument();
        expect(within(ventanas).getByLabelText('Tolerancia de retardo')).toBeInTheDocument();
    });

    it('un parámetro desconocido no desaparece: va a «Otros parámetros»', async () => {
        listar.mockResolvedValue({ total: 1, items: [{ ...base, clave: 'parametro_nuevo', tipo: 'entero', valor: '1', minimo: '1', maximo: '9', unidad: 'minutos' }] });
        render(<ParametrosEditor />);
        expect(await screen.findByRole('region', { name: 'Otros parámetros' })).toBeInTheDocument();
        expect(screen.getByLabelText('parametro_nuevo')).toBeInTheDocument();
    });

    it('cada tarjeta muestra nombre legible, clave técnica, unidad, rango válido, valor de fábrica y quién lo cambió', async () => {
        render(<ParametrosEditor />);
        const t = await tarjeta('Tolerancia de retardo');
        expect(within(t).getByText('tolerancia_min')).toHaveClass('font-mono');
        expect(within(t).getAllByText('min').length).toBeGreaterThan(0);
        expect(within(t).getByText('Rango válido: de 2 a 120 min')).toBeInTheDocument();
        expect(within(t).getByText(/De fábrica:/)).toHaveTextContent('De fábrica: 20 min');
        expect(within(t).getByText('Valor inicial del sistema')).toBeInTheDocument();
        // Con el valor de fábrica ya puesto no se ofrece restablecer.
        expect(within(t).queryByRole('button', { name: /valor de fábrica/ })).not.toBeInTheDocument();
    });

    it('«Usar valor de fábrica» rellena el campo y marca el cambio; «Descartar» vuelve al valor guardado', async () => {
        const user = userEvent.setup();
        listar.mockResolvedValue({ total: 1, items: [{ ...items[1], valor: '30' }] });
        render(<ParametrosEditor />);
        const campo = await screen.findByLabelText('Tolerancia de retardo');
        const t = campo.closest('li');
        expect(within(t).queryByText('Sin guardar')).not.toBeInTheDocument();
        await user.click(within(t).getByRole('button', { name: 'Usar valor de fábrica' }));
        expect(campo).toHaveValue('20');
        expect(within(t).getByText('Sin guardar')).toBeInTheDocument();
        expect(within(t).getByRole('button', { name: 'Guardar' })).toBeEnabled();
        await user.click(within(t).getByRole('button', { name: 'Descartar' }));
        expect(campo).toHaveValue('30');
        expect(within(t).queryByText('Sin guardar')).not.toBeInTheDocument();
        expect(within(t).getByRole('button', { name: 'Guardar' })).toBeDisabled();
    });

    it('el umbral lleva deslizador sincronizado con el campo; los enteros no', async () => {
        render(<ParametrosEditor />);
        const t = await tarjeta('Umbral de similitud');
        const deslizador = within(t).getByRole('slider', { name: 'Deslizador de umbral de similitud' });
        expect(deslizador).toHaveValue('0.85');
        fireEvent.change(deslizador, { target: { value: '0.9' } });
        expect(screen.getByLabelText('Umbral de similitud')).toHaveValue('0.900');
        expect(within(t).getByText('Sin guardar')).toBeInTheDocument();
        expect(within(await tarjeta('Tolerancia de retardo')).queryByRole('slider')).not.toBeInTheDocument();
    });

    it('«0.85» no es un cambio frente a «0.850» y la coma decimal se envía con punto', async () => {
        const user = userEvent.setup();
        render(<ParametrosEditor />);
        const campo = await screen.findByLabelText('Umbral de similitud');
        const t = campo.closest('li');
        await user.clear(campo);
        await user.type(campo, '0.85');
        expect(within(t).queryByText('Sin guardar')).not.toBeInTheDocument();
        expect(within(t).getByRole('button', { name: 'Guardar' })).toBeDisabled();
        await user.clear(campo);
        await user.type(campo, '0,9');
        await user.click(within(t).getByRole('button', { name: 'Guardar' }));
        await user.click(screen.getByRole('button', { name: 'Guardar cambio' }));
        await waitFor(() => expect(actualizar).toHaveBeenCalledWith({ clave: 'umbral_similitud', valor: '0.9' }));
    });

    it('avisa de más de 3 decimales y de valores que no son número', async () => {
        const user = userEvent.setup();
        render(<ParametrosEditor />);
        const campo = await screen.findByLabelText('Umbral de similitud');
        await user.clear(campo);
        await user.type(campo, '0.8501');
        expect(screen.getByText('Usa hasta 3 decimales.')).toBeInTheDocument();
        await user.clear(campo);
        await user.type(campo, 'abc');
        expect(screen.getByText('Debe ser un número.')).toBeInTheDocument();
    });

    it('avisa cuando el límite de «presente» alcanza la tolerancia, igual que lo hará el servidor', async () => {
        const user = userEvent.setup();
        render(<ParametrosEditor />);
        const limite = await screen.findByLabelText('Límite para marcar presente');
        await user.clear(limite);
        await user.type(limite, '20');
        expect(screen.getByText('Debe ser menor que la tolerancia de retardo (20 min).')).toBeInTheDocument();
        expect(within(limite.closest('li')).getByRole('button', { name: 'Guardar' })).toBeDisabled();
        const tolerancia = screen.getByLabelText('Tolerancia de retardo');
        await user.clear(tolerancia);
        await user.type(tolerancia, '5');
        expect(screen.getByText('Debe ser mayor que el límite para marcar presente (10 min).')).toBeInTheDocument();
    });

    it('cuenta las filas con cambios sin guardar en el encabezado', async () => {
        const user = userEvent.setup();
        render(<ParametrosEditor />);
        const umbral = await screen.findByLabelText('Umbral de similitud');
        const estado = screen.getByRole('status');
        expect(estado).toBeEmptyDOMElement();
        await user.clear(umbral);
        await user.type(umbral, '0.9');
        expect(estado).toHaveTextContent('1 parámetro con cambios sin guardar');
        const tolerancia = screen.getByLabelText('Tolerancia de retardo');
        await user.clear(tolerancia);
        await user.type(tolerancia, '25');
        expect(estado).toHaveTextContent('2 parámetros con cambios sin guardar');
        await user.click(within(tolerancia.closest('li')).getByRole('button', { name: 'Descartar' }));
        expect(estado).toHaveTextContent('1 parámetro con cambios sin guardar');
        await user.click(within(umbral.closest('li')).getByRole('button', { name: 'Descartar' }));
        expect(estado).toBeEmptyDOMElement();
    });

    it('si el servidor rechaza el valor, el mensaje queda bajo el campo y el campo recupera el foco', async () => {
        actualizar.mockRejectedValue(new ApiError({ code: 'PARAMETRO_VALOR_INVALIDO', message: 'umbral_similitud debe estar entre 0.500 y 0.999.', status: 422 }));
        const user = userEvent.setup();
        render(<ParametrosEditor />);
        const campo = await screen.findByLabelText('Umbral de similitud');
        await user.clear(campo);
        await user.type(campo, '0.9');
        await user.click(within(campo.closest('li')).getByRole('button', { name: 'Guardar' }));
        await user.click(screen.getByRole('button', { name: 'Guardar cambio' }));
        expect(await screen.findByText('umbral_similitud debe estar entre 0.500 y 0.999.')).toBeInTheDocument();
        await waitFor(() => expect(campo).toHaveFocus());
        expect(campo).toHaveAttribute('aria-invalid', 'true');
        expect(campo.value).toBe('0.9');
    });
});
