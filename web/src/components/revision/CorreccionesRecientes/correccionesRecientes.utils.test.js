import { describe, expect, it } from 'vitest';
import { autorCorreccion, conteoAutomaticas, distribucionCorrecciones } from './correccionesRecientes.utils.js';

const C = (estado_nuevo, automatica = false) => ({ estado_nuevo, automatica, usuario: { rol: 'docente' } });

describe('correccionesRecientes.utils', () => {
    it('cuenta por estado resultante en orden fijo y omite ceros y estados desconocidos', () => {
        const d = distribucionCorrecciones([C('ausente'), C('presente'), C('ausente'), C('raro'), C('retardo')]);
        expect(d).toEqual([{ clave: 'presente', valor: 1 }, { clave: 'retardo', valor: 1 }, { clave: 'ausente', valor: 2 }]);
    });
    it('sin correcciones devuelve vacío', () => {
        expect(distribucionCorrecciones([])).toEqual([]);
        expect(distribucionCorrecciones(undefined)).toEqual([]);
    });
    it('separa automáticas de las hechas por una persona', () => {
        expect(conteoAutomaticas([C('ausente', true), C('presente'), C('presente')])).toEqual({ automaticas: 1, manuales: 2 });
        expect(conteoAutomaticas(null)).toEqual({ automaticas: 0, manuales: 0 });
    });
    it('nombra al autor', () => {
        expect(autorCorreccion({ automatica: true })).toBe('Automática');
        expect(autorCorreccion({ usuario: { rol: 'docente' } })).toBe('Docente');
        expect(autorCorreccion({ usuario: { rol: 'administrador' } })).toBe('administrador');
        expect(autorCorreccion({})).toBe('-');
    });
});
