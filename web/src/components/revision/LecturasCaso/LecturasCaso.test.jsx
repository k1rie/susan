// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LecturasCaso from './LecturasCaso.jsx';
import { obtenerDeteccionesCaso } from '@/lib/http/revision.js';

vi.mock('@/lib/http/revision.js', () => ({ obtenerDeteccionesCaso: vi.fn() }));

const L = (id, min, score, es_valida) => ({ id_deteccion: id, marca_tiempo: `2026-09-14T13:0${min}:00Z`, minuto_sesion: min, camara_posicion: 'frente', score_similitud: score, es_valida, recorte_disponible: false });

describe('LecturasCaso', () => {
    it('con lecturas muestra el avance de válidas, la gráfica de scores con texto alternativo y una tarjeta por lectura', async () => {
        obtenerDeteccionesCaso.mockResolvedValue({ foto_registro: null, lecturas: [L(1, 1, 0.81, true), L(2, 2, 0.4, false)] });
        render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(screen.getByText('Lecturas válidas: 1/3')).toBeInTheDocument());
        expect(screen.getByRole('progressbar', { name: 'Lecturas válidas frente al mínimo' })).toHaveAttribute('aria-valuetext', '1 de 3');
        expect(screen.getByRole('group', { name: 'Score por lectura' })).toHaveAccessibleDescription(/lectura 1: 81 % \(válida\); lectura 2: 40 % \(no válida\)/);
        // La leyenda de la gráfica y la tarjeta de cada lectura dicen el estado con texto, no solo con color.
        expect(screen.getAllByText('Válida').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByText('No válida').length).toBeGreaterThanOrEqual(2);
        expect(screen.getAllByRole('listitem')).toHaveLength(2);
        expect(screen.getByText('Sin foto de registro activa')).toBeInTheDocument();
    });

    it('la lista sigue el orden cronológico y numera cada tarjeta como la gráfica, aunque el servidor entregue las válidas primero', async () => {
        // Orden del servidor: válidas primero (la lectura de las 13:03 llega antes que la de las 13:02).
        obtenerDeteccionesCaso.mockResolvedValue({ foto_registro: null, lecturas: [L(1, 1, 0.81, true), L(3, 3, 0.7, true), L(2, 2, 0.4, false)] });
        render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(screen.getByText('Lecturas válidas: 2/3')).toBeInTheDocument());
        const tarjetas = screen.getAllByRole('listitem');
        expect(tarjetas.map((t) => t.textContent.match(/Lectura (\d)/)[1])).toEqual(['1', '2', '3']);
        // La lectura 2 (13:02) es la no válida, y es la segunda tarjeta.
        expect(tarjetas[1]).toHaveTextContent('No válida');
        expect(screen.getByRole('group', { name: 'Score por lectura' })).toHaveAccessibleDescription(/lectura 2: 40 % \(no válida\)/);
    });

    it('con una sola lectura no dibuja gráfica', async () => {
        obtenerDeteccionesCaso.mockResolvedValue({ foto_registro: null, lecturas: [L(1, 1, 0.81, true)] });
        render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(screen.getByText('Lecturas válidas: 1/3')).toBeInTheDocument());
        expect(screen.queryByRole('group', { name: 'Score por lectura' })).toBeNull();
    });

    it('sin lecturas lo dice', async () => {
        obtenerDeteccionesCaso.mockResolvedValue({ foto_registro: null, lecturas: [] });
        render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(screen.getByText(/Sin lecturas del reconocimiento facial/)).toBeInTheDocument());
    });

    it('si falla la carga ofrece reintentar', async () => {
        obtenerDeteccionesCaso.mockRejectedValue(new Error('boom'));
        render(<LecturasCaso idAsistencia={5} minimoValidas={3} />);
        await waitFor(() => expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument());
    });
});
