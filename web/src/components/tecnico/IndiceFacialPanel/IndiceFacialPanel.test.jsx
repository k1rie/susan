// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
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
