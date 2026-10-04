import { afterEach, describe, expect, it, vi } from 'vitest';
import { RUTA_RELOJ_DEMO, cambiarRelojDemo, leerRelojDemo } from './relojCliente.js';

const ESTADO = { activo: true, corre: false, ahora: '2026-09-14T07:12:00-06:00', fecha: '2026-09-14', hora: '07:12:00', inicial: '2026-09-14T07:12:00-06:00' };
const respuesta = (cuerpo, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { 'content-type': 'application/json' } });

afterEach(() => vi.unstubAllGlobals());

describe('relojCliente', () => {
    it('leerRelojDemo hace GET a /api/_local/reloj con la cookie de sesion y devuelve el estado', async () => {
        const fetchSimulado = vi.fn().mockResolvedValue(respuesta(ESTADO));
        vi.stubGlobal('fetch', fetchSimulado);
        expect(await leerRelojDemo()).toEqual(ESTADO);
        const [url, init] = fetchSimulado.mock.calls[0];
        expect(url).toBe(RUTA_RELOJ_DEMO);
        expect(init).toMatchObject({ method: 'GET', credentials: 'same-origin', cache: 'no-store' });
    });

    it('cambiarRelojDemo hace POST con el cuerpo JSON', async () => {
        const fetchSimulado = vi.fn().mockResolvedValue(respuesta({ ...ESTADO, hora: '07:42:00' }));
        vi.stubGlobal('fetch', fetchSimulado);
        expect((await cambiarRelojDemo({ avanzarMin: 30 })).hora).toBe('07:42:00');
        const [url, init] = fetchSimulado.mock.calls[0];
        expect(url).toBe(RUTA_RELOJ_DEMO);
        expect(init.method).toBe('POST');
        expect(JSON.parse(init.body)).toEqual({ avanzarMin: 30 });
        expect(init.headers['Content-Type']).toBe('application/json');
    });

    it('un 404 (fuera del modo local) o un 409 llegan como ApiError con su codigo', async () => {
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ error: { code: 'NO_ENCONTRADO', message: 'No encontrado' } }, 404)));
        await expect(leerRelojDemo()).rejects.toMatchObject({ code: 'NO_ENCONTRADO', status: 404 });
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respuesta({ data: null, error: { code: 'RELOJ_NO_ACTIVO', message: 'apagado' } }, 409)));
        await expect(cambiarRelojDemo({ restablecer: true })).rejects.toMatchObject({ code: 'RELOJ_NO_ACTIVO', status: 409 });
    });
});
