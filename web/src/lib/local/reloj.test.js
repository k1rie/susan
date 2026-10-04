import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    ErrorReloj,
    MAX_AVANCE_MIN,
    ahoraDeNegocio,
    avanzarReloj,
    correrReloj,
    describirReloj,
    fijarReloj,
    formatearIso,
    formatearSql,
    leerReloj,
    parsearInstante,
    partesSede,
    relojDemoActivo,
    restablecerReloj,
    rutaArchivoReloj,
    valorRelojSql,
} from './reloj.js';

const INICIAL = '2026-09-14 07:12:00-06';
// 2026-09-14 07:12:00 en la sede (UTC-6) = 13:12:00 UTC.
const MS_INICIAL = Date.UTC(2026, 8, 14, 13, 12, 0);
const MIN = 60_000;
const T0 = Date.UTC(2026, 9, 3, 12, 0, 0); // "ahora" real inyectado en las pruebas

let dir;
let archivo;

beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'susan-reloj-'));
    archivo = path.join(dir, 'run', 'fake_now');
    // El reloj de demostracion solo existe en el modo local (configInicial): sin esto LOCAL_FAKE_NOW no basta.
    vi.stubEnv('SUSAN_LOCAL', '1');
    vi.stubEnv('LOCAL_FAKE_NOW', INICIAL);
    vi.stubEnv('LOCAL_CLOCK_FILE', archivo);
});

afterEach(() => {
    vi.unstubAllEnvs();
    fs.rmSync(dir, { recursive: true, force: true });
});

const horaDe = (estado) => partesSede(estado.ms).hora;

/** Codigo del ErrorReloj que lanza `fn` ('NINGUNO' si no lanza): evita depender de matchers asimetricos en toThrow. */
function codigoDe(fn) {
    try {
        fn();
    } catch (e) {
        expect(e).toBeInstanceOf(ErrorReloj);
        return e.code;
    }
    return 'NINGUNO';
}

describe('formato', () => {
    it('partesSede, formatearSql y formatearIso usan la hora de la sede (-06)', () => {
        expect(partesSede(MS_INICIAL)).toEqual({ fecha: '2026-09-14', hora: '07:12:00', milis: 0 });
        expect(formatearSql(MS_INICIAL)).toBe('2026-09-14 07:12:00-06');
        expect(formatearIso(MS_INICIAL)).toBe('2026-09-14T07:12:00-06:00');
    });

    it('cruza la medianoche: 23:50 UTC-6 ya es el dia siguiente en UTC pero no en la sede', () => {
        const ms = Date.UTC(2026, 8, 15, 5, 50, 0); // 23:50 del 14 en la sede
        expect(partesSede(ms)).toMatchObject({ fecha: '2026-09-14', hora: '23:50:00' });
        expect(partesSede(ms + 20 * MIN)).toMatchObject({ fecha: '2026-09-15', hora: '00:10:00' });
    });

    it('los milisegundos solo aparecen si no son cero', () => {
        expect(formatearSql(MS_INICIAL + 456)).toBe('2026-09-14 07:12:00.456-06');
        expect(formatearIso(MS_INICIAL + 7)).toBe('2026-09-14T07:12:00.007-06:00');
    });

    it('ida y vuelta: parsearInstante(formatearSql(x)) === x', () => {
        for (const ms of [MS_INICIAL, MS_INICIAL + 456, Date.UTC(2099, 11, 31, 5, 59, 59), Date.UTC(2000, 0, 1, 6, 0, 0)]) {
            expect(parsearInstante(formatearSql(ms))).toBe(ms);
            expect(parsearInstante(formatearIso(ms))).toBe(ms);
        }
    });
});

