// @vitest-environment jsdom
// usePlantillaFacial con las llamadas inyectadas (`api`): el autoservicio del alumno usa las suyas y el hook no debe tocar las del admin.
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    consentimientosAlumno: vi.fn(),
    plantillaAlumno: vi.fn(),
    verificarFoto: vi.fn(),
    verificarFotos: vi.fn(),
    registrarPlantilla: vi.fn(),
}));
vi.mock('@/lib/api/biometria.js', () => ({ consentimientosAlumno: mocks.consentimientosAlumno, plantillaAlumno: mocks.plantillaAlumno }));
vi.mock('@/lib/http/biometria.js', () => ({ verificarFoto: mocks.verificarFoto, verificarFotos: mocks.verificarFotos, registrarPlantilla: mocks.registrarPlantilla }));

import usePlantillaFacial, { API_ADMIN } from './usePlantillaFacial.js';

const CONSENT = { vigente: true, consentimiento_vigente: { id_consent: 9 }, items: [] };
const SIN_PLANTILLA = { activa: null, archivadas: { total: 0, items: [] } };
const calidad = { brillo: 120, nitidez: 80, tamano_rostro_px: 200, frontal: true };
const conjunto = (n) => ({
    total: n, aceptadas: n, minimo: 3, maximo: 8, suficiente: n >= 3, consistente: true, ambiguo: false, umbral_coseno: 0.35,
    coseno_min: 0.5, coseno_medio: 0.7, coseno_max_par: 0.9, advertencias: [],
    fotos: Array.from({ length: n }, (_, i) => ({ indice: i, estado: 'aceptada', rostros: 1, un_solo_rostro: true, calidad, motivo_rechazo: null, motivo_codigo: null, coseno_resto: 0.8, duplicada_de: null })),
});
const blob = (i) => new Blob([`foto-${i}`], { type: 'image/jpeg' });

// Las funciones de la API propia deben ser estables (van a useApiQuery): se crean una vez, fuera del hook.
const propia = {
    consentimientos: vi.fn(),
    plantilla: vi.fn(),
    verificar: vi.fn(),
    verificarUna: vi.fn(),
    registrar: vi.fn(),
    permiteUna: false,
};

beforeEach(() => {
    for (const m of [...Object.values(mocks), propia.consentimientos, propia.plantilla, propia.verificar, propia.verificarUna, propia.registrar]) m.mockReset();
    mocks.consentimientosAlumno.mockResolvedValue(CONSENT);
    mocks.plantillaAlumno.mockResolvedValue(SIN_PLANTILLA);
    mocks.verificarFotos.mockImplementation(async (blobs) => conjunto(blobs.length));
    mocks.registrarPlantilla.mockResolvedValue({ id_plantilla: 1, n_fotos: 3, indice: { estado: 'activada', version: 'v1' } });
    propia.consentimientos.mockResolvedValue(CONSENT);
    propia.plantilla.mockResolvedValue(SIN_PLANTILLA);
    propia.verificar.mockImplementation(async (blobs) => conjunto(blobs.length));
    propia.registrar.mockResolvedValue({ id_plantilla: 2, n_fotos: 3, indice: { estado: 'activada', version: 'v2' } });
});

async function conTresTomas(opciones) {
    const hook = renderHook(() => usePlantillaFacial(opciones));
    await waitFor(() => expect(hook.result.current.vigente).toBeTruthy());
    act(() => {
        [1, 2, 3].forEach((i) => hook.result.current.agregarToma(blob(i), 'camara', { paso: i - 1 }));
    });
    await waitFor(() => expect(hook.result.current.puedeRegistrar).toBe(true), { timeout: 3000 });
    return hook;
}

describe('usePlantillaFacial: API del administrador (por omisión)', () => {
    it('API_ADMIN usa las llamadas de siempre y permite el camino de una foto', () => {
        expect(API_ADMIN).toMatchObject({
            consentimientos: mocks.consentimientosAlumno, plantilla: mocks.plantillaAlumno,
            verificar: mocks.verificarFotos, verificarUna: mocks.verificarFoto, registrar: mocks.registrarPlantilla, permiteUna: true,
        });
    });

    it('sin `api` carga con idAlumno, verifica y registra con id_alumno e id_consent', async () => {
        const { result } = await conTresTomas({ idAlumno: 17 });
        expect(mocks.consentimientosAlumno).toHaveBeenCalledWith({ idAlumno: 17, limit: 50 });
        expect(mocks.verificarFotos).toHaveBeenCalledWith(expect.any(Array), expect.objectContaining({ idAlumno: 17, idConsent: 9 }));
        await act(async () => result.current.registrar());
        expect(mocks.registrarPlantilla).toHaveBeenCalledWith({ idAlumno: 17, idConsent: 9, fotos: expect.any(Array) });
    });

    it('con una sola toma aceptada ofrece el registro de una foto', async () => {
        const hook = renderHook(() => usePlantillaFacial({ idAlumno: 17 }));
        await waitFor(() => expect(hook.result.current.vigente).toBeTruthy());
        act(() => { hook.result.current.agregarToma(blob(1), 'camara', { paso: 0 }); });
        await waitFor(() => expect(hook.result.current.puedeRegistrarUna).toBe(true), { timeout: 3000 });
    });
});

describe('usePlantillaFacial: API propia (autoservicio)', () => {
    it('lee, verifica y registra con SUS llamadas y nunca con las del administrador', async () => {
        const { result } = await conTresTomas({ api: propia });
        expect(propia.consentimientos).toHaveBeenCalled();
        expect(propia.plantilla).toHaveBeenCalled();
        expect(propia.verificar).toHaveBeenCalled();
        await act(async () => result.current.registrar());
        expect(propia.registrar).toHaveBeenCalledTimes(1);
        expect(propia.registrar.mock.calls[0][0].fotos).toHaveLength(3);
        for (const m of Object.values(mocks)) expect(m).not.toHaveBeenCalled();
    });

    it('expone verificarUna (la detección en vivo) de SU api: la del alumno, no la del administrador', async () => {
        const hook = renderHook(() => usePlantillaFacial({ api: propia }));
        expect(hook.result.current.verificarUna).toBe(propia.verificarUna);
        const admin = renderHook(() => usePlantillaFacial({ idAlumno: 17 }));
        expect(admin.result.current.verificarUna).toBe(mocks.verificarFoto);
    });

    it('permiteUna: false -> nunca ofrece el camino de una sola foto', async () => {
        const hook = renderHook(() => usePlantillaFacial({ api: propia }));
        await waitFor(() => expect(hook.result.current.vigente).toBeTruthy());
        act(() => { hook.result.current.agregarToma(blob(1), 'camara', { paso: 0 }); });
        await waitFor(() => expect(hook.result.current.aceptadas).toBe(1), { timeout: 3000 });
        expect(hook.result.current.puedeRegistrarUna).toBe(false);
    });

    it('sin consentimiento vigente no se puede registrar (RN-13) aunque haya tomas', async () => {
        propia.consentimientos.mockResolvedValue({ vigente: false, consentimiento_vigente: null, items: [] });
        const hook = renderHook(() => usePlantillaFacial({ api: propia }));
        await waitFor(() => expect(propia.consentimientos).toHaveBeenCalled());
        act(() => { [1, 2, 3].forEach((i) => hook.result.current.agregarToma(blob(i), 'camara', { paso: i - 1 })); });
        expect(hook.result.current.puedeRegistrar).toBe(false);
        expect(propia.verificar).not.toHaveBeenCalled();
    });
});
