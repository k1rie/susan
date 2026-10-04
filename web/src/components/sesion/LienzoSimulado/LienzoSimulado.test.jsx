// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ALTO_FOTOGRAMA, ANCHO_FOTOGRAMA } from '../SimuladorCamara/simuladorCamara.utils.js';
import LienzoSimulado from './LienzoSimulado.jsx';

describe('LienzoSimulado', () => {
    it('es una imagen con descripción y del tamaño del fotograma que se envía (960 x 540)', () => {
        render(<LienzoSimulado alMontar={() => {}} descripcion="Vista previa de la cámara simulada, ciclo 1: 12 alumnos." />);
        const lienzo = screen.getByRole('img', { name: 'Vista previa de la cámara simulada, ciclo 1: 12 alumnos.' });
        expect(lienzo.tagName).toBe('CANVAS');
        expect(lienzo).toHaveAttribute('width', String(ANCHO_FOTOGRAMA));
        expect(lienzo).toHaveAttribute('height', String(ALTO_FOTOGRAMA));
        expect(ANCHO_FOTOGRAMA / ALTO_FOTOGRAMA).toBeCloseTo(16 / 9, 5);
    });

    it('entrega su elemento al ref de callback al montarse y null al desmontarse', () => {
        const alMontar = vi.fn();
        const { unmount } = render(<LienzoSimulado alMontar={alMontar} descripcion="x" />);
        expect(alMontar).toHaveBeenCalledWith(expect.any(HTMLCanvasElement));
        unmount();
        expect(alMontar.mock.calls.at(-1)[0]).toBeNull();
    });
});
