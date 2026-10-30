// Pruebas del puente serie con node:test (sin hardware ni el paquete serialport).
// Se ejercita el puente completo contra DispositivoSimulado y se usan temporizadores
// falsos (mock.timers) para la regla de los 30 s y el latido.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, mock, test } from 'node:test';
import { fileURLToPath } from 'node:url';

import {
    ANTIREBOTE_UID_MS,
    DispositivoSimulado,
    EnsambladorLineas,
    LATIDO_MS,
    Puente,
    SILENCIO_ESTACION_MS,
    ajustar,
    analizarLinea,
    armarRes,
    armarSes,
    cargarCredenciales,
    cargarCredencialesDeArchivo,
    enmascararMatricula,
    enmascararUid,
    lineaValidaParaEstacion,
    transliterar,
} from '../puente-serial.mjs';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.join(AQUI, '..');
const UID_A = '04DE0001';
const UID_B = '04DE0002';

const credencialesDemo = () => cargarCredencialesDeArchivo(path.join(RAIZ, 'credenciales-demo.csv')).mapa;
const sesionAbierta = () => ({ abierta: true, grupo: '3° N', materia: 'Programación Avanzada', total: 30, presentes: [] });

// Deja correr las promesas pendientes (los temporizadores falsos no tocan setImmediate).
const asentar = async () => {
    for (let i = 0; i < 5; i++) await new Promise((r) => setImmediate(r));
};

function montar(opciones = {}) {
    const registros = [];
    const llamadas = [];
    const dispositivo = new DispositivoSimulado();
    const puente = new Puente({
        credenciales: credencialesDemo(),
        sesion: sesionAbierta(),
        registrar: async (matricula) => {
            llamadas.push(matricula);
            return { ok: true };
        },
        log: (nivel, mensaje) => registros.push(`${nivel}: ${mensaje}`),
        ...opciones,
    });
    puente.adjuntar(dispositivo);
    return { puente, dispositivo, registros, llamadas };
}

const respuestas = (d) => d.recibido.filter((l) => l.startsWith('RES '));

afterEach(() => mock.timers.reset());

describe('texto', () => {
    test('transliterar quita acentos y lo no representable pasa a ?', () => {
        assert.equal(transliterar('Programación Avanzada'), 'Programacion Avanzada');
        assert.equal(transliterar('Niño Ñandú Über'), 'Nino Nandu Uber');
        assert.equal(transliterar('¿Qué? ¡Sí!'), '?Que? !Si!');
        assert.equal(transliterar('3° N'), '3o N');
        assert.equal(transliterar('a€b'), 'a?b');
        assert.equal(transliterar('a😀b'), 'a?b');
        assert.equal(transliterar('a|b'), 'a/b');
        assert.equal(transliterar('a\tb\nc'), 'a?b?c');
    });

    test('ajustar recorta a 16 columnas sin espacios en los extremos', () => {
        assert.equal(ajustar('  Programación Avanzada Integral  '), 'Programacion Ava');
        assert.equal(ajustar('Grupo muy largo de verdad'), 'Grupo muy largo');
        assert.equal(ajustar(''), '');
        assert.equal(ajustar(null), '');
        assert.equal(ajustar('0123456789ABCDEFG', 16).length, 16);
    });

    test('enmascarar UID y matrícula', () => {
        assert.equal(enmascararUid('04DE0001'), '****0001');
        assert.equal(enmascararMatricula('DEMO0001'), '***001');
    });
});

