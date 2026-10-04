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

// Tarjeta (StatCard) que lleva esa etiqueta: el borde redondeado es su raíz.
const tarjetaDe = (zona, etiqueta) => within(zona).getByText(etiqueta).closest('.rounded-xl');
// La cifra final de cada tarjeta animada la leen los lectores de pantalla en el texto sr-only de CountUp (la visible puede ir a media cuenta).
const cifraFinal = (zona, etiqueta) => tarjetaDe(zona, etiqueta).querySelector('p.tabular-nums .sr-only').textContent;
const pastillaDe = (zona, etiqueta) => tarjetaDe(zona, etiqueta).querySelector('svg').parentElement;

beforeEach(() => {
    estado.mockReset();
    cambiar.mockReset();
    estado.mockResolvedValue({ total: 3, items: [cam(1), cam(2, { capturas_24h: 0 }), cam(3, { estatus: 'inactiva', capturas_24h: 0 })] });
});

describe('CamarasEstado', () => {
    it('resume en contadores y en una gráfica de capturas con texto alternativo', async () => {
        render(<CamarasEstado />);
        const resumen = await screen.findByRole('region', { name: 'Resumen de cámaras' });
        expect(cifraFinal(resumen, 'Activas')).toBe('2');
        expect(cifraFinal(resumen, 'Inactivas')).toBe('1');
        expect(cifraFinal(resumen, 'Sin capturas')).toBe('1');
        expect(screen.getByRole('group', { name: 'Capturas en 24 h por cámara' })).toHaveAccessibleDescription(/A-1 · frontal: 12/);
    });
    it('las activas se leen frente al total de cámaras (unidad «/ N») y cada contador lleva su icono decorativo', async () => {
        render(<CamarasEstado />);
        const resumen = await screen.findByRole('region', { name: 'Resumen de cámaras' });
        expect(within(tarjetaDe(resumen, 'Activas')).getByText('/ 3')).toBeInTheDocument();
        expect(within(tarjetaDe(resumen, 'Activas')).getByText('En operación')).toBeInTheDocument();
        expect(within(tarjetaDe(resumen, 'Inactivas')).queryByText(/^\//)).not.toBeInTheDocument();
        for (const nombre of ['Activas', 'Inactivas', 'Sin capturas']) {
            const svg = tarjetaDe(resumen, nombre).querySelector('svg');
            expect(svg).toHaveAttribute('aria-hidden', 'true');
            // Sin href no hay flecha: el único svg de la tarjeta es el icono de la pastilla.
            expect(tarjetaDe(resumen, nombre).querySelectorAll('svg')).toHaveLength(1);
        }
    });
    it('la pastilla dice el estado: verde con activas, ámbar con activas sin capturas y gris en lo neutro', async () => {
        render(<CamarasEstado />);
        const resumen = await screen.findByRole('region', { name: 'Resumen de cámaras' });
        expect(pastillaDe(resumen, 'Activas')).toHaveClass('bg-presente-bg', 'text-presente');
        expect(pastillaDe(resumen, 'Inactivas')).toHaveClass('bg-muted', 'text-muted-foreground');
        expect(pastillaDe(resumen, 'Sin capturas')).toHaveClass('bg-retardo-bg', 'text-retardo');
        expect(within(tarjetaDe(resumen, 'Sin capturas')).getByText('Activas, 24 h')).toHaveClass('text-retardo');
    });
    it('sin ninguna cámara activa ni sin capturas los contadores quedan neutros (no se pintan de verde ni de ámbar)', async () => {
        estado.mockResolvedValue({ total: 2, items: [cam(1, { estatus: 'inactiva' }), cam(2, { estatus: 'mantenimiento', capturas_24h: 0 })] });
        render(<CamarasEstado />);
        const resumen = await screen.findByRole('region', { name: 'Resumen de cámaras' });
        expect(cifraFinal(resumen, 'Activas')).toBe('0');
        expect(within(tarjetaDe(resumen, 'Activas')).getByText('/ 2')).toBeInTheDocument();
        for (const nombre of ['Activas', 'Sin capturas']) expect(pastillaDe(resumen, nombre)).toHaveClass('bg-muted');
        expect(cifraFinal(resumen, 'Inactivas')).toBe('2');
    });
    it('la gráfica de capturas es una fila por cámara, de más a menos capturas, con su cifra (también el 0)', async () => {
        render(<CamarasEstado />);
        const grafica = await screen.findByRole('group', { name: 'Capturas en 24 h por cámara' });
        const filas = [...grafica.querySelectorAll('[data-fila]')];
        expect(filas.map((f) => f.getAttribute('data-fila'))).toEqual(['A-1 · frontal', 'A-2 · frontal', 'A-3 · frontal']);
        expect(filas.map((f) => f.querySelector('[data-cifra]').textContent)).toEqual(['12', '0', '0']);
        // Con 3 cámaras caben todas: no aparece el pie que avisa de las omitidas.
        expect(within(grafica).queryByText(/Se muestran las/)).not.toBeInTheDocument();
    });
    it('con más de 12 cámaras la gráfica muestra las 12 con más capturas y el pie avisa', async () => {
        estado.mockResolvedValue({ total: 14, items: Array.from({ length: 14 }, (_, i) => cam(i + 1, { capturas_24h: i })) });
        render(<CamarasEstado />);
        const grafica = await screen.findByRole('group', { name: 'Capturas en 24 h por cámara' });
        const filas = [...grafica.querySelectorAll('[data-fila]')];
        expect(filas).toHaveLength(12);
        expect(filas[0]).toHaveAttribute('data-fila', 'A-14 · frontal');
        expect(within(grafica).getByText('Se muestran las 12 con más capturas; todas están abajo.')).toBeInTheDocument();
        expect(grafica).toHaveAccessibleDescription(/Otras 2 cámaras no se muestran/);
        // Las 14 tarjetas siguen abajo.
        expect(screen.getAllByRole('heading', { name: /^Aula A-/ })).toHaveLength(14);
    });
    it('con todas las cámaras en 0 captura la gráfica no se rompe: filas con su 0 y pista vacía', async () => {
        estado.mockResolvedValue({ total: 2, items: [cam(1, { capturas_24h: 0 }), cam(2, { capturas_24h: 0 })] });
        render(<CamarasEstado />);
        const grafica = await screen.findByRole('group', { name: 'Capturas en 24 h por cámara' });
        expect([...grafica.querySelectorAll('[data-cifra]')].map((c) => c.textContent)).toEqual(['0', '0']);
    });
    it('a ancho de teléfono los contadores van en dos columnas (la tercera a todo el ancho) para no partir las etiquetas', async () => {
        render(<CamarasEstado />);
        const resumen = await screen.findByRole('region', { name: 'Resumen de cámaras' });
        expect(resumen).toHaveClass('grid-cols-2', 'min-[520px]:grid-cols-3');
        expect(resumen).not.toHaveClass('grid-cols-3');
        expect(tarjetaDe(resumen, 'Sin capturas')).toHaveClass('col-span-2', 'min-[520px]:col-span-1');
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