describe('parsearInstante', () => {
    it.each([
        ['2026-09-14 07:12:00-06', MS_INICIAL],
        ['2026-09-14 07:12:00', MS_INICIAL], // sin zona = hora de la sede
        ['2026-09-14 07:12', MS_INICIAL],
        ['2026-09-14T07:12', MS_INICIAL],
        ['2026-09-14T07:12:00-06:00', MS_INICIAL],
        ['2026-09-14T13:12:00Z', MS_INICIAL],
        ['2026-09-14 13:12:00+00', MS_INICIAL],
        ['2026-09-14 08:12:00-05:00', MS_INICIAL],
        ['  2026-09-14 07:12:00-06  ', MS_INICIAL],
        ['2026-09-14 07:12:00.250-06', MS_INICIAL + 250],
        ['2026-09-14', Date.UTC(2026, 8, 14, 6, 0, 0)], // solo fecha = medianoche de la sede
    ])('acepta %j', (texto, esperado) => {
        expect(parsearInstante(texto)).toBe(esperado);
    });

    it.each([
        '', 'hoy', '14/09/2026 07:12', '2026-9-14 07:12', '2026-02-31 10:00', '2026-13-01 10:00', '2026-09-14 24:00',
        '2026-09-14 07:60', '2026-09-14 07:12:60', '2026-09-14 07:12 pm', '2026-09-14 07:12-99', '2026-09-14 07:12+15',
        null, undefined, 20260914, {},
    ])('rechaza %j', (texto) => {
        expect(parsearInstante(texto)).toBeNull();
    });

    it('2028-02-29 existe (bisiesto) y 2026-02-29 no', () => {
        expect(parsearInstante('2028-02-29 10:00')).not.toBeNull();
        expect(parsearInstante('2026-02-29 10:00')).toBeNull();
    });
});

describe('estado inicial y reloj apagado', () => {
    it('sin archivo rige LOCAL_FAKE_NOW congelado y se entrega tal cual a PostgreSQL', () => {
        const e = leerReloj({ ahoraRealMs: T0 });
        expect(e).toMatchObject({ activo: true, corre: false, ms: MS_INICIAL, inicialMs: MS_INICIAL, valorSql: INICIAL });
        expect(valorRelojSql()).toBe(INICIAL);
        expect(relojDemoActivo()).toBe(true);
    });

    it.each([['', 'vacio'], ['off', "'off'"], ['OFF', "'OFF'"], ['   ', 'espacios']])(
        'LOCAL_FAKE_NOW %j (%s): apagado, sin valor para PostgreSQL y con la hora real',
        (valor) => {
            vi.stubEnv('LOCAL_FAKE_NOW', valor);
            const e = leerReloj({ ahoraRealMs: T0 });
            expect(e).toEqual({ activo: false, corre: false, ms: T0, inicialMs: null, valorSql: null });
            expect(valorRelojSql()).toBeNull();
            expect(relojDemoActivo()).toBe(false);
            expect(Math.abs(ahoraDeNegocio().getTime() - Date.now())).toBeLessThan(5000); // reloj real
        },
    );

    it('un LOCAL_FAKE_NOW ilegible apaga el reloj con un aviso (una sola vez)', async () => {
        vi.resetModules(); // el aviso se emite una vez por modulo: se parte de una instancia limpia
        const m = await import('./reloj.js');
        vi.stubEnv('LOCAL_FAKE_NOW', 'manana temprano');
        const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {});
        expect(m.valorRelojSql()).toBeNull();
        expect(m.valorRelojSql()).toBeNull();
        expect(aviso).toHaveBeenCalledOnce();
        expect(String(aviso.mock.calls[0][0])).toContain('LOCAL_FAKE_NOW');
    });

    it('un archivo de estado NO enciende un reloj apagado (estado viejo de otra demostracion)', () => {
        fs.mkdirSync(path.dirname(archivo), { recursive: true });
        fs.writeFileSync(archivo, '2026-09-20 10:00:00-06\n');
        vi.stubEnv('LOCAL_FAKE_NOW', 'off');
        expect(valorRelojSql()).toBeNull();
    });

    // lib/server/captura.js llama a relojDemoActivo() tambien en produccion: una LOCAL_FAKE_NOW olvidada (copiada de dev-all.sh o de
    // .env.local) no debe fechar las capturas con una hora fija ni ignorar la marca del cliente.
    it.each([
        ['NODE_ENV=production aunque SUSAN_LOCAL=1', { NODE_ENV: 'production', SUSAN_LOCAL: '1', NEXT_PUBLIC_SUSAN_LOCAL: '' }],
        ['sin SUSAN_LOCAL ni NEXT_PUBLIC_SUSAN_LOCAL', { SUSAN_LOCAL: '', NEXT_PUBLIC_SUSAN_LOCAL: '' }],
        ['produccion y sin modo local', { NODE_ENV: 'production', SUSAN_LOCAL: '', NEXT_PUBLIC_SUSAN_LOCAL: '' }],
    ])('fuera del modo local (%s) el reloj esta apagado aunque LOCAL_FAKE_NOW siga puesto', (_caso, entorno) => {
        for (const [clave, valor] of Object.entries(entorno)) vi.stubEnv(clave, valor);
        fs.mkdirSync(path.dirname(archivo), { recursive: true });
        fs.writeFileSync(archivo, '2026-09-20 10:00:00-06\n'); // ni siquiera con un archivo de estado
        expect(relojDemoActivo()).toBe(false);
        expect(valorRelojSql()).toBeNull();
        expect(leerReloj({ ahoraRealMs: T0 })).toEqual({ activo: false, corre: false, ms: T0, inicialMs: null, valorSql: null });
        expect(ahoraDeNegocio().getTime()).toBeGreaterThan(Date.UTC(2026, 9, 1)); // la hora real, no la de septiembre fijada
        expect(codigoDe(() => avanzarReloj(5))).toBe('RELOJ_NO_ACTIVO');
    });

    it('NEXT_PUBLIC_SUSAN_LOCAL=1 tambien cuenta como modo local (igual que IS_LOCAL)', () => {
        vi.stubEnv('SUSAN_LOCAL', '');
        vi.stubEnv('NEXT_PUBLIC_SUSAN_LOCAL', '1');
        expect(relojDemoActivo()).toBe(true);
        expect(valorRelojSql()).toBe(INICIAL);
    });

    it('las mutaciones con el reloj apagado fallan con RELOJ_NO_ACTIVO y no escriben', () => {
        vi.stubEnv('LOCAL_FAKE_NOW', 'off');
        for (const llamar of [() => avanzarReloj(5), () => fijarReloj('2026-09-14 08:00'), () => correrReloj(true), () => restablecerReloj()]) {
            expect(codigoDe(llamar)).toBe('RELOJ_NO_ACTIVO');
        }
        expect(fs.existsSync(archivo)).toBe(false);
    });
});