describe('líneas de la estación', () => {
    test('analizarLinea reconoce HELLO, UID, BTN y PONG', () => {
        assert.deepEqual(analizarLinea('HELLO estacion-aula 1.0'), { tipo: 'HELLO', version: '1.0' });
        assert.deepEqual(analizarLinea('UID 04A1B2C3'), { tipo: 'UID', uid: '04A1B2C3' });
        assert.deepEqual(analizarLinea('UID 04A1B2C3D4E5F6'), { tipo: 'UID', uid: '04A1B2C3D4E5F6' });
        assert.equal(analizarLinea('UID 0102030405060708090A').tipo, 'UID');
        assert.deepEqual(analizarLinea('BTN'), { tipo: 'BTN' });
        assert.deepEqual(analizarLinea('PONG'), { tipo: 'PONG' });
    });

    test('analizarLinea descarta lo mal formado', () => {
        for (const mala of ['', 'UID', 'UID 04a1b2c3', 'UID 04A1B2', 'UID 04A1B2C3Z', 'UID 04A1B2C3 ', 'UID  04A1B2C3',
            'BTN ', 'btn', 'PONG!', 'HELLO', 'HELLO estacion-aula', 'HELLO otra-cosa 1.0', 'UID 123456789', 'basura']) {
            assert.equal(analizarLinea(mala).tipo, 'DESCONOCIDA', mala);
        }
    });

    test('el ensamblador une trozos, tolera CRLF y descarta líneas de más de 64 bytes', () => {
        const e = new EnsambladorLineas();
        assert.deepEqual(e.push('UID 04DE'), []);
        assert.deepEqual(e.push('0001\r\nBT'), ['UID 04DE0001']);
        assert.deepEqual(e.push(Buffer.from('N\n\n\nPONG\n')), ['BTN', 'PONG']);
        assert.deepEqual(e.push(`${'x'.repeat(64)}\n`), ['x'.repeat(64)]);
        assert.deepEqual(e.push(`${'y'.repeat(65)}\nPONG\n`), ['PONG']);
        assert.equal(e.descartadas, 1);
        assert.deepEqual(e.push(Buffer.from([0x50, 0xff, 0x0a, 0x42, 0x54, 0x4e, 0x0a])), ['BTN']); // byte no ASCII
        assert.equal(e.descartadas, 2);
    });

    test('un flujo sin salto de línea no acumula memoria sin límite', () => {
        const e = new EnsambladorLineas();
        for (let i = 0; i < 1000; i++) e.push('z'.repeat(1000));
        assert.ok(e.actual.length <= 64);
        assert.deepEqual(e.push('\nPONG\n'), ['PONG']);
    });
});

describe('líneas hacia la estación', () => {
    test('armarSes ajusta, transliera y marca sin sesión con campos vacíos', () => {
        assert.equal(armarSes({ abierta: true, grupo: '3° N', materia: 'Programación Avanzada', total: 30, presentes: new Set(['a', 'b']) }),
            'SES 3o N|Programacion Ava|2/30');
        assert.equal(armarSes({ abierta: false }), 'SES ||0/0');
        assert.equal(armarSes({ abierta: true, grupo: '', materia: '', total: 5, presentes: new Set() }), 'SES -||0/5');
        assert.equal(armarSes({ abierta: true, grupo: 'A|B', materia: 'M', total: 99999999, presentes: new Set() }), 'SES A/B|M|0/65535');
    });

    test('armarRes', () => {
        assert.equal(armarRes('OK', 'Ana Demo'), 'RES OK Ana Demo');
        assert.equal(armarRes('NOREG'), 'RES NOREG');
        assert.equal(armarRes('OK', 'José Ñandú Larguísimo Apellido'), 'RES OK Jose Nandu Largu');
        assert.equal(armarRes('ERR', 'Sin sesion abierta'), 'RES ERR Sin sesion abier');
    });

    test('lineaValidaParaEstacion', () => {
        for (const ok of ['PING', 'SES a|b|1/2', 'SES ||0/0', 'RES OK', 'RES OK Ana', 'RES DUP Ana', 'RES NOREG', 'RES ERR', 'RES ERR motivo']) {
            assert.ok(lineaValidaParaEstacion(ok), ok);
        }
        for (const mala of ['', 'ping', 'SES a|b', 'SES a|b|c', 'SES a|b|1/2/3', 'SES a|b|c|1/2', 'RES', 'RES XX', 'RES OKAY', 'CLOSE', 'cerrar sesion',
            'RES OK é', `RES OK ${'x'.repeat(60)}`, 'PING\n']) {
            assert.ok(!lineaValidaParaEstacion(mala), JSON.stringify(mala));
        }
    });
});

