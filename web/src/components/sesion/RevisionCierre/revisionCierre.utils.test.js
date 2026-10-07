import { describe, expect, it } from 'vitest';
import { decisionCierre } from './revisionCierre.utils.js';

const enTolerancia = { estatus: 'abierta', en_ventana: true, tolerancia_min: 20, minuto_actual: 5 };
const terminada = { estatus: 'abierta', en_ventana: false, tolerancia_min: 20, minuto_actual: 21 };

describe('decisionCierre', () => {
    it('titular según cuántos faltan: ninguno, uno o varios', () => {
        expect(decisionCierre(terminada, 0).titulo).toBe('Todos los alumnos tienen registro');
        expect(decisionCierre(terminada, 1).titulo).toBe('Falta 1 alumno por registrar');
        expect(decisionCierre(terminada, 24).titulo).toBe('Faltan 24 alumnos por registrar');
    });

    it('con la tolerancia en curso el cierre está bloqueado: dice cuánto falta y que la cámara sigue reconociendo', () => {
        const d = decisionCierre(enTolerancia, 3);
        expect(d.puedeCerrar).toBe(false);
        expect(d.nota).toBe('El cierre se habilita al terminar la tolerancia: faltan 15 min. La cámara sigue reconociendo mientras revisas.');
    });

    it('terminada la tolerancia el cierre se habilita y avisa qué pasa con quien falta', () => {
        const con = decisionCierre(terminada, 2);
        expect(con.puedeCerrar).toBe(true);
        expect(con.nota).toBe('Si cierras ahora quedarán como ausentes. Puedes registrarlos a mano antes.');
        const sin = decisionCierre(terminada, 0);
        expect(sin.puedeCerrar).toBe(true);
        expect(sin.nota).toBe('Ya puedes cerrar el pase de lista.');
    });

    it('sin saber si hay ventana no se promete que la cámara siga: solo el motivo del bloqueo', () => {
        const d = decisionCierre({ estatus: 'abierta', tolerancia_min: 20 }, 1);
        expect(d.puedeCerrar).toBe(false);
        expect(d.nota).not.toContain('La cámara sigue');
        expect(d.nota).toContain('El cierre se habilita al terminar la tolerancia');
    });
});