describe('avanzarReloj', () => {
    it('suma minutos, persiste en el archivo y la siguiente lectura lo ve', () => {
        const e = avanzarReloj(30, { ahoraRealMs: T0 });
        expect(horaDe(e)).toBe('07:42:00');
        expect(e.corre).toBe(false);
        expect(valorRelojSql()).toBe('2026-09-14 07:42:00-06');
        expect(fs.existsSync(archivo)).toBe(true);
        expect(JSON.parse(fs.readFileSync(archivo, 'utf8'))).toMatchObject({ baseMs: MS_INICIAL + 30 * MIN, anclaMs: null, legible: '2026-09-14 07:42:00-06' });
    });

    it('acumula saltos y admite negativos (volver atras)', () => {
        avanzarReloj(5, { ahoraRealMs: T0 });
        avanzarReloj(10, { ahoraRealMs: T0 });
        expect(horaDe(leerReloj())).toBe('07:27:00');
        avanzarReloj(-20, { ahoraRealMs: T0 });
        expect(horaDe(leerReloj())).toBe('07:07:00');
    });

    it('cruza de dia: +30 min desde las 23:50', () => {
        fijarReloj('2026-09-14 23:50', { ahoraRealMs: T0 });
        expect(partesSede(avanzarReloj(30, { ahoraRealMs: T0 }).ms)).toMatchObject({ fecha: '2026-09-15', hora: '00:20:00' });
    });

    it.each([0, 1.5, NaN, Infinity, '5', null, undefined, MAX_AVANCE_MIN + 1, -MAX_AVANCE_MIN - 1])('rechaza %j', (n) => {
        expect(codigoDe(() => avanzarReloj(n))).toBe('FUERA_DE_RANGO');
        expect(fs.existsSync(archivo)).toBe(false);
    });

    it('el limite exacto (una semana) si pasa', () => {
        expect(partesSede(avanzarReloj(MAX_AVANCE_MIN, { ahoraRealMs: T0 }).ms).fecha).toBe('2026-09-21');
    });

    it('no deja salir del rango 2000-2099', () => {
        fijarReloj('2099-12-31 23:00', { ahoraRealMs: T0 });
        expect(codigoDe(() => avanzarReloj(120, { ahoraRealMs: T0 }))).toBe('FUERA_DE_RANGO');
        expect(partesSede(leerReloj().ms).fecha).toBe('2099-12-31'); // sin cambio
    });
});