describe('credenciales', () => {
    test('el CSV de demostración trae 3 filas ficticias', () => {
        const { mapa, avisos } = cargarCredencialesDeArchivo(path.join(RAIZ, 'credenciales-demo.csv'));
        assert.equal(mapa.size, 3);
        assert.deepEqual(avisos, []);
        assert.deepEqual(mapa.get('04DE0001'), { matricula: 'DEMO0001', nombreCorto: 'Ana Demo' });
        for (const { matricula } of mapa.values()) assert.match(matricula, /^DEMO/);
    });

    test('filas inválidas y repetidas se avisan sin romper la carga', () => {
        const { mapa, avisos } = cargarCredenciales([
            '# comentario', '', 'UID,matricula,nombre_corto',
            '04aa0001, M1 , Uno ',    // minúsculas y espacios: se normalizan
            '04AA0002,M2',            // faltan campos
            'XYZ,M3,Tres',            // UID no hexadecimal
            '04AA0004,M4,',           // nombre vacío
            '04AA0001,M5,Repetido',   // UID repetido: no sobrescribe
            '0102030405060708090A,M6,Seis',
        ].join('\n'));
        assert.equal(mapa.size, 2);
        assert.deepEqual(mapa.get('04AA0001'), { matricula: 'M1', nombreCorto: 'Uno' });
        assert.equal(avisos.length, 4);
    });
});

