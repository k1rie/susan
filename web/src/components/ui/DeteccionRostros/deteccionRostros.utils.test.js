import { describe, expect, it } from 'vitest';
import { marcoNormalizado, marcosDeDetecciones, textoDeteccion } from './deteccionRostros.utils.js';

// Sin holgura para que las cuentas sean exactas; la holgura se prueba aparte.
const SIN_HOLGURA = { holgura: 0 };

describe('marcoNormalizado', () => {
    it('con el video y el marco de la misma proporción, solo escala a fracciones', () => {
        const m = marcoNormalizado({ x: 160, y: 120, ancho: 320, alto: 240 }, { videoAncho: 640, videoAlto: 480, cajaAncho: 320, cajaAlto: 240, ...SIN_HOLGURA });
        expect(m).toEqual({ x: 0.25, y: 0.25, ancho: 0.5, alto: 0.5 });
    });

    it('con espejo, el recuadro se voltea igual que el video', () => {
        const m = marcoNormalizado({ x: 0, y: 0, ancho: 160, alto: 120 }, { videoAncho: 640, videoAlto: 480, cajaAncho: 640, cajaAlto: 480, espejo: true, ...SIN_HOLGURA });
        // Un rostro pegado a la izquierda del fotograma se ve pegado a la derecha del reflejo.
        expect(m.x).toBeCloseTo(0.75);
        expect(m.ancho).toBeCloseTo(0.25);
        expect(m.y).toBe(0);
    });

    it('sigue el recorte de object-cover: un video 4:3 en un marco 16:9 pierde arriba y abajo', () => {
        // Video 640x480 en marco 1600x900: escala = max(2.5, 1.875) = 2.5 -> el video mide 1600x1200 y se recortan 150 px arriba y abajo.
        const m = marcoNormalizado({ x: 0, y: 240, ancho: 64, alto: 48 }, { videoAncho: 640, videoAlto: 480, cajaAncho: 1600, cajaAlto: 900, ...SIN_HOLGURA });
        expect(m.x).toBe(0);
        expect(m.y).toBeCloseTo((240 * 2.5 - 150) / 900); // 450/900 = 0.5
        expect(m.ancho).toBeCloseTo(160 / 1600);
        expect(m.alto).toBeCloseTo(120 / 900);
    });

    it('un video más ancho que el marco pierde a los lados', () => {
        // 1920x1080 en un marco 4:3 de 400x300: escala = max(0.208, 0.277) = 0.2778 -> 533x300, se pierden ~66 px por lado.
        const m = marcoNormalizado({ x: 960, y: 0, ancho: 0, alto: 0 }, { videoAncho: 1920, videoAlto: 1080, cajaAncho: 400, cajaAlto: 300, ...SIN_HOLGURA });
        expect(m.x).toBeCloseTo(0.5); // el centro del fotograma sigue en el centro del marco
    });

    it('la holgura agranda el recuadro por todos lados sin moverle el centro', () => {
        const base = marcoNormalizado({ x: 100, y: 100, ancho: 100, alto: 100 }, { videoAncho: 400, videoAlto: 400, cajaAncho: 400, cajaAlto: 400, ...SIN_HOLGURA });
        const holgado = marcoNormalizado({ x: 100, y: 100, ancho: 100, alto: 100 }, { videoAncho: 400, videoAlto: 400, cajaAncho: 400, cajaAlto: 400, holgura: 0.1 });
        expect(holgado.ancho).toBeCloseTo(base.ancho * 1.2);
        expect(holgado.x + holgado.ancho / 2).toBeCloseTo(base.x + base.ancho / 2);
        expect(holgado.y + holgado.alto / 2).toBeCloseTo(base.y + base.alto / 2);
    });

    it('devuelve null si falta alguna medida o el marco aún no tiene tamaño', () => {
        const ok = { videoAncho: 640, videoAlto: 480, cajaAncho: 320, cajaAlto: 240 };
        expect(marcoNormalizado({ x: 1, y: 1, ancho: 1, alto: 1 }, { ...ok, cajaAncho: 0 })).toBeNull();
        expect(marcoNormalizado({ x: 1, y: 1, ancho: 1, alto: 1 }, { ...ok, videoAlto: 0 })).toBeNull();
        expect(marcoNormalizado({ x: Number.NaN, y: 1, ancho: 1, alto: 1 }, ok)).toBeNull();
        expect(marcoNormalizado(undefined, ok)).toBeNull();
    });
});

describe('marcosDeDetecciones', () => {
    const medidas = { videoAncho: 640, videoAlto: 480, cajaAncho: 640, cajaAlto: 480, holgura: 0 };

    it('convierte cada boundingBox de MediaPipe y descarta las detecciones sin caja', () => {
        const marcos = marcosDeDetecciones(
            [{ boundingBox: { originX: 64, originY: 48, width: 64, height: 48 } }, { categories: [] }, null],
            medidas,
        );
        expect(marcos).toHaveLength(1);
        expect(marcos[0]).toMatchObject({ x: 0.1, y: 0.1, ancho: 0.1, alto: 0.1 });
    });

    it('sin detecciones devuelve una lista vacía', () => {
        expect(marcosDeDetecciones([], medidas)).toEqual([]);
        expect(marcosDeDetecciones(undefined, medidas)).toEqual([]);
    });
});

describe('textoDeteccion', () => {
    it.each([
        [{ estado: 'cargando' }, 'Preparando detección…'],
        [{ estado: 'no-disponible' }, 'Detección en vivo no disponible'],
        [{ estado: 'listo', cantidad: 0 }, 'Sin rostros a la vista'],
        [{ estado: 'listo', cantidad: 1 }, '1 rostro detectado'],
        [{ estado: 'listo', cantidad: 24 }, '24 rostros detectados'],
    ])('%j -> «%s»', (entrada, texto) => {
        expect(textoDeteccion(entrada)).toBe(texto);
    });
});
