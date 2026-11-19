// Prueba de extremo a extremo por un PUERTO SERIE VIRTUAL (pseudo-terminales).
//
// socat crea dos pty enlazados. El puente real (con el paquete `serialport`) abre
// uno; este archivo abre el otro con `serialport` y hace de "estación": manda
// HELLO/UID y comprueba lo que contesta el puente. Así se ejercita el camino real
// del sistema operativo (termios, 115200 8N1, lectura/escritura asíncrona,
// cierre con Ctrl+C) SIN placa. No sustituye la prueba con el Arduino físico.
// Requiere Linux, `socat` y `serialport` (ver README); si falta algo, se omite.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

import { EnsambladorLineas, lineaValidaParaEstacion } from '../puente-serial.mjs';

const RAIZ = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const PAQUETE = path.join(RAIZ, 'tools', 'node_modules', 'serialport');
const hayPaquete = existsSync(PAQUETE);
const haySocat = spawnSync('socat', ['-V'], { stdio: 'ignore' }).status === 0;
const omitir = !hayPaquete ? 'serialport no está instalado' : !haySocat ? 'socat no está instalado' : false;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

async function esperarCon(fn, ms, descripcion) {
    const limite = Date.now() + ms;
    for (;;) {
        const r = fn();
        if (r) return r;
        if (Date.now() > limite) throw new Error(`tiempo agotado esperando: ${descripcion}`);
        await dormir(20);
    }
}

test('puente real <-> estación virtual por pty', { skip: omitir, timeout: 90000 }, async (t) => {
    const { SerialPort } = createRequire(import.meta.url)(PAQUETE);

    const socat = spawn('socat', ['-d', '-d', 'pty,raw,echo=0', 'pty,raw,echo=0'], { stdio: ['ignore', 'ignore', 'pipe'] });
    t.after(() => socat.kill());
    const rutas = [];
    socat.stderr.setEncoding('utf8');
    socat.stderr.on('data', (d) => {
        for (const m of d.matchAll(/PTY is (\/dev\/pts\/\d+)/g)) rutas.push(m[1]);
    });
    await esperarCon(() => rutas.length >= 2, 5000, 'que socat cree los dos pty');

    // La "estación": lado B del par.
    const estacion = new SerialPort({ path: rutas[1], baudRate: 115200 });
    await new Promise((resolver, rechazar) => estacion.once('open', resolver).once('error', rechazar));
    t.after(() => estacion.isOpen && estacion.close());
    const ensamblador = new EnsambladorLineas();
    const recibidas = [];
    estacion.on('data', (d) => recibidas.push(...ensamblador.push(d)));
    const mandar = (texto) => new Promise((resolver, rechazar) => estacion.write(texto, (e) => (e ? rechazar(e) : resolver())));
    const hay = (linea) => recibidas.includes(linea);

    // El puente: lado A. Se abre DESPUÉS de la estación, como hace el UNO al reiniciarse.
    const puente = spawn(process.execPath, [path.join(RAIZ, 'puente-serial.mjs'), '--puerto', rutas[0]], { stdio: ['ignore', 'pipe', 'pipe'] });
    t.after(() => puente.kill('SIGKILL'));
    let salida = '';
    puente.stdout.setEncoding('utf8');
    puente.stdout.on('data', (d) => { salida += d; });
    await esperarCon(() => salida.includes('abierto a 115200 baudios (8N1)'), 8000, 'que el puente abra el puerto');

    await mandar('HELLO estacion-aula 1.0\n');
    await esperarCon(() => hay('SES 3o N|Programacion Ava|0/30'), 4000, 'SES tras el HELLO');

    await mandar('UID 04DE0001\n');
    await esperarCon(() => hay('RES OK Ana Demo'), 4000, 'RES OK');
    await esperarCon(() => hay('SES 3o N|Programacion Ava|1/30'), 4000, 'SES actualizado (1/30)');

    await mandar('UID 04DE0001\n');                       // rebote: sin respuesta
    await dormir(400);
    assert.equal(recibidas.filter((l) => l.startsWith('RES ')).length, 1);

    await dormir(2000);                                    // ya pasó la ventana de 2 s
    await mandar('UID 04DE0001\n');
    await esperarCon(() => hay('RES DUP Ana Demo'), 4000, 'RES DUP');

    await mandar('UID DEADBEEF\n');
    await esperarCon(() => hay('RES NOREG'), 4000, 'RES NOREG');

    await mandar(`${'x'.repeat(100)}\nREBOOT\nÿþ\n`);   // ruido: el puente debe seguir vivo
    await mandar('UID 04DE0002\n');
    await esperarCon(() => hay('RES OK Luis Demo'), 4000, 'RES OK tras el ruido');

    await mandar('BTN\n');
    await mandar('PONG\n');
    await dormir(200);

    // Todo lo que llegó a la "estación" cumple el protocolo.
    assert.ok(recibidas.length >= 7, `líneas recibidas: ${recibidas.length}`);
    assert.deepEqual(recibidas.filter((l) => !lineaValidaParaEstacion(l)), []);
    assert.ok(salida.includes('[STUB] registrarPresencia'));
    assert.ok(!salida.includes('DEMO0001'), 'sin matrículas completas en el registro');

    // Ctrl+C cierra limpio.
    const codigo = new Promise((r) => puente.once('exit', (c) => r(c)));
    puente.kill('SIGINT');
    assert.equal(await codigo, 0);
});