describe('flujo con la estación simulada', () => {
    test('HELLO provoca el envío de SES', () => {
        const { dispositivo } = montar();
        dispositivo.arrancar();
        assert.deepEqual(dispositivo.recibido, ['SES 3o N|Programacion Ava|0/30']);
    });

    test('tarjeta conocida: registra una vez, responde RES OK y actualiza SES', async () => {
        const { dispositivo, llamadas, puente } = montar();
        dispositivo.arrancar();
        dispositivo.tocarTarjeta(UID_A);
        await asentar();
        assert.deepEqual(llamadas, ['DEMO0001']);
        assert.deepEqual(respuestas(dispositivo), ['RES OK Ana Demo']);
        assert.equal(dispositivo.recibido.at(-1), 'SES 3o N|Programacion Ava|1/30');
        assert.equal(puente.sesion.presentes.size, 1);
    });

    test('tarjeta ya registrada: RES DUP y no vuelve a llamar al registro', async () => {
        const t = mock.timers;
        t.enable({ apis: ['Date', 'setTimeout', 'setInterval'] });
        const { dispositivo, llamadas } = montar();
        dispositivo.arrancar();
        dispositivo.tocarTarjeta(UID_A);
        await asentar();
        t.tick(ANTIREBOTE_UID_MS);          // pasó la ventana de antirrebote
        dispositivo.tocarTarjeta(UID_A);
        await asentar();
        assert.deepEqual(respuestas(dispositivo), ['RES OK Ana Demo', 'RES DUP Ana Demo']);
        assert.equal(llamadas.length, 1);
    });

    test('la misma tarjeta dentro de 2 s se ignora (sin respuesta, sin registro)', async () => {
        mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'] });
        const { dispositivo, llamadas } = montar();
        dispositivo.arrancar();
        dispositivo.tocarTarjeta(UID_A);
        await asentar();
        mock.timers.tick(ANTIREBOTE_UID_MS - 1);
        dispositivo.tocarTarjeta(UID_A);
        dispositivo.tocarTarjeta(UID_A);
        await asentar();
        assert.deepEqual(respuestas(dispositivo), ['RES OK Ana Demo']);
        assert.equal(llamadas.length, 1);
        mock.timers.tick(1);                 // a los 2000 ms exactos ya cuenta
        dispositivo.tocarTarjeta(UID_A);
        await asentar();
        assert.deepEqual(respuestas(dispositivo), ['RES OK Ana Demo', 'RES DUP Ana Demo']);
    });

    test('el rebote de un UID no bloquea a otro alumno', async () => {
        const { dispositivo, llamadas } = montar();
        dispositivo.arrancar();
        dispositivo.tocarTarjeta(UID_A);
        dispositivo.tocarTarjeta(UID_B);
        await asentar();
        assert.deepEqual(llamadas, ['DEMO0001', 'DEMO0002']);
    });

    test('UID desconocido: RES NOREG, sin registrar', async () => {
        const { dispositivo, llamadas } = montar();
        dispositivo.arrancar();
        dispositivo.tocarTarjeta('DEADBEEF');
        await asentar();
        assert.deepEqual(respuestas(dispositivo), ['RES NOREG']);
        assert.equal(llamadas.length, 0);
    });

    test('sin sesión abierta: RES ERR con motivo, sin registrar', async () => {
        const { dispositivo, llamadas } = montar({ sesion: { abierta: false } });
        dispositivo.arrancar();
        assert.equal(dispositivo.recibido[0], 'SES ||0/0');
        dispositivo.tocarTarjeta(UID_A);
        await asentar();
        assert.deepEqual(respuestas(dispositivo), ['RES ERR Sin sesion abier']);
        assert.equal(llamadas.length, 0);
    });

    test('si el registro falla o no se confirma: RES ERR y no cuenta como presente', async () => {
        for (const registrar of [async () => { throw new Error('sin red'); }, async () => ({ ok: false }), async () => undefined]) {
            const { dispositivo, puente } = montar({ registrar });
            dispositivo.arrancar();
            dispositivo.tocarTarjeta(UID_A);
            await asentar();
            assert.deepEqual(respuestas(dispositivo), ['RES ERR']);
            assert.equal(puente.sesion.presentes.size, 0);
        }
    });

    test('dos lecturas simultáneas del mismo alumno con tarjetas distintas registran una sola vez', async () => {
        const credenciales = credencialesDemo();
        credenciales.set('04DE00FF', { matricula: 'DEMO0001', nombreCorto: 'Ana Demo' }); // segunda tarjeta de Ana
        let liberar;
        const llamadas = [];
        const registrar = (m) => new Promise((resolver) => {
            llamadas.push(m);
            liberar = () => resolver({ ok: true });
        });
        const { dispositivo } = montar({ credenciales, registrar });
        dispositivo.arrancar();
        dispositivo.tocarTarjeta(UID_A);
        dispositivo.tocarTarjeta('04DE00FF');
        await asentar();
        liberar();
        await asentar();
        assert.equal(llamadas.length, 1);
        assert.deepEqual(respuestas(dispositivo), ['RES DUP Ana Demo', 'RES OK Ana Demo']);
    });

    test('BTN solo se registra: no hay respuesta ni cambio de sesión', async () => {
        const { dispositivo, puente, registros } = montar();
        dispositivo.arrancar();
        const antes = dispositivo.recibido.length;
        dispositivo.pulsarBoton();
        await asentar();
        assert.equal(dispositivo.recibido.length, antes);
        assert.equal(puente.sesion.abierta, true);
        assert.ok(registros.some((r) => r.includes('BTN')));
    });

    test('líneas desconocidas, basura y demasiado largas se ignoran sin romper nada', async () => {
        const { dispositivo, registros } = montar();
        dispositivo.arrancar();
        const antes = dispositivo.recibido.length;
        for (const mala of ['', 'ola', 'UID', 'UID zzzz', 'REBOOT', 'x'.repeat(200)]) dispositivo.emitir(mala);
        dispositivo.emit('data', Buffer.from([0xff, 0xfe, 0x00, 0x0a]));
        await asentar();
        assert.equal(dispositivo.recibido.length, antes);
        assert.ok(registros.some((r) => r.includes('descartada')));
        dispositivo.tocarTarjeta(UID_A);
        await asentar();
        assert.deepEqual(respuestas(dispositivo), ['RES OK Ana Demo']); // y sigue funcionando
    });

    test('un UID partido en trozos del puerto se reensambla', async () => {
        const { dispositivo } = montar();
        dispositivo.arrancar();
        dispositivo.emit('data', Buffer.from('UID 04'));
        dispositivo.emit('data', Buffer.from('DE00'));
        dispositivo.emit('data', Buffer.from('01\n'));
        await asentar();
        assert.deepEqual(respuestas(dispositivo), ['RES OK Ana Demo']);
    });

    test('cerrar y abrir la sesión se refleja en SES', () => {
        const { dispositivo, puente } = montar();
        dispositivo.arrancar();
        puente.fijarSesionAbierta(false);
        puente.fijarSesionAbierta(true);
        assert.deepEqual(dispositivo.recibido.slice(-2), ['SES ||0/0', 'SES 3o N|Programacion Ava|0/30']);
    });

    test('todo lo que el puente escribió cumple el protocolo', async () => {
        const { dispositivo } = montar();
        dispositivo.arrancar();
        for (const uid of [UID_A, UID_A, UID_B, 'DEADBEEF']) {
            dispositivo.tocarTarjeta(uid);
            await asentar();
        }
        assert.ok(dispositivo.recibido.length > 5);
        assert.deepEqual(dispositivo.violaciones, []);
    });

    test('el registro (stub) recibe la matrícula y solo informa', async () => {
        const { registrarPresencia } = await import('../puente-serial.mjs');
        const mensajes = [];
        const r = await registrarPresencia('DEMO0001', { log: (n, m) => mensajes.push(m) });
        assert.deepEqual(r, { ok: true, simulado: true });
        assert.match(mensajes[0], /STUB/);
        assert.match(mensajes[0], /NO se escribe en la base de datos/);
    });
});

