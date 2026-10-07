// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { createRef } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { cargarDetector } from './detectorRostros.js';
import DeteccionRostros from './DeteccionRostros.jsx';

vi.mock('./detectorRostros.js', () => ({ cargarDetector: vi.fn() }));

// <video> de jsdom con las medidas que un video real tendría ya reproduciendo.
function videoListo(ref) {
    const video = document.createElement('video');
    Object.defineProperties(video, {
        readyState: { value: 4 },
        videoWidth: { value: 640 },
        videoHeight: { value: 480 },
        clientWidth: { value: 640 },
        clientHeight: { value: 480 },
    });
    let cuadro = 0;
    Object.defineProperty(video, 'currentTime', { get: () => (cuadro += 1) });
    ref.current = video;
    return video;
}

const CARA = { boundingBox: { originX: 160, originY: 120, width: 160, height: 120 } };

describe('DeteccionRostros', () => {
    beforeEach(() => vi.clearAllMocks());

    it('carga el detector, dibuja un recuadro por rostro y avisa cuántos ve', async () => {
        const ref = createRef();
        videoListo(ref);
        cargarDetector.mockResolvedValue({ detectForVideo: vi.fn(() => ({ detections: [CARA, CARA] })) });
        const onCambio = vi.fn();
        const { container } = render(<DeteccionRostros videoRef={ref} activo espejo onCambio={onCambio} />);

        expect(onCambio).toHaveBeenLastCalledWith({ estado: 'cargando', cantidad: 0 });
        await waitFor(() => expect(container.querySelectorAll('[data-marco-rostro]')).toHaveLength(2));
        expect(onCambio).toHaveBeenLastCalledWith({ estado: 'listo', cantidad: 2 });
    });

    it('con espejo, el recuadro se voltea (rostro a la izquierda del fotograma -> a la derecha del reflejo)', async () => {
        const ref = createRef();
        videoListo(ref);
        cargarDetector.mockResolvedValue({ detectForVideo: vi.fn(() => ({ detections: [{ boundingBox: { originX: 0, originY: 0, width: 64, height: 48 } }] })) });
        const { container } = render(<DeteccionRostros videoRef={ref} activo espejo />);
        await waitFor(() => expect(container.querySelector('[data-marco-rostro]')).not.toBeNull());
        const x = Number.parseFloat(container.querySelector('[data-marco-rostro]').style.transform.match(/translate\(([-\d.]+)%/)[1]);
        expect(x).toBeGreaterThan(50);
    });

    it('conserva el recuadro un instante cuando el detector pierde el rostro (no parpadea) y luego lo quita', async () => {
        const ref = createRef();
        videoListo(ref);
        const detectar = vi.fn().mockReturnValueOnce({ detections: [CARA] }).mockReturnValue({ detections: [] });
        cargarDetector.mockResolvedValue({ detectForVideo: detectar });
        const { container } = render(<DeteccionRostros videoRef={ref} activo />);
        await waitFor(() => expect(container.querySelectorAll('[data-marco-rostro]')).toHaveLength(1));
        // El siguiente ciclo ya no ve nada, pero dentro de la retención el recuadro sigue.
        await waitFor(() => expect(detectar.mock.calls.length).toBeGreaterThan(1));
        expect(container.querySelectorAll('[data-marco-rostro]')).toHaveLength(1);
        await waitFor(() => expect(container.querySelectorAll('[data-marco-rostro]')).toHaveLength(0), { timeout: 2000 });
    });

    it('si el detector no carga (sin WASM, sin red) queda «no-disponible» y la cámara sigue igual', async () => {
        const ref = createRef();
        videoListo(ref);
        cargarDetector.mockRejectedValue(new Error('sin wasm'));
        const onCambio = vi.fn();
        const { container } = render(<DeteccionRostros videoRef={ref} activo onCambio={onCambio} />);
        await waitFor(() => expect(onCambio).toHaveBeenLastCalledWith({ estado: 'no-disponible', cantidad: 0 }));
        expect(container.querySelectorAll('[data-marco-rostro]')).toHaveLength(0);
    });

    it('tras varios fallos seguidos al detectar se da por no disponible y deja de intentar', async () => {
        const ref = createRef();
        videoListo(ref);
        const detectar = vi.fn(() => {
            throw new Error('WebGL perdido');
        });
        cargarDetector.mockResolvedValue({ detectForVideo: detectar });
        const onCambio = vi.fn();
        render(<DeteccionRostros videoRef={ref} activo onCambio={onCambio} />);
        await waitFor(() => expect(onCambio).toHaveBeenLastCalledWith({ estado: 'no-disponible', cantidad: 0 }), { timeout: 3000 });
        const llamadas = detectar.mock.calls.length;
        await new Promise((r) => setTimeout(r, 300));
        expect(detectar.mock.calls.length).toBe(llamadas);
    });

    it('con la cámara apagada no carga el detector y se reporta «inactivo»', () => {
        const ref = createRef();
        videoListo(ref);
        const onCambio = vi.fn();
        render(<DeteccionRostros videoRef={ref} activo={false} onCambio={onCambio} />);
        expect(cargarDetector).not.toHaveBeenCalled();
        expect(onCambio).toHaveBeenLastCalledWith({ estado: 'inactivo', cantidad: 0 });
    });
});
