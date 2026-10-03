// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CameraCapture from './CameraCapture.jsx';
import { crearError, dimensionesCaptura, periodoCaptura, traducirError } from './cameraCapture.utils.js';

// getUserMedia simulado: devuelve un flujo con una sola pista de video que se puede espiar.
function flujoFalso() {
    const pista = { stop: vi.fn(), getSettings: () => ({ deviceId: 'cam-1' }) };
    return { pista, stream: { getTracks: () => [pista], getVideoTracks: () => [pista] } };
}

function prepararNavegador(getUserMedia) {
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    Object.defineProperty(navigator, 'mediaDevices', {
        value: { getUserMedia, enumerateDevices: vi.fn().mockResolvedValue([]) },
        configurable: true,
    });
    // jsdom no implementa video ni canvas: se simulan lo mínimo para capturar un fotograma.
    HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', { value: 640, configurable: true });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', { value: 480, configurable: true });
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() }));
    HTMLCanvasElement.prototype.toBlob = vi.fn((cb) => cb(new Blob(['x'], { type: 'image/jpeg' })));
}

describe('utilidades de cámara', () => {
    it('traduce errores del navegador a código estable y texto en español', () => {
        expect(traducirError({ name: 'NotAllowedError' }).code).toBe('PERMISO_DENEGADO');
        expect(traducirError({ name: 'NotFoundError' }).code).toBe('SIN_CAMARA');
        expect(traducirError({ name: 'NotReadableError' }).code).toBe('EN_USO');
        expect(traducirError(new Error('raro')).code).toBe('DESCONOCIDO');
        expect(crearError('INSEGURO').message).toMatch(/HTTPS/);
    });

    it('reduce proporcionalmente sin ampliar y respeta el periodo mínimo de 1 s', () => {
        expect(dimensionesCaptura(2560, 1920, 1280, 960)).toEqual({ width: 1280, height: 960 });
        expect(dimensionesCaptura(640, 480, 1280, 960)).toEqual({ width: 640, height: 480 });
        expect(periodoCaptura(200)).toBe(1000);
        expect(periodoCaptura(15000)).toBe(15000);
    });
});

describe('CameraCapture', () => {
    beforeEach(() => vi.restoreAllMocks());
    afterEach(() => vi.useRealTimers());

    it('muestra el mensaje en español cuando se deniega el permiso y permite reintentar', async () => {
        const getUserMedia = vi.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' }));
        prepararNavegador(getUserMedia);
        const onError = vi.fn();
        render(<CameraCapture onCapture={vi.fn()} onError={onError} />);
        expect(await screen.findByText(/Permiso de cámara denegado/)).toBeInTheDocument();
        expect(onError).toHaveBeenCalledWith(expect.objectContaining({ code: 'PERMISO_DENEGADO' }));
        expect(screen.getByRole('button', { name: 'Reintentar' })).toBeInTheDocument();
    });

    it('avisa si el navegador no soporta getUserMedia', async () => {
        prepararNavegador(undefined);
        Object.defineProperty(navigator, 'mediaDevices', { value: {}, configurable: true });
        render(<CameraCapture onCapture={vi.fn()} />);
        expect(await screen.findByText(/no permite usar la cámara/)).toBeInTheDocument();
    });

    it('captura un JPEG al pulsar el obturador cuando la cámara está lista', async () => {
        const { stream } = flujoFalso();
        prepararNavegador(vi.fn().mockResolvedValue(stream));
        const onCapture = vi.fn();
        render(<CameraCapture onCapture={onCapture} />);
        const boton = await screen.findByRole('button', { name: 'Capturar foto' });
        await waitFor(() => expect(boton).toBeEnabled());
        await userEvent.click(boton);
        await waitFor(() => expect(onCapture).toHaveBeenCalledTimes(1));
        const [blob, meta] = onCapture.mock.calls[0];
        expect(blob).toBeInstanceOf(Blob);
        expect(blob.type).toBe('image/jpeg');
        expect(meta).toMatchObject({ width: 640, height: 480, deviceId: 'cam-1' });
    });

    it('libera las pistas de la cámara al desmontar', async () => {
        const { stream, pista } = flujoFalso();
        prepararNavegador(vi.fn().mockResolvedValue(stream));
        const { unmount } = render(<CameraCapture onCapture={vi.fn()} />);
        await screen.findByRole('button', { name: 'Capturar foto' });
        unmount();
        expect(pista.stop).toHaveBeenCalled();
    });

    it('en captura continua llama a onFrame sin botón y respeta el periodo', async () => {
        const { stream } = flujoFalso();
        prepararNavegador(vi.fn().mockResolvedValue(stream));
        const onFrame = vi.fn();
        render(<CameraCapture intervalMs={1000} onFrame={onFrame} />);
        expect(screen.queryByRole('button', { name: 'Capturar foto' })).not.toBeInTheDocument();
        await waitFor(() => expect(onFrame).toHaveBeenCalledTimes(1), { timeout: 3000 });
        expect(onFrame.mock.calls[0][0]).toBeInstanceOf(Blob);
        await act(async () => {});
    });
});