describe('privacidad de los registros', () => {
    test('por omisión no aparecen UID, matrícula ni nombre completos', async () => {
        const { dispositivo, registros } = montar();
        dispositivo.arrancar();
        dispositivo.tocarTarjeta(UID_A);
        dispositivo.tocarTarjeta('DEADBEEF');
        await asentar();
        const todo = registros.join('\n');
        assert.ok(!todo.includes('04DE0001'));
        assert.ok(!todo.includes('DEADBEEF'));
        assert.ok(!todo.includes('DEMO0001'));
        assert.ok(!todo.includes('Ana Demo'));
        assert.ok(todo.includes('****0001'));
    });

    test('--verboso (solo datos ficticios) sí los muestra', async () => {
        const { dispositivo, registros } = montar({ verboso: true });
        dispositivo.arrancar();
        dispositivo.tocarTarjeta(UID_A);
        await asentar();
        assert.ok(registros.join('\n').includes('04DE0001'));
    });
});

describe('tiempos con temporizadores falsos', () => {
    test('latido: PING y SES cada 10 s', () => {
        mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'] });
        const { puente, dispositivo } = montar();
        puente.iniciar();
        dispositivo.arrancar();
        dispositivo.recibido.length = 0;
        mock.timers.tick(LATIDO_MS);
        assert.deepEqual(dispositivo.recibido, ['PING', 'SES 3o N|Programacion Ava|0/30']);
        mock.timers.tick(LATIDO_MS);
        assert.equal(dispositivo.recibido.filter((l) => l === 'PING').length, 2);
        puente.detener();
    });

    test('si no llega HELLO en 3 s se sincroniza igualmente', () => {
        mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'] });
        const { puente, dispositivo, registros } = montar();
        puente.iniciar();
        mock.timers.tick(2999);
        assert.deepEqual(dispositivo.recibido, []);
        mock.timers.tick(1);
        assert.deepEqual(dispositivo.recibido, ['PING', 'SES 3o N|Programacion Ava|0/30']);
        assert.ok(registros.some((r) => r.includes('no llegó HELLO')));
        puente.detener();
    });

    test('30 s sin que la estación diga nada: enlace perdido; vuelve al recibir un PONG', () => {
        mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'] });
        const { puente, dispositivo, registros } = montar();
        const eventos = [];
        puente.on('enlace', (e) => eventos.push(e));
        puente.iniciar();
        dispositivo.arrancar();                       // t = 0: HELLO
        assert.equal(puente.enlace, 'ok');
        dispositivo.silenciar(true);                  // se "desconecta el cable"
        mock.timers.tick(SILENCIO_ESTACION_MS - 1);
        assert.equal(puente.enlace, 'ok');            // 29,999 s: todavía conectada
        mock.timers.tick(1);
        assert.equal(puente.enlace, 'perdido');       // 30 s exactos
        assert.deepEqual(eventos, ['ok', 'perdido']);
        assert.ok(registros.some((r) => r.includes('no responde desde hace 30 s')));
        // El latido no se detiene: sigue intentando.
        const pings = dispositivo.recibido.filter((l) => l === 'PING').length;
        mock.timers.tick(LATIDO_MS);
        assert.equal(dispositivo.recibido.filter((l) => l === 'PING').length, pings + 1);
        // Vuelve la comunicación.
        dispositivo.silenciar(false);
        dispositivo.recibido.length = 0;
        mock.timers.tick(LATIDO_MS);                  // el siguiente PING recibe PONG
        assert.equal(puente.enlace, 'ok');
        assert.deepEqual(eventos, ['ok', 'perdido', 'ok']);
        assert.ok(dispositivo.recibido.some((l) => l.startsWith('SES ')));
        puente.detener();
    });

    test('mientras la estación contesta los PING el enlace nunca se pierde', () => {
        mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'] });
        const { puente, dispositivo } = montar();
        puente.iniciar();
        dispositivo.arrancar();
        mock.timers.tick(5 * 60 * 1000);              // 5 minutos
        assert.equal(puente.enlace, 'ok');
        puente.detener();
    });

    test('si la estación nunca habla, a los 30 s desde el inicio el enlace es perdido', () => {
        mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'] });
        const { puente, dispositivo } = montar();
        dispositivo.silenciar(true);                  // la placa nunca contesta
        puente.iniciar();
        assert.equal(puente.enlace, 'esperando');
        mock.timers.tick(29999);
        assert.equal(puente.enlace, 'esperando');
        mock.timers.tick(1);
        assert.equal(puente.enlace, 'perdido');
        puente.detener();
    });

    test('detener() cancela todos los temporizadores', () => {
        mock.timers.enable({ apis: ['Date', 'setTimeout', 'setInterval'] });
        const { puente, dispositivo } = montar();
        puente.iniciar();
        puente.detener();
        mock.timers.tick(5 * 60 * 1000);
        assert.deepEqual(dispositivo.recibido, []);
    });
});

