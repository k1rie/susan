import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ miRegistro: vi.fn(), verificarMisFotos: vi.fn(), verificarMiFoto: vi.fn(), registrarMiPlantilla: vi.fn() }));
vi.mock('@/lib/api/biometria.js', () => ({ miRegistro: mocks.miRegistro }));
vi.mock('@/lib/http/autoservicio.js', () => ({
    verificarMisFotos: mocks.verificarMisFotos, verificarMiFoto: mocks.verificarMiFoto, registrarMiPlantilla: mocks.registrarMiPlantilla,
}));

import { API_PROPIA, consentimientosPropios, plantillaPropia } from './miRegistro.api.js';

const CONSENTIMIENTO = { id_consent: 9, vigencia_hasta: '2027-10-07' };
const PLANTILLA = { id_plantilla: 41, indexada: true };

beforeEach(() => {
    Object.values(mocks).forEach((m) => m.mockReset());
});

describe('adaptadores del autoservicio', () => {
    it('consentimientosPropios entrega la forma que lee el hook (vigente + consentimiento_vigente)', async () => {
        mocks.miRegistro.mockResolvedValue({ consentimiento: CONSENTIMIENTO, plantilla: null });
        expect(await consentimientosPropios()).toEqual({ vigente: true, consentimiento_vigente: CONSENTIMIENTO, items: [] });
        mocks.miRegistro.mockResolvedValue({ consentimiento: null, plantilla: null });
        expect(await consentimientosPropios()).toMatchObject({ vigente: false, consentimiento_vigente: null });
    });

    it('plantillaPropia entrega { activa, archivadas }', async () => {
        mocks.miRegistro.mockResolvedValue({ consentimiento: CONSENTIMIENTO, plantilla: PLANTILLA });
        expect(await plantillaPropia()).toEqual({ activa: PLANTILLA, archivadas: { total: 0, items: [] } });
        mocks.miRegistro.mockResolvedValue({ consentimiento: null, plantilla: null });
        expect((await plantillaPropia()).activa).toBeNull();
    });

    it('verificar y registrar descartan idAlumno e idConsent: solo viajan las fotos', async () => {
        const blobs = [new Blob(['a']), new Blob(['b']), new Blob(['c'])];
        const senal = new AbortController().signal;
        await API_PROPIA.verificar(blobs, { idAlumno: 99, idConsent: 1, signal: senal });
        expect(mocks.verificarMisFotos).toHaveBeenCalledWith(blobs, { signal: senal });
        await API_PROPIA.registrar({ idAlumno: 99, idConsent: 1, fotos: blobs });
        expect(mocks.registrarMiPlantilla).toHaveBeenCalledWith({ fotos: blobs });
    });

    it('verificarUna (la detección en vivo) va a la ruta del alumno: solo la toma y la señal, nunca la ruta del administrador', async () => {
        const blob = new Blob(['a']);
        const senal = new AbortController().signal;
        await API_PROPIA.verificarUna(blob, { idAlumno: 99, signal: senal });
        expect(mocks.verificarMiFoto).toHaveBeenCalledWith(blob, { signal: senal });
    });

    it('no permite el camino de una sola foto', () => expect(API_PROPIA.permiteUna).toBe(false));
});
