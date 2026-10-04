import { describe, expect, it } from 'vitest';
import { estadoVista, fuentesDeCaptura, nombreCamara } from './capturaContinua.utils.js';

const base = { activo: true, fuenteLista: true };

describe('estadoVista', () => {
    it('en ventana y con fuente lista: reconociendo', () => {
        expect(estadoVista(base)).toBe('reconociendo');
    });
    it('fuera de la ventana manda sobre todo lo demás', () => {
        expect(estadoVista({ ...base, activo: false })).toBe('fuera');
        expect(estadoVista({ ...base, activo: false, detenido: 'FUERA_DE_VENTANA', fuenteLista: false })).toBe('fuera');
    });
    it.each([
        ['sin fuente lista (permiso de cámara pendiente)', { fuenteLista: false }],
        ['muestreo detenido', { detenido: 'SESION_NO_ABIERTA' }],
        ['problema de hora', { problemaReloj: { code: 'MARCA_FUTURA' } }],
        ['servicio de reconocimiento caído', { servicioNoDisponible: true }],
        ['simulación completa', { simulacionTerminada: true }],
    ])('en pausa: %s', (_, extra) => {
        expect(estadoVista({ ...base, ...extra })).toBe('pausa');
    });
});

describe('fuentesDeCaptura', () => {
    const camaras = [
        { id_camara: 1, tipo: 'ip', estatus: 'activa', posicion: 'fondo' },
        { id_camara: 2, tipo: 'navegador', estatus: 'activa', posicion: 'frente' },
        { id_camara: 3, tipo: 'navegador', estatus: 'inactiva', posicion: 'lado' },
        { id_camara: 4, tipo: 'ip', estatus: 'inactiva', posicion: 'otra' },
    ];
    it('separa las del navegador de las IP y descarta las inactivas', () => {
        const f = fuentesDeCaptura(camaras);
        expect(f.navegador.map((c) => c.id_camara)).toEqual([2]);
        expect(f.ip).toEqual([1]);
    });
    it('tolera entradas que no son listas', () => {
        expect(fuentesDeCaptura(undefined)).toEqual({ navegador: [], ip: [] });
    });
    it('nombra la cámara por su posición', () => {
        expect(nombreCamara(camaras[1])).toBe('Cámara frente');
        expect(nombreCamara(null)).toBeNull();
    });
});
