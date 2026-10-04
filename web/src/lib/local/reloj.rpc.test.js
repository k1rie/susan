import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { URL_BD_PRUEBAS, bdDisponible, idDeUsuario } from './db.testutil.js';

const hayBd = await bdDisponible();

// Integracion real: lo que mueve el reloj (archivo) llega a app.now() de PostgreSQL en la SIGUIENTE RPC, sin reiniciar.
// Solo lee (api_ahora); no modifica la base.
describe.skipIf(!hayBd)('el reloj de demostracion llega a PostgreSQL en cada RPC', () => {
    let ejecutarRpc;
    let cerrarPool;
    let reloj;
    let docente;
    let dir;

    beforeAll(async () => {
        process.env.LOCAL_DATABASE_URL = URL_BD_PRUEBAS;
        ({ ejecutarRpc } = await import('./rpc.js'));
        ({ cerrarPool } = await import('./pool.js'));
        reloj = await import('./reloj.js');
        docente = await idDeUsuario('docente1@susan.local');
    });
    afterAll(async () => {
        await cerrarPool?.();
    });
    beforeEach(() => {
        dir = fs.mkdtempSync(path.join(os.tmpdir(), 'susan-reloj-rpc-'));
        vi.stubEnv('LOCAL_CLOCK_FILE', path.join(dir, 'run', 'fake_now'));
        vi.stubEnv('SUSAN_LOCAL', '1'); // el reloj de demostracion solo existe en el modo local
        vi.stubEnv('LOCAL_FAKE_NOW', '2026-09-14 07:12:00-06');
    });
    afterEach(() => {
        vi.unstubAllEnvs();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    const ahora = async () => {
        const { data, error } = await ejecutarRpc('api_ahora', {}, { rol: 'authenticated', claims: { sub: docente, email: 'docente1@susan.local' } });
        expect(error).toBeNull();
        return data;
    };

    it('valor inicial, avanzar, fijar y restablecer se ven en api_ahora sin reiniciar nada', async () => {
        expect(await ahora()).toMatchObject({ reloj_simulado: true, fecha: '2026-09-14', hora: '07:12:00' });
        reloj.avanzarReloj(30);
        expect(await ahora()).toMatchObject({ reloj_simulado: true, fecha: '2026-09-14', hora: '07:42:00' });
        reloj.fijarReloj('2026-09-15 06:55');
        expect(await ahora()).toMatchObject({ fecha: '2026-09-15', hora: '06:55:00' });
        reloj.restablecerReloj();
        expect(await ahora()).toMatchObject({ fecha: '2026-09-14', hora: '07:12:00' });
    });

    it('corriendo: dos RPC separadas por 1,2 s ven instantes distintos (la captura exige marcas distintas)', async () => {
        reloj.correrReloj(true);
        const a = await ahora();
        await new Promise((r) => setTimeout(r, 1200));
        const b = await ahora();
        expect(Date.parse(b.ahora) - Date.parse(a.ahora)).toBeGreaterThanOrEqual(1000);
        reloj.correrReloj(false);
        const c = await ahora();
        await new Promise((r) => setTimeout(r, 300));
        expect((await ahora()).ahora).toBe(c.ahora); // congelado de nuevo
    });

    it('sin modo local (SUSAN_LOCAL vacio) la base usa el reloj real aunque LOCAL_FAKE_NOW siga puesto', async () => {
        vi.stubEnv('SUSAN_LOCAL', '');
        vi.stubEnv('NEXT_PUBLIC_SUSAN_LOCAL', '');
        const r = await ahora();
        expect(r.reloj_simulado).toBe(false);
        expect(Math.abs(Date.parse(r.ahora) - Date.now())).toBeLessThan(60_000);
    });

    it('apagado (LOCAL_FAKE_NOW=off): la base usa el reloj real', async () => {
        vi.stubEnv('LOCAL_FAKE_NOW', 'off');
        const r = await ahora();
        expect(r.reloj_simulado).toBe(false);
        expect(Math.abs(Date.parse(r.ahora) - Date.now())).toBeLessThan(60_000);
    });
});
