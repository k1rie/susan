import { describe, expect, it } from 'vitest';
import { numerarTomas, ordenarTomas, PASOS_TOMA, TOTAL_PASOS } from './capturaGuiada.utils.js';

const toma = (id, paso, extra = {}) => ({ id, origen: paso == null ? 'archivo' : 'camara', paso, blob: new Blob([String(id)], { type: 'image/jpeg' }), nombre: null, estado: 'aceptada', ...extra });

describe('utils de la captura guiada', () => {
    it('los 5 pasos llevan sus textos exactos y las tomas 4 y 5 son opcionales', () => {
        expect(TOTAL_PASOS).toBe(5);
        expect(PASOS_TOMA.map((p) => p.titulo)).toEqual(['De frente', 'Gira a la izquierda', 'Gira a la derecha', 'Inclina hacia arriba', 'Otra expresión o luz']);
        expect(PASOS_TOMA[0].indicacion).toBe('Mira de frente a la cámara, con el rostro dentro del círculo.');
        expect(PASOS_TOMA[1].indicacion).toBe('Gira la cabeza un poco hacia tu izquierda (unos 15 grados) sin dejar de ver la cámara.');
        expect(PASOS_TOMA[2].indicacion).toBe('Ahora gira un poco hacia tu derecha (unos 15 grados).');
        expect(PASOS_TOMA[3].indicacion).toBe('Levanta ligeramente la barbilla, sin cerrar los ojos.');
        expect(PASOS_TOMA[4].indicacion).toBe('Sonríe o cambia un poco la luz o el lugar. Mantén el rostro completo visible.');
        expect(PASOS_TOMA.map((p) => p.opcional)).toEqual([false, false, false, true, true]);
    });

    it('ordenarTomas: por paso, las subidas al final y por llegada dentro de cada grupo', () => {
        const t = [toma(5, null), toma(4, 2), toma(3, 0), toma(2, null), toma(1, 1)];
        expect(ordenarTomas(t).map((x) => x.id)).toEqual([3, 1, 4, 2, 5]);
        expect(t.map((x) => x.id)).toEqual([5, 4, 3, 2, 1]); // no muta
    });

    it('numerarTomas: por paso en cámara (subidas desde el 6) y por posición en archivo', () => {
        const t = [toma(1, 0), toma(2, 2), toma(3, null), toma(4, null)];
        expect([...numerarTomas(t, 'camara')]).toEqual([[1, 1], [2, 3], [3, 6], [4, 7]]);
        expect([...numerarTomas(t, 'archivo')]).toEqual([[1, 1], [2, 2], [3, 3], [4, 4]]);
    });
});