describe('fijarReloj', () => {
    it('fija en hora de la sede con o sin segundos y con T', () => {
        expect(horaDe(fijarReloj('2026-09-14 07:03', { ahoraRealMs: T0 }))).toBe('07:03:00');
        expect(horaDe(fijarReloj('2026-09-14T07:21:30', { ahoraRealMs: T0 }))).toBe('07:21:30');
        expect(valorRelojSql()).toBe('2026-09-14 07:21:30-06');
    });

    it('puede cambiar de dia (sesion de manana)', () => {
        expect(partesSede(fijarReloj('2026-09-15 06:55', { ahoraRealMs: T0 }).ms)).toMatchObject({ fecha: '2026-09-15', hora: '06:55:00' });
    });

    it.each(['', 'ayer', '2026-02-31 10:00', '2026-09-14 25:00', '2026-9-14 7:00', 5, null])('rechaza %j como FORMATO_INVALIDO', (texto) => {
        expect(codigoDe(() => fijarReloj(texto))).toBe('FORMATO_INVALIDO');
        expect(fs.existsSync(archivo)).toBe(false);
    });

    it.each(['1999-12-31 23:59', '2100-01-01 00:00'])('rechaza %s por salir de 2000-2099', (texto) => {
        expect(codigoDe(() => fijarReloj(texto))).toBe('FUERA_DE_RANGO');
    });
});

describe('restablecerReloj', () => {
    it('borra el archivo y vuelve a LOCAL_FAKE_NOW congelado (tambien si estaba corriendo)', () => {
        avanzarReloj(45, { ahoraRealMs: T0 });
        correrReloj(true, { ahoraRealMs: T0 });
        const e = restablecerReloj({ ahoraRealMs: T0 });
        expect(e).toMatchObject({ activo: true, corre: false, ms: MS_INICIAL, valorSql: INICIAL });
        expect(fs.existsSync(archivo)).toBe(false);
    });

    it('es idempotente: restablecer sin archivo no falla', () => {
        expect(() => restablecerReloj()).not.toThrow();
        expect(() => restablecerReloj()).not.toThrow();
    });
});

describe('modo corriendo', () => {
    it('correr(true) echa a andar desde el instante actual y avanza con el reloj real', () => {
        const e0 = correrReloj(true, { ahoraRealMs: T0 });
        expect(e0).toMatchObject({ corre: true, ms: MS_INICIAL });
        const e1 = leerReloj({ ahoraRealMs: T0 + 90_000 });
        expect(e1.ms).toBe(MS_INICIAL + 90_000);
        expect(horaDe(e1)).toBe('07:13:30');
        // lo que ve PostgreSQL es el instante vivo, con milisegundos si hacen falta
        expect(leerReloj({ ahoraRealMs: T0 + 90_250 }).valorSql).toBe('2026-09-14 07:13:30.250-06');
    });

    it('correr(false) congela en el instante al que habia llegado', () => {
        correrReloj(true, { ahoraRealMs: T0 });
        const e = correrReloj(false, { ahoraRealMs: T0 + 5 * MIN });
        expect(e).toMatchObject({ corre: false, ms: MS_INICIAL + 5 * MIN });
        expect(leerReloj({ ahoraRealMs: T0 + 60 * MIN }).ms).toBe(MS_INICIAL + 5 * MIN);
    });

    it('avanzar y fijar conservan el modo: si corre, sigue corriendo desde el nuevo instante', () => {
        correrReloj(true, { ahoraRealMs: T0 });
        const a = avanzarReloj(10, { ahoraRealMs: T0 + MIN });
        expect(a).toMatchObject({ corre: true, ms: MS_INICIAL + MIN + 10 * MIN });
        expect(leerReloj({ ahoraRealMs: T0 + 2 * MIN }).ms).toBe(MS_INICIAL + 12 * MIN);
        const f = fijarReloj('2026-09-14 07:00', { ahoraRealMs: T0 + 3 * MIN });
        expect(f).toMatchObject({ corre: true, ms: parsearInstante('2026-09-14 07:00') });
        expect(leerReloj({ ahoraRealMs: T0 + 4 * MIN }).ms).toBe(parsearInstante('2026-09-14 07:00') + MIN);
    });

    it('si el reloj real retrocede (ajuste del sistema) no hace retroceder la simulacion', () => {
        correrReloj(true, { ahoraRealMs: T0 });
        expect(leerReloj({ ahoraRealMs: T0 - 10 * MIN }).ms).toBe(MS_INICIAL);
    });
});

