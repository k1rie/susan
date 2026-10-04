// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SubidaFotosPlantilla from './SubidaFotosPlantilla.jsx';
import { dimensionesNormalizadas, MAX_ORIGEN_BYTES, normalizarFoto, ranurasLista, textoCupo, validarArchivoFoto } from './subidaFotos.utils.js';

const jpg = (nombre, bytes = 10) => new File([new Uint8Array(bytes)], nombre, { type: 'image/jpeg' });
const tomaDe = (id, extra = {}) => ({ id, origen: 'archivo', paso: null, blob: new Blob(['x']), nombre: `f${id}.jpg`, estado: 'aceptada', ...extra });

// Lienzo y decodificador simulados: jsdom no implementa canvas ni createImageBitmap.
function simularNavegador({ ancho = 4000, alto = 3000, fallarLienzo = false } = {}) {
    const dibujos = [];
    globalThis.createImageBitmap = vi.fn(async () => ({ width: ancho, height: alto, close: vi.fn() }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function contexto() {
        return { drawImage: (...a) => dibujos.push({ lienzo: this, a }) };
    });
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((cb, tipo, calidad) => {
        cb(fallarLienzo ? null : Object.assign(new Blob(['jpeg'], { type: tipo }), { calidad }));
    });
    return dibujos;
}

afterEach(() => {
    delete globalThis.createImageBitmap;
});

describe('utils de subida', () => {
    it('dimensionesNormalizadas: 1280x960 horizontal, 960x1280 vertical y nunca amplía', () => {
        expect(dimensionesNormalizadas(4000, 3000)).toEqual({ ancho: 1280, alto: 960 });
        expect(dimensionesNormalizadas(3000, 4000)).toEqual({ ancho: 960, alto: 1280 });
        expect(dimensionesNormalizadas(800, 600)).toEqual({ ancho: 800, alto: 600 });
        expect(dimensionesNormalizadas(4000, 1000)).toEqual({ ancho: 1280, alto: 320 });
    });

    it('validarArchivoFoto: solo JPG y hasta 15 MB', () => {
        expect(validarArchivoFoto(jpg('a.jpg'))).toBeNull();
        expect(validarArchivoFoto(new File(['x'], 'a.png', { type: 'image/png' }))).toBe('«a.png» no es JPG.');
        expect(validarArchivoFoto(new File(['x'], 'sin-tipo.jpeg', { type: '' }))).toBeNull();
        const grande = jpg('g.jpg');
        Object.defineProperty(grande, 'size', { value: MAX_ORIGEN_BYTES + 1 });
        expect(validarArchivoFoto(grande)).toBe('«g.jpg» pesa más de 15 MB.');
    });

    it('textoCupo concuerda en número', () => {
        expect(textoCupo(1, 8)).toBe('Solo cabe 1 foto más (máximo 8).');
        expect(textoCupo(0, 8)).toBe('Solo caben 0 fotos más (máximo 8).');
        expect(textoCupo(3, 8)).toBe('Solo caben 3 fotos más (máximo 8).');
    });

    it('ranurasLista numera por posición, sin ranuras vacías', () => {
        const r = ranurasLista([tomaDe(4), tomaDe(9)], { 9: 'De frente' });
        expect(r.map((x) => [x.numero, x.titulo, x.accion])).toEqual([[1, 'f4.jpg', 'quitar'], [2, 'De frente', 'quitar']]);
    });

    it('normalizarFoto re-codifica a JPEG calidad 0.9 en 1280x960', async () => {
        const dibujos = simularNavegador();
        const blob = await normalizarFoto(jpg('a.jpg'));
        expect(blob.type).toBe('image/jpeg');
        expect(blob.calidad).toBe(0.9);
        expect(dibujos[0].lienzo.width).toBe(1280);
        expect(dibujos[0].lienzo.height).toBe(960);
        expect(globalThis.createImageBitmap).toHaveBeenCalledWith(expect.anything(), { imageOrientation: 'from-image' });
    });

    it('normalizarFoto: sin createImageBitmap usa <img>', async () => {
        const dibujos = simularNavegador();
        delete globalThis.createImageBitmap;
        globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
        globalThis.URL.revokeObjectURL = vi.fn();
        const Original = globalThis.Image;
        globalThis.Image = class {
            naturalWidth = 640;
            naturalHeight = 480;
            decode() {
                return Promise.resolve();
            }
        };
        try {
            await normalizarFoto(jpg('a.jpg'));
            expect(dibujos[0].lienzo.width).toBe(640);
        } finally {
            globalThis.Image = Original;
        }
    });

    it('normalizarFoto lanza si el lienzo no produce imagen', async () => {
        simularNavegador({ fallarLienzo: true });
        await expect(normalizarFoto(jpg('a.jpg'))).rejects.toThrow();
    });
});

// Estado mínimo: el componente es controlado por props.
function Arnes({ inicial = [], maximo = 8, onAgregar }) {
    const [tomas, setTomas] = useState(inicial);
    const [id, setId] = useState(100);
    return (
        <SubidaFotosPlantilla
            tomas={tomas}
            maximo={maximo}
            onAgregar={(blob, datos) => {
                onAgregar?.(blob, datos);
                setTomas((t) => [...t, tomaDe(id, { blob, nombre: datos.nombre })]);
                setId((n) => n + 1);
            }}
            onQuitar={(i) => setTomas((t) => t.filter((x) => x.id !== i))}
        />
    );
}
const elegir = (archivos) => fireEvent.change(screen.getByTestId('input-fotos'), { target: { files: archivos } });

describe('SubidaFotosPlantilla', () => {
    beforeEach(() => {
        globalThis.URL.createObjectURL = vi.fn(() => 'blob:x');
        globalThis.URL.revokeObjectURL = vi.fn();
    });

    it('muestra el botón, el texto de cupo y un input oculto que admite varios archivos', () => {
        render(<Arnes />);
        expect(screen.getByRole('button', { name: 'Agregar fotos (JPG)' })).toBeInTheDocument();
        expect(screen.getByText('Elige de 3 a 8 fotos distintas del mismo alumno.')).toBeInTheDocument();
        const input = screen.getByTestId('input-fotos');
        expect(input).toHaveAttribute('multiple');
        expect(input).toHaveAttribute('accept', 'image/jpeg');
        expect(input).toHaveAttribute('hidden');
    });

    it('normaliza cada archivo antes de agregarlo y no entrega el original', async () => {
        simularNavegador();
        const onAgregar = vi.fn();
        render(<Arnes onAgregar={onAgregar} />);
        const originales = [jpg('a.jpg'), jpg('b.jpg')];
        elegir(originales);
        await waitFor(() => expect(onAgregar).toHaveBeenCalledTimes(2));
        expect(onAgregar.mock.calls.map((c) => c[1].nombre)).toEqual(['a.jpg', 'b.jpg']);
        originales.forEach((o) => expect(onAgregar.mock.calls.some((c) => c[0] === o)).toBe(false));
        expect(await screen.findByRole('button', { name: 'Quitar toma 2' })).toBeInTheDocument();
    });

    it('si la normalización falla la foto se rechaza y nunca se agrega el original', async () => {
        simularNavegador({ fallarLienzo: true });
        const onAgregar = vi.fn();
        render(<Arnes onAgregar={onAgregar} />);
        elegir([jpg('rota.jpg')]);
        expect(await screen.findByText('No se pudo preparar «rota.jpg».')).toBeInTheDocument();
        expect(screen.getByRole('alert')).toBeInTheDocument();
        expect(onAgregar).not.toHaveBeenCalled();
    });

    it('rechaza archivos que no son JPG o pesan más de 15 MB y agrega los válidos', async () => {
        simularNavegador();
        const onAgregar = vi.fn();
        render(<Arnes onAgregar={onAgregar} />);
        const grande = jpg('grande.jpg');
        Object.defineProperty(grande, 'size', { value: MAX_ORIGEN_BYTES + 1 });
        elegir([new File(['x'], 'a.png', { type: 'image/png' }), grande, jpg('ok.jpg')]);
        await waitFor(() => expect(onAgregar).toHaveBeenCalledTimes(1));
        expect(screen.getByText('«a.png» no es JPG.')).toBeInTheDocument();
        expect(screen.getByText('«grande.jpg» pesa más de 15 MB.')).toBeInTheDocument();
    });

    it('si caben menos fotos que las elegidas avisa y agrega solo las que caben', async () => {
        simularNavegador();
        const onAgregar = vi.fn();
        render(<Arnes inicial={[tomaDe(1), tomaDe(2), tomaDe(3)]} maximo={4} onAgregar={onAgregar} />);
        elegir([jpg('a.jpg'), jpg('b.jpg'), jpg('c.jpg')]);
        await waitFor(() => expect(onAgregar).toHaveBeenCalledTimes(1));
        expect(screen.getByText('Solo cabe 1 foto más (máximo 4).')).toBeInTheDocument();
    });

    it('con el máximo de fotos deshabilita el botón; quitar una lo libera', () => {
        render(<Arnes inicial={[tomaDe(1), tomaDe(2)]} maximo={2} />);
        expect(screen.getByRole('button', { name: 'Agregar fotos (JPG)' })).toBeDisabled();
        fireEvent.click(screen.getByRole('button', { name: 'Quitar toma 1' }));
        expect(screen.getByRole('button', { name: 'Agregar fotos (JPG)' })).toBeEnabled();
    });
});
