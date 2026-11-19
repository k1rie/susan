import { describe, expect, it } from 'vitest';
import { bloquesDelDia, resumenOcupacion, rotuloBloque, textoTraslape } from './disponibilidadDia.utils.js';

describe('bloquesDelDia', () => {
    const bloques = [
        { fecha: '2026-09-17', hora_inicio: '12:00', hora_fin: '13:00' },
        { fecha: '2026-09-18', hora_inicio: '08:00', hora_fin: '09:00' },
        { fecha: '2026-09-17', hora_inicio: '08:00', hora_fin: '10:00' },
    ];

    it('filtra por fecha y ordena por hora de inicio sin tocar el original', () => {
        expect(bloquesDelDia(bloques, '2026-09-17').map((b) => b.hora_inicio)).toEqual(['08:00', '12:00']);
        expect(bloques[0].hora_inicio).toBe('12:00');
        expect(bloquesDelDia(undefined, '2026-09-17')).toEqual([]);
    });
});

describe('textos', () => {
    it('rotula el bloque con grupo y materia', () => {
        expect(rotuloBloque({ clave_grupo: '3A', materia_nombre: 'Administración I' })).toBe('3A · Administración I');
        expect(rotuloBloque({ clave_grupo: '3A' })).toBe('3A');
    });

    it('dice qué significa cada nivel de traslape', () => {
        expect(textoTraslape('bloquea')).toBe('Se traslapa con tu horario');
        expect(textoTraslape('duplicada')).toBe('Tu grupo ya tiene esta solicitud');
        expect(textoTraslape('compite')).toBe('Se traslapa; decide el administrador');
        expect(textoTraslape(undefined)).toBeNull();
    });

    it('resume la ocupación del día', () => {
        expect(resumenOcupacion([])).toBe('Libre todo el día');
        expect(resumenOcupacion([{}])).toBe('1 bloque ocupado');
        expect(resumenOcupacion([{}, {}, {}])).toBe('3 bloques ocupados');
    });
});