describe('archivo de estado', () => {
    it('acepta una fecha en texto plano escrita a mano y la lee al cambiar el mtime', () => {
        fs.mkdirSync(path.dirname(archivo), { recursive: true });
        fs.writeFileSync(archivo, '2026-09-14 07:03:00-06\n');
        expect(valorRelojSql()).toBe('2026-09-14 07:03:00-06');
        const antes = fs.statSync(archivo);
        fs.writeFileSync(archivo, '2026-09-14 07:25:00-06\n');
        // Algunos sistemas de archivos redondean el mtime: se fuerza para que la prueba no dependa de eso.
        fs.utimesSync(archivo, new Date(antes.mtimeMs + 5000), new Date(antes.mtimeMs + 5000));
        expect(valorRelojSql()).toBe('2026-09-14 07:25:00-06');
    });

    it('un archivo corrupto, vacio o con una fecha imposible se ignora y rige el valor inicial', () => {
        fs.mkdirSync(path.dirname(archivo), { recursive: true });
        const malos = ['{no es json', '', '   \n', '{"baseMs":"x"}', '{"baseMs":1}', '2026-02-31 10:00', '{"baseMs":1789000000000,"anclaMs":"hola"}'];
        malos.forEach((contenido, i) => {
            fs.writeFileSync(archivo, contenido);
            // mtime distinto en cada vuelta: invalida el cache aunque el sistema de archivos redondee
            const t = new Date(Date.UTC(2030, 0, 1) + i * 10_000);
            fs.utimesSync(archivo, t, t);
            expect(valorRelojSql(), JSON.stringify(contenido)).toBe(INICIAL);
        });
    });

    it('no vuelve a leer el archivo mientras no cambie (cache por inodo, mtime y tamano)', () => {
        avanzarReloj(5, { ahoraRealMs: T0 });
        valorRelojSql(); // llena el cache
        const lectura = vi.spyOn(fs, 'readFileSync');
        for (let i = 0; i < 20; i++) valorRelojSql();
        expect(lectura).not.toHaveBeenCalled();
        // una escritura de este modulo (inodo nuevo) si invalida el cache
        avanzarReloj(5, { ahoraRealMs: T0 });
        expect(valorRelojSql()).toBe('2026-09-14 07:22:00-06');
        expect(lectura).toHaveBeenCalledTimes(1);
    });

    it('la escritura es atomica: no deja archivos temporales', () => {
        avanzarReloj(5, { ahoraRealMs: T0 });
        correrReloj(true, { ahoraRealMs: T0 });
        expect(fs.readdirSync(path.dirname(archivo))).toEqual(['fake_now']);
    });

    it('crea el directorio run/ si no existe', () => {
        expect(fs.existsSync(path.dirname(archivo))).toBe(false);
        avanzarReloj(5, { ahoraRealMs: T0 });
        expect(fs.existsSync(archivo)).toBe(true);
    });
});

describe('rutaArchivoReloj', () => {
    it('LOCAL_CLOCK_FILE manda; luego SUSAN_LOCAL_DIR/run/fake_now; luego el padre del storage', () => {
        expect(rutaArchivoReloj()).toBe(archivo);
        vi.stubEnv('LOCAL_CLOCK_FILE', '');
        vi.stubEnv('SUSAN_LOCAL_DIR', '/datos/susan');
        expect(rutaArchivoReloj()).toBe(path.resolve('/datos/susan', 'run', 'fake_now'));
        vi.stubEnv('SUSAN_LOCAL_DIR', '');
        vi.stubEnv('LOCAL_STORAGE_DIR', '/otro/susan/storage');
        expect(rutaArchivoReloj()).toBe(path.resolve('/otro/susan', 'run', 'fake_now'));
    });
});

describe('describirReloj y ahoraDeNegocio', () => {
    it('describe { activo, corre, ahora (ISO con zona), fecha, hora, inicial }', () => {
        expect(describirReloj(leerReloj({ ahoraRealMs: T0 }))).toEqual({
            activo: true,
            corre: false,
            ahora: '2026-09-14T07:12:00-06:00',
            fecha: '2026-09-14',
            hora: '07:12:00',
            inicial: '2026-09-14T07:12:00-06:00',
        });
        avanzarReloj(30, { ahoraRealMs: T0 });
        expect(describirReloj()).toMatchObject({ ahora: '2026-09-14T07:42:00-06:00', hora: '07:42:00', inicial: '2026-09-14T07:12:00-06:00' });
    });

    it('apagado: muestra la hora real de la sede y sin inicial', () => {
        vi.stubEnv('LOCAL_FAKE_NOW', 'off');
        expect(describirReloj(leerReloj({ ahoraRealMs: T0 }))).toMatchObject({ activo: false, inicial: null, ahora: formatearIso(T0) });
    });

    it('ahoraDeNegocio entrega la hora simulada como Date', () => {
        expect(ahoraDeNegocio().toISOString()).toBe('2026-09-14T13:12:00.000Z');
        avanzarReloj(5);
        expect(ahoraDeNegocio().toISOString()).toBe('2026-09-14T13:17:00.000Z');
    });
});
