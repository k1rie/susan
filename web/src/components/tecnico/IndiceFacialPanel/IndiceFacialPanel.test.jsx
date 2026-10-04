// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const estado = vi.fn();
const reconstruir = vi.fn();
vi.mock('@/lib/http/biometria.js', () => ({
    obtenerEstadoIndice: (...a) => estado(...a),
    reconstruirIndice: (...a) => reconstruir(...a),
    sincronizarIndice: vi.fn(),
}));

import IndiceFacialPanel from './IndiceFacialPanel.jsx';

beforeEach(() => {
    estado.mockResolvedValue({
        en_uso: { version: 'v003', dimension: 512, total_vectores: 498, fecha_construccion: null },
        plantillas: { activas: 500, indexadas: 498, pendientes: 2, obsoletas_en_indice: 0 },
        requiere_reconstruccion: true,
        pendientes_detalle: [],
        versiones: { total: 1, items: [{ id_indice: 3, version: 'v003', dimension: 512, total_vectores: 498, en_uso: true }] },
        servicio: { disponible: true }, sincronizado: true,
    });
});

describe('IndiceFacialPanel', () => {
    it('muestra la version en uso y los contadores', async () => {
        render(<IndiceFacialPanel />);
        expect(await screen.findByText('Sincronizado con el servicio')).toBeInTheDocument();
        expect(screen.getAllByText('v003').length).toBeGreaterThan(0);
    });

    it('grafica las plantillas y pliega las versiones sin quitarlas del DOM', async () => {
        render(<IndiceFacialPanel />);
        expect(await screen.findByRole('group', { name: 'Plantillas' })).toHaveAccessibleDescription(/Indexadas: 498.*Pendientes: 2/);
        expect(screen.getByText('Requiere reconstrucción')).toBeInTheDocument();
        const boton = screen.getByRole('button', { name: /Versiones del índice.*1 versión/ });
        expect(boton).toHaveAttribute('aria-expanded', 'false');
        expect(screen.getByRole('table', { hidden: true })).toBeInTheDocument();
    });

    it('el anillo de plantillas lleva el % indexado al centro y las cifras en la leyenda (pocas pendientes no dicen 0 %)', async () => {
        render(<IndiceFacialPanel />);
        const tarjeta = await screen.findByRole('group', { name: 'Plantillas' });
        expect(within(tarjeta).getByText('100 %', { selector: 'span.font-semibold' })).toBeInTheDocument();
        expect(within(tarjeta).getByText('Indexadas', { selector: 'span.text-xs' })).toBeInTheDocument();
        // Fila de leyenda = [punto de color, nombre, cifra, porcentaje].
        const leyenda = within(tarjeta).getAllByRole('listitem').map((li) => [...li.children].slice(1).map((c) => c.textContent));
        expect(leyenda).toEqual([['Indexadas', '498', '100 %'], ['Pendientes', '2', '<1 %']]);
        expect(within(tarjeta).getByText('500 activas')).toBeInTheDocument();
    });

    it('avisa de las plantillas obsoletas en el índice y lo dice también en el texto alternativo', async () => {
        estado.mockResolvedValue({
            en_uso: null,
            plantillas: { activas: 10, indexadas: 6, pendientes: 4, obsoletas_en_indice: 3 },
            requiere_reconstruccion: true, pendientes_detalle: [], versiones: { total: 0, items: [] },
            servicio: { disponible: true }, sincronizado: true,
        });
        render(<IndiceFacialPanel />);
        const tarjeta = await screen.findByRole('group', { name: 'Plantillas' });
        expect(within(tarjeta).getByText('10 activas · 3 obsoletas en el índice')).toBeInTheDocument();
        expect(tarjeta).toHaveAccessibleDescription(/Obsoletas en el índice: 3\./);
        expect(within(tarjeta).getByText('60 %', { selector: 'span.font-semibold' })).toBeInTheDocument();
    });

    it('sin plantillas activas el anillo avisa en lugar de dibujar un 0 %', async () => {
        estado.mockResolvedValue({
            en_uso: null,
            plantillas: { activas: 0, indexadas: 0, pendientes: 0 },
            requiere_reconstruccion: false, pendientes_detalle: [], versiones: { total: 0, items: [] },
            servicio: { disponible: true }, sincronizado: true,
        });
        render(<IndiceFacialPanel />);
        const tarjeta = await screen.findByRole('group', { name: 'Plantillas' });
        expect(within(tarjeta).getByText('No hay plantillas activas', { selector: 'p.flex' })).toBeInTheDocument();
        expect(tarjeta.querySelector('svg')).toBeNull();
    });

    it('los Detalles plegados dicen la unidad ("1 versión", "2 plantillas"), no un número suelto', async () => {
        estado.mockResolvedValue({
            en_uso: null,
            plantillas: { activas: 10, indexadas: 8, pendientes: 2 },
            requiere_reconstruccion: true,
            pendientes_detalle: [{ id_plantilla: 7, id_alumno: 1, fecha_registro: null }, { id_plantilla: 8, id_alumno: 2, fecha_registro: null }],
            versiones: { total: 3, items: [1, 2, 3].map((i) => ({ id_indice: i, version: `v00${i}`, dimension: 512, total_vectores: 10, en_uso: i === 3 })) },
            servicio: { disponible: true }, sincronizado: true,
        });
        render(<IndiceFacialPanel />);
        expect(await screen.findByRole('button', { name: /Plantillas pendientes de indexar.*2 plantillas/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Versiones del índice.*3 versiones/ })).toBeInTheDocument();
    });

    it('en solo lectura no hay botones de reconstruir ni sincronizar', async () => {
        render(<IndiceFacialPanel soloLectura />);
        await screen.findByText('Sincronizado con el servicio');
        expect(screen.queryByRole('button', { name: 'Reconstruir índice' })).not.toBeInTheDocument();
    });

    it('bloquea el doble clic: una sola reconstruccion', async () => {
        let fin;
        reconstruir.mockReturnValue(new Promise((r) => { fin = r; }));
        const user = userEvent.setup();
        render(<IndiceFacialPanel />);
        await user.click(await screen.findByRole('button', { name: 'Reconstruir índice' }));
        const confirmar = screen.getByRole('button', { name: 'Reconstruir' });
        await user.dblClick(confirmar);
        await user.click(confirmar);
        expect(reconstruir).toHaveBeenCalledTimes(1);
        fin({ estado: 'activada', version: 'v004', total_vectores: 500 });
        expect(await screen.findByText('Índice reconstruido y activado')).toBeInTheDocument();
        await waitFor(() => expect(reconstruir).toHaveBeenCalledTimes(1));
    });
});
