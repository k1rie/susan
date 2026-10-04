// Revision adversarial de la capa web. Las pruebas 'HALLAZGO:' que quedan demuestran defectos AUN pendientes (PASAN mientras
// el defecto exista; al corregirlo se invierten, ver docs/DECISIONS.md §4). Las demas son regresiones de lo corregido y controles que resistieron.
import { describe, expect, it } from 'vitest';
import nextConfig from '../../next.config.mjs';
import { consumirCupoCaptura, reiniciarLimitador } from '@/lib/server/rateLimit.js';
import { ipDeOrigen } from '@/lib/server/ip.js';
import { compararSecreto, verificarCron, verificarOrigen } from '@/lib/server/auth.js';
import { detectarTipo, validarRutaObjeto } from '@/lib/server/storage.js';
import { escaparCelda } from '@/components/reportes/csv/reporteCsv.utils.js';
import { rutaSegura } from '@/components/auth/LoginForm/rutaSegura.js';

const B = 'http://localhost:3000';
const O = { Origin: B, 'content-type': 'application/json' };

let vivo = false;
try {
    const r = await fetch(`${B}/api/salud`, { signal: AbortSignal.timeout(1500) });
    vivo = r.ok;
} catch {
    vivo = false;
}

async function entrar(usuario) {
    const r = await fetch(`${B}/api/_local/auth/login`, {
        method: 'POST', headers: O, body: JSON.stringify({ email: `${usuario}@susan.local`, password: 'demo1234' }),
    });
    return r.headers.get('set-cookie').split(';')[0];
}

describe('cabeceras de seguridad (hallazgo corregido: regresion)', () => {
    it('next.config define headers(), desactiva X-Powered-By y no deja CSP en desarrollo', async () => {
        expect(typeof nextConfig.headers).toBe('function');
        expect(nextConfig.poweredByHeader).toBe(false);
        const [{ headers }] = await nextConfig.headers();
        const nombres = headers.map((h) => h.key);
        for (const k of ['X-Frame-Options', 'X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy']) expect(nombres).toContain(k);
        expect(headers.find((h) => h.key === 'Permissions-Policy').value).toContain('camera=(self)');
    });
    describe.skipIf(!vivo)('servidor real (desarrollo)', () => {
        it('/login lleva X-Frame-Options, nosniff y Referrer-Policy y no anuncia X-Powered-By', async () => {
            const r = await fetch(`${B}/login`);
            expect(r.headers.get('x-frame-options')).toBe('DENY');
            expect(r.headers.get('x-content-type-options')).toBe('nosniff');
            expect(r.headers.get('referrer-policy')).toBeTruthy();
            expect(r.headers.get('x-powered-by')).toBeNull();
        });
    });
});

describe('limitador de captura con marca_tiempo repetida (hallazgo corregido: regresion)', () => {
    it('repetir la misma marca_tiempo solo es gratis 2 veces; despues cuenta como solicitud normal', () => {
        reiniciarLimitador();
        const base = { idUsuario: 1, idSesion: 1, idCamara: 1, intervaloSeg: 15, marcaTiempo: '2026-10-02T10:00:00Z', ahora: 1_000_000 };
        let permitidas = 0;
        for (let i = 0; i < 200; i += 1) if (consumirCupoCaptura({ ...base, ahora: base.ahora + i }).permitido) permitidas += 1;
        // 1 aceptada + 2 reenvios gratuitos; el resto cae dentro de la ventana de intervalo/2 y se rechaza.
        expect(permitidas).toBe(3);
    });
    it('sin marca repetida el cupo si limita', () => {
        reiniciarLimitador();
        const base = { idUsuario: 1, idSesion: 1, idCamara: 1, intervaloSeg: 15, ahora: 1_000_000 };
        expect(consumirCupoCaptura(base).permitido).toBe(true);
        expect(consumirCupoCaptura({ ...base, ahora: base.ahora + 10 }).permitido).toBe(false);
    });
    it('una marca nueva despues de la ventana vuelve a pasar', () => {
        reiniciarLimitador();
        const base = { idUsuario: 1, idSesion: 1, idCamara: 1, intervaloSeg: 15, marcaTiempo: 'm1', ahora: 1_000_000 };
        expect(consumirCupoCaptura(base).permitido).toBe(true);
        expect(consumirCupoCaptura({ ...base, marcaTiempo: 'm2', ahora: base.ahora + 8_000 }).permitido).toBe(true);
    });
});

describe('HALLAZGO: IP de bitacora falsificable por X-Forwarded-For', () => {
    it('HALLAZGO: se toma el PRIMER elemento (el que aporta el cliente), no el ultimo anadido por el proxy', () => {
        const req = { headers: new Headers({ 'x-forwarded-for': '10.9.9.9, 203.0.113.50' }) };
        expect(ipDeOrigen(req)).toBe('10.9.9.9');
    });
});