describe('línea de comandos', () => {
    const correr = (...args) => spawnSync(process.execPath, [path.join(RAIZ, 'puente-serial.mjs'), ...args], { encoding: 'utf8', timeout: 60000 });

    test('sin argumentos termina con código 2 y explica qué falta', () => {
        const r = correr();
        assert.equal(r.status, 2);
        assert.match(r.stderr, /--puerto|--simulado/);
    });

    test('--ayuda', () => {
        const r = correr('--ayuda');
        assert.equal(r.status, 0);
        assert.match(r.stdout, /--simulado --guion/);
    });

    test('opciones desconocidas y baud inválido', () => {
        assert.equal(correr('--no-existe').status, 2);
        assert.equal(correr('--puerto', 'X', '--baud', 'abc').status, 2);
        assert.equal(correr('--simulado', '--credenciales', '/no/existe.csv').status, 2);
    });

    test('--simulado --guion recorre el flujo completo y termina bien', () => {
        const r = correr('--simulado', '--guion');
        assert.equal(r.status, 0, r.stderr);
        for (const esperado of [
            'LED verde, 1 pitido corto | LCD: "Registrado" / "Ana Demo"',
            'repetido en menos de 2 s: ignorado',
            'LED ambar, 2 pitidos cortos | LCD: "Ya registrado" / "Ana Demo"',
            'LED rojo, 1 pitido largo | LCD: "Tarjeta no" / "registrada"',
            'el botón nunca cierra sesiones',
            'LED rojo parpadeando, sin sonido | LCD: "Error" / "Sin sesion abier"',
            'infracciones del protocolo: 0',
            '[STUB]',
        ]) {
            assert.ok(r.stdout.includes(esperado), `falta: ${esperado}\n${r.stdout}`);
        }
        assert.ok(!r.stdout.includes('DEMO0001'), 'no debe imprimir matrículas completas');
    });

    test('--listar no falla aunque no haya udevadm ni placas', { skip: !existsSync(path.join(RAIZ, 'tools', 'node_modules', 'serialport')) && 'serialport no está instalado' }, () => {
        const r = correr('--listar');
        assert.equal(r.status, 0, r.stderr);
        assert.match(r.stdout, /COM3/);
    });

    test('sin serialport instalado, abrir un puerto real da un mensaje claro', { skip: existsSync(path.join(RAIZ, 'tools', 'node_modules', 'serialport')) && 'serialport sí está instalado' }, () => {
        const r = correr('--puerto', '/dev/ttyACM0');
        assert.notEqual(r.status, 0);
    });
});