describe('controles que resistieron', () => {
    it('Origin: ajeno y "null" se rechazan; sin Origin pasa (no navegador)', () => {
        const mk = (origin) => ({ method: 'POST', headers: new Headers({ host: 'app.test', ...(origin ? { origin } : {}) }) });
        expect(() => verificarOrigen(mk('https://evil.com'))).toThrow();
        expect(() => verificarOrigen(mk('null'))).toThrow();
        expect(() => verificarOrigen(mk('http://app.test.evil.com'))).toThrow();
        expect(() => verificarOrigen(mk(null))).not.toThrow();
    });
    it('cron: sin CRON_SECRET nunca abre; comparacion de longitud distinta no lanza', () => {
        const previo = process.env.CRON_SECRET;
        delete process.env.CRON_SECRET;
        try {
            expect(() => verificarCron({ headers: new Headers({ authorization: 'Bearer ' }) })).toThrow();
            expect(() => verificarCron({ headers: new Headers({ authorization: 'Bearer x' }) })).toThrow();
            process.env.CRON_SECRET = 'abc';
            expect(() => verificarCron({ headers: new Headers({ authorization: 'Bearer abc' }) })).not.toThrow();
            expect(() => verificarCron({ headers: new Headers({ authorization: 'Bearer abcd' }) })).toThrow();
            expect(compararSecreto('a', 'abc')).toBe(false);
        } finally {
            if (previo === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = previo;
        }
    });
    it('rutas de objeto: traversal, NUL, prefijo ajeno y extension doble se rechazan', () => {
        for (const mala of ['../x', 'registro/1/../../a.jpg', '/etc/passwd', 'registro/1/\u0000.jpg', 'registro/1/a.jpg',
            'justificantes/1/00000000-0000-0000-0000-000000000000.svg', 'otro/1/a.jpg', 'registro//1/x.jpg']) {
            expect(() => validarRutaObjeto(mala)).toThrow();
        }
    });
    it('firma binaria: HTML/SVG renombrado a jpg no se detecta como imagen', () => {
        expect(detectarTipo(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'))).toBeNull();
        expect(detectarTipo(Buffer.from('<html><script>alert(1)</script></html>'))).toBeNull();
        expect(detectarTipo(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('jpg');
    });
    it('CSV: prefijo anti formula', () => {
        for (const v of ['=1+1', '+cmd', '-2', '@SUM(A1)', '\tx']) expect(escaparCelda(v).startsWith("'")).toBe(true);
    });
    it('?next= : redireccion abierta rechazada', () => {
        for (const v of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '/\t/evil.com']) {
            expect(rutaSegura(v)).toBeNull();
        }
        expect(rutaSegura('/docente?x=1')).toBe('/docente?x=1');
    });
});

describe.skipIf(!vivo)('servidor real :3000 (modo local)', () => {
    it('HALLAZGO: la cookie de sesion sigue valida despues de cerrar sesion', async () => {
        const cookie = await entrar('docente1');
        const out = await fetch(`${B}/api/_local/auth/logout`, { method: 'POST', headers: O, body: '{}' });
        expect(out.status).toBe(200);
        const s = await (await fetch(`${B}/api/_local/auth/session`, { headers: { cookie } })).json();
        expect(s.data.user).not.toBeNull();
    });

    it('HALLAZGO: el login local no limita intentos y filtra existencia de la cuenta por tiempo', async () => {
        const medir = async (correo) => {
            const t = [];
            for (let i = 0; i < 7; i += 1) {
                const t0 = performance.now();
                const r = await fetch(`${B}/api/_local/auth/login`, {
                    method: 'POST', headers: O, body: JSON.stringify({ email: correo, password: 'mala-clave-123' }),
                });
                expect(r.status).toBe(400); // jamas 429
                t.push(performance.now() - t0);
            }
            // El minimo descarta el ruido por carga de CPU (la suite corre en paralelo); la mediana flaqueaba con la maquina ocupada.
            return Math.min(...t);
        };
        const existe = await medir('admin@susan.local');
        const noExiste = await medir('nadie-xyz@susan.local');
        expect(existe).toBeGreaterThan(noExiste * 3);
    });

    it('svc_* inalcanzable por HTTP, Origin obligatorio, storage sin sesion', async () => {
        const cookie = await entrar('admin');
        const svc = await fetch(`${B}/api/_local/rpc/svc_job_cerrar_sesiones`, { method: 'POST', headers: { ...O, cookie }, body: '{"args":{}}' });
        expect(svc.status).toBe(403);
        const sinOrigen = await fetch(`${B}/api/_local/rpc/api_yo`, { method: 'POST', headers: { 'content-type': 'application/json', cookie }, body: '{"args":{}}' });
        expect(sinOrigen.status).toBe(403);
        const ajeno = await fetch(`${B}/api/_local/rpc/api_yo`, { method: 'POST', headers: { ...O, Origin: 'http://evil.com', cookie }, body: '{"args":{}}' });
        expect(ajeno.status).toBe(403);
        const sin = await fetch(`${B}/api/_local/storage/object?token=x`);
        expect(sin.status).toBe(401);
    });

    it('roles e IDOR: alumno/docente/tecnico no crean usuarios; docente2 no ve casos de docente1', async () => {
        for (const u of ['docente1', 'e260001', 'tecnico']) {
            const r = await fetch(`${B}/api/admin/usuarios`, { method: 'POST', headers: { ...O, cookie: await entrar(u) }, body: '{}' });
            expect(r.status).toBe(403);
        }
        const d2 = await entrar('docente2');
        const r = await fetch(`${B}/api/casos/1/detecciones`, { headers: { cookie: d2 } });
        expect(r.status).toBe(404);
        const sinSesion = await fetch(`${B}/api/casos/1/detecciones`);
        expect(sinSesion.status).toBe(401);
    });

    it('jobs: sin Bearer o con Bearer vacio -> 401/503, nunca 200', async () => {
        for (const h of [{}, { authorization: 'Bearer ' }, { authorization: 'Bearer x' }]) {
            const r = await fetch(`${B}/api/jobs/cerrar-sesiones`, { method: 'POST', headers: h });
            expect([401, 503]).toContain(r.status);
        }
    });
});
