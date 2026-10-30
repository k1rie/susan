#!/usr/bin/env node
// generar-circuito.mjs - Dibuja el esquema de conexión de la Estación de aula SUSAN.
//
// Escribe circuito.svg (vectorial) y circuito.png (>= 2400 px de ancho) con
// Playwright + Chromium. Antes de dibujar valida que el dibujo, pines.csv y
// bom.csv cuenten la misma historia: toda conexión de pines.csv se dibuja y
// viceversa, y todo componente dibujado está en bom.csv. Si algo no cuadra, se
// detiene con error (así el diagrama no se desvía de las tablas).
//
// Uso:  node circuito/generar-circuito.mjs [--sin-png] [--verificar] [--fecha AAAA-MM-DD]
// Playwright (solo para el PNG) se busca en circuito/tools/node_modules; instálelo
// sin tocar package.json:  npm install --no-save --prefix circuito/tools playwright@1.56.1
// y use los navegadores ya instalados (PLAYWRIGHT_BROWSERS_PATH); no ejecute
// `playwright install`.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const W = 2400;
const H = 1880;
const FUENTE = "'Liberation Sans', Arial, Helvetica, sans-serif";
const REV = 'A';

// Colores de cable: cada función del circuito tiene el suyo (ver la leyenda).
const COLOR = {
    v5: '#d92d20',
    v33: '#f97316',
    gnd: '#101828',
    sck: '#c79a00',
    mosi: '#1d70ef',
    miso: '#12a05c',
    ss: '#9333ea',
    rst: '#667085',
    sda: '#06a3c4',
    scl: '#e5469f',
    sal: '#0f9d8a',
    ent: '#8b5a2b',
};
const TINTA = '#101828';
const GRIS = '#667085';
const GRIS_CLARO = '#d0d5dd';
const BLOQUE = '#f2f4f7';
const PAPEL = '#ffffff';

// ------------------------------------------------------------------ lectura CSV
function leerCsv(ruta) {
    const texto = readFileSync(ruta, 'utf8').replace(/^﻿/, '');
    const filas = [];
    let campo = '';
    let fila = [];
    let comillas = false;
    for (let i = 0; i < texto.length; i++) {
        const c = texto[i];
        if (comillas) {
            if (c === '"' && texto[i + 1] === '"') { campo += '"'; i++; }
            else if (c === '"') comillas = false;
            else campo += c;
        } else if (c === '"') comillas = true;
        else if (c === ',') { fila.push(campo); campo = ''; }
        else if (c === '\n' || c === '\r') {
            if (c === '\r' && texto[i + 1] === '\n') i++;
            fila.push(campo); campo = '';
            if (fila.some((x) => x !== '')) filas.push(fila);
            fila = [];
        } else campo += c;
    }
    if (campo !== '' || fila.length) { fila.push(campo); filas.push(fila); }
    const [encabezado, ...datos] = filas;
    return datos.map((d) => Object.fromEntries(encabezado.map((h, i) => [h, d[i] ?? ''])));
}

// "R1-R4" -> R1,R2,R3,R4 ; "U1" -> U1
function expandirRefs(refs) {
    const m = /^([A-Z]+)(\d+)-\1(\d+)$/.exec(refs) ?? /^([A-Z]+)(\d+)-(\d+)$/.exec(refs);
    if (!m) return [refs];
    const salida = [];
    for (let n = Number(m[2]); n <= Number(m[3]); n++) salida.push(`${m[1]}${n}`);
    return salida;
}

// ------------------------------------------------------------------ dibujo
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function construir(fecha) {
    const capas = { bloques: [], cables: [], piezas: [], textos: [] };
    const conexiones = new Set();
    const refs = new Set();

    const txt = (x, y, s, { size = 20, weight = 400, anchor = 'start', fill = TINTA, halo = true, italic = false } = {}) => {
        const estilo = halo ? ' paint-order="stroke" stroke="#fff" stroke-width="7" stroke-linejoin="round"' : '';
        capas.textos.push(`<text x="${x}" y="${y}" font-size="${size}" font-weight="${weight}" text-anchor="${anchor}" fill="${fill}"${italic ? ' font-style="italic"' : ''}${estilo}>${esc(s)}</text>`);
    };
    const cable = (id, color, puntos, ancho = 5) => {
        if (id) conexiones.add(id);
        const d = puntos.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' ');
        capas.cables.push(`<path d="${d}" fill="none" stroke="${color}" stroke-width="${ancho}" stroke-linecap="round" stroke-linejoin="round"${id ? ` data-conexion="${id}"` : ''}/>`);
    };
    const punto = (x, y, color) => capas.piezas.push(`<circle cx="${x}" cy="${y}" r="6.5" fill="${color}"/>`);
    const pin = (x, y, color) => capas.piezas.push(`<circle cx="${x}" cy="${y}" r="8" fill="${PAPEL}" stroke="${color}" stroke-width="4"/>`);
    const flecha = (x, y, dir, color) => {
        const p = { izq: [[x - 10, y], [x + 8, y - 8], [x + 8, y + 8]], der: [[x + 10, y], [x - 8, y - 8], [x - 8, y + 8]] }[dir];
        capas.piezas.push(`<polygon points="${p.map((q) => q.join(',')).join(' ')}" fill="${color}"/>`);
    };
    const tierra = (x, y) => {
        capas.piezas.push(`<g stroke="${TINTA}" stroke-width="4" stroke-linecap="round">`
            + `<line x1="${x}" y1="${y}" x2="${x}" y2="${y + 10}"/>`
            + `<line x1="${x - 18}" y1="${y + 10}" x2="${x + 18}" y2="${y + 10}"/>`
            + `<line x1="${x - 11}" y1="${y + 18}" x2="${x + 11}" y2="${y + 18}"/>`
            + `<line x1="${x - 4}" y1="${y + 26}" x2="${x + 4}" y2="${y + 26}"/></g>`);
    };
    const resistorH = (ref, valor, x, y) => {
        refs.add(ref);
        capas.piezas.push(`<rect x="${x - 36}" y="${y - 13}" width="72" height="26" fill="${PAPEL}" stroke="${TINTA}" stroke-width="3.5"/>`);
        txt(x, y - 24, `${ref}  ${valor}`, { size: 21, weight: 700, anchor: 'middle' });
    };
    const resistorV = (ref, valor, x, y, lado = 'der') => {
        refs.add(ref);
        capas.piezas.push(`<rect x="${x - 13}" y="${y - 26}" width="26" height="52" fill="${PAPEL}" stroke="${TINTA}" stroke-width="3.5"/>`);
        txt(lado === 'der' ? x + 24 : x - 24, y + 7, `${ref}  ${valor}`, { size: 21, weight: 700, anchor: lado === 'der' ? 'start' : 'end' });
    };
    const led = (ref, x, y, relleno, nombre) => {
        refs.add(ref);
        capas.piezas.push(`<polygon points="${x},${y - 21} ${x},${y + 21} ${x + 40},${y}" fill="${relleno}" stroke="${TINTA}" stroke-width="3.5" stroke-linejoin="round"/>`
            + `<line x1="${x + 40}" y1="${y - 22}" x2="${x + 40}" y2="${y + 22}" stroke="${TINTA}" stroke-width="4.5"/>`
            + `<g stroke="${TINTA}" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round">`
            + `<path d="M${x + 6} ${y - 30} l14 -14 m-8 0 h8 v8"/><path d="M${x + 22} ${y - 26} l14 -14 m-8 0 h8 v8"/></g>`);
        txt(x + 20, y - 58, `${ref}  ${nombre}`, { size: 21, weight: 700, anchor: 'middle' });
        txt(x - 6, y + 38, 'A', { size: 16, fill: GRIS, anchor: 'end' });
        txt(x + 56, y + 38, 'K', { size: 16, fill: GRIS });
    };
    // Capacitor vertical. Si es polarizado, la placa recta es la positiva (se marca con +)
    // y la curva la negativa; `plusAbajo` decide de qué lado queda el positivo.
    const capacitorV = (ref, valor, x, y, { polar = false, plusAbajo = false, texto = 'der' } = {}) => {
        refs.add(ref);
        const yArriba = y - 8;
        const yAbajo = y + 8;
        const recta = (yy) => `<line x1="${x - 20}" y1="${yy}" x2="${x + 20}" y2="${yy}"/>`;
        const curva = (yy, sentido) => `<path d="M${x - 20} ${yy} Q${x} ${yy + sentido * 11} ${x + 20} ${yy}" fill="none"/>`;
        let placas;
        if (!polar) placas = recta(yArriba) + recta(yAbajo);
        else if (plusAbajo) placas = curva(yArriba, -1) + recta(yAbajo);
        else placas = recta(yArriba) + curva(yAbajo, 1);
        capas.piezas.push(`<g stroke="${TINTA}" stroke-width="4" stroke-linecap="round">${placas}</g>`);
        if (polar) txt(x - 30, (plusAbajo ? yAbajo : yArriba) + 8, '+', { size: 24, weight: 700, anchor: 'end' });
        txt(texto === 'der' ? x + 34 : x - 34, y + 7, `${ref}  ${valor}`, { size: 21, weight: 700, anchor: texto === 'der' ? 'start' : 'end' });
    };

    // ------------------------------------------------------- rejilla de filas
    const XM = 390;               // borde derecho de los módulos
    const XU = 1000;              // borde izquierdo del UNO
    const XD = 1400;              // borde derecho del UNO
    const filas = { ss: 300, sck: 420, mosi: 540, miso: 660, irq: 780, gndL: 900, rst: 1020, v33: 1140, gnd2: 1320, v5: 1410, sda: 1500, scl: 1590 };
    const der = { btn: 300, l1: 450, l2: 575, l3: 700, bz: 825, gndR: 950 };
    const XBUS = 1900;

    // ------------------------------------------------------------- bloques
    const bloque = (x, y, w, h, titulo, sub, ref) => {
        refs.add(ref);
        capas.bloques.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${BLOQUE}" stroke="${TINTA}" stroke-width="4"/>`);
        txt(x + w / 2, y + 44, titulo, { size: 28, weight: 700, anchor: 'middle', halo: false });
        txt(x + w / 2, y + 72, sub, { size: 19, fill: GRIS, anchor: 'middle', halo: false });
    };
    bloque(70, 200, 320, 1000, 'U2 · MFRC522', 'módulo RC522 · SPI · 3,3 V', 'U2');
    bloque(70, 1240, 320, 450, 'U3 · LCD 16×2', 'I2C · 0x27 / 0x3F', 'U3');
    bloque(XU, 200, 400, 1500, 'U1 · Arduino UNO R3', 'ATmega328P · 16 MHz · lógica de 5 V', 'U1');

    const etiquetaPin = (x, y, s, lado) => txt(lado === 'izq' ? x + 18 : x - 18, y + 7, s, { size: 22, weight: 700, anchor: lado === 'izq' ? 'start' : 'end', halo: false });
    // Pines del módulo MFRC522 (orden físico de la tira: SDA SCK MOSI MISO IRQ GND RST 3.3V).
    const pinesRc522 = [['SDA (SS)', filas.ss], ['SCK', filas.sck], ['MOSI', filas.mosi], ['MISO', filas.miso], ['IRQ', filas.irq], ['GND', filas.gndL], ['RST', filas.rst], ['3.3V', filas.v33]];
    for (const [n, y] of pinesRc522) etiquetaPin(XM, y, n, 'der');
    for (const [n, y] of [['GND', filas.gnd2], ['VCC', filas.v5], ['SDA', filas.sda], ['SCL', filas.scl]]) etiquetaPin(XM, y, n, 'der');
    // Pines del UNO, lado izquierdo (ordenados para no cruzar cables; no es la posición física).
    for (const [n, y] of [['D10 · SS', filas.ss], ['D13 · SCK', filas.sck], ['D11 · MOSI', filas.mosi], ['D12 · MISO', filas.miso], ['GND', filas.gndL], ['D9', filas.rst], ['3V3', filas.v33], ['GND', filas.gnd2], ['5V', filas.v5], ['A4 · SDA', filas.sda], ['A5 · SCL', filas.scl]]) {
        etiquetaPin(XU, y, n, 'izq');
    }
    for (const [n, y] of [['D2', der.btn], ['D5', der.l1], ['D6', der.l2], ['D7', der.l3], ['D8', der.bz], ['GND', der.gndR]]) etiquetaPin(XD, y, n, 'der');

    // USB y PC del docente.
    capas.bloques.push(`<rect x="1110" y="1610" width="180" height="70" rx="6" fill="#e4e7ec" stroke="${TINTA}" stroke-width="3.5"/>`);
    txt(1200, 1652, 'USB-B', { size: 26, weight: 700, anchor: 'middle', halo: false });
    capas.cables.push(`<path d="M1200 1680 L1200 1740" stroke="${TINTA}" stroke-width="6" fill="none" stroke-dasharray="14 8" stroke-linecap="round"/>`);
    capas.bloques.push(`<rect x="1000" y="1740" width="400" height="104" rx="12" fill="${PAPEL}" stroke="${TINTA}" stroke-width="4"/>`);
    txt(1200, 1780, 'PC del docente', { size: 26, weight: 700, anchor: 'middle', halo: false });
    txt(1200, 1812, 'serie 115200 8N1 + 5 V · puente-serial.mjs', { size: 19, fill: GRIS, anchor: 'middle', halo: false });
    txt(1216, 1722, '5 V + serie 115200', { size: 19, fill: GRIS });

    // ------------------------------------- SPI con divisores de tensión (lado izq.)
    const XN = 700;     // nodo de cada divisor
    const XR1 = 880;    // centro de la resistencia de arriba (serie)
    const divisor = (id, color, y, rAlta, rBaja) => {
        cable(id, color, [[XU, y], [XR1 + 36, y]]);
        cable(id, color, [[XR1 - 36, y], [XM, y]]);
        cable(id, color, [[XN, y], [XN, y + 20]]);
        cable(id, color, [[XN, y + 66], [XN, y + 74]]);
        resistorH(rAlta, '1 kΩ', XR1, y);
        capas.piezas.push(`<rect x="${XN - 13}" y="${y + 20}" width="26" height="46" fill="${PAPEL}" stroke="${TINTA}" stroke-width="3.5"/>`);
        refs.add(rBaja);
        txt(XN + 26, y + 49, `${rBaja}  2 kΩ`, { size: 21, weight: 700 });
        tierra(XN, y + 74);
        punto(XN, y, color);
        txt(960, y + 30, '5 V', { size: 20, fill: GRIS, anchor: 'middle' });
        txt(560, y + 30, '3,3 V', { size: 20, fill: GRIS, anchor: 'middle' });
        flecha(480, y, 'izq', color);
        pin(XM, y, color);
        pin(XU, y, color);
    };
    divisor('SPI-SS', COLOR.ss, filas.ss, 'R1', 'R5');
    divisor('SPI-SCK', COLOR.sck, filas.sck, 'R2', 'R6');
    divisor('SPI-MOSI', COLOR.mosi, filas.mosi, 'R3', 'R7');
    divisor('RC522-RST', COLOR.rst, filas.rst, 'R4', 'R8');

    // MISO: directo, del módulo hacia el UNO.
    cable('SPI-MISO', COLOR.miso, [[XM, filas.miso], [XU, filas.miso]]);
    flecha(820, filas.miso, 'der', COLOR.miso);
    pin(XM, filas.miso, COLOR.miso);
    pin(XU, filas.miso, COLOR.miso);
    txt(545, filas.miso - 16, 'directo (sin divisor)', { size: 20, fill: GRIS, anchor: 'middle' });
    txt(545, filas.miso + 32, 'módulo → UNO · 3,3 V', { size: 20, fill: GRIS, anchor: 'middle' });

    // IRQ: sin conexión.
    conexiones.add('RC522-IRQ');
    capas.cables.push(`<path d="M${XM} ${filas.irq} L${XM + 50} ${filas.irq}" stroke="${GRIS}" stroke-width="4" stroke-dasharray="8 6" fill="none" data-conexion="RC522-IRQ"/>`);
    capas.piezas.push(`<path d="M${XM + 56} ${filas.irq - 12} l24 24 m0 -24 l-24 24" stroke="${GRIS}" stroke-width="4.5" stroke-linecap="round" fill="none"/>`);
    txt(XM + 96, filas.irq + 7, 'IRQ sin conexión (NC)', { size: 20, fill: GRIS, italic: true });
    pin(XM, filas.irq, GRIS);

    // GND del módulo.
    cable('RC522-GND', COLOR.gnd, [[XM, filas.gndL], [XU, filas.gndL]], 6);
    pin(XM, filas.gndL, COLOR.gnd);
    pin(XU, filas.gndL, COLOR.gnd);
    txt(700, filas.gndL - 14, 'GND común', { size: 20, fill: GRIS, anchor: 'middle' });

    // 3V3 del módulo + desacoplo C1/C2.
    cable('RC522-3V3', COLOR.v33, [[XM, filas.v33], [XU, filas.v33]], 6);
    pin(XM, filas.v33, COLOR.v33);
    pin(XU, filas.v33, COLOR.v33);
    txt(905, filas.v33 + 36, '+3,3 V del regulador', { size: 19, fill: GRIS, anchor: 'middle' });
    txt(905, filas.v33 + 60, 'del UNO (≤ 150 mA)', { size: 19, fill: GRIS, anchor: 'middle' });
    for (const [ref, valor, x, polar] of [['C1', '100 nF', 450, false], ['C2', '10 µF', 680, true]]) {
        cable(null, COLOR.v33, [[x, filas.v33], [x, filas.v33 + 22]], 5);
        cable(null, COLOR.gnd, [[x, filas.v33 + 38], [x, filas.v33 + 46]], 5);
        capacitorV(ref, valor, x, filas.v33 + 30, { polar, plusAbajo: false, texto: 'der' });
        tierra(x, filas.v33 + 46);
        punto(x, filas.v33, COLOR.v33);
    }
    txt(580, filas.v33 + 104, 'desacoplo junto al módulo', { size: 19, fill: GRIS, anchor: 'middle', italic: true });

    // ------------------------------------------------------------- LCD
    cable('LCD-GND', COLOR.gnd, [[XM, filas.gnd2], [XU, filas.gnd2]], 6);
    cable('LCD-5V', COLOR.v5, [[XM, filas.v5], [XU, filas.v5]], 6);
    cable('LCD-SDA', COLOR.sda, [[XM, filas.sda], [XU, filas.sda]]);
    cable('LCD-SCL', COLOR.scl, [[XM, filas.scl], [XU, filas.scl]]);
    for (const [y, c] of [[filas.gnd2, COLOR.gnd], [filas.v5, COLOR.v5], [filas.sda, COLOR.sda], [filas.scl, COLOR.scl]]) {
        pin(XM, y, c);
        pin(XU, y, c);
    }
    flecha(560, filas.sda, 'izq', COLOR.sda);
    flecha(600, filas.sda, 'der', COLOR.sda);
    flecha(580, filas.scl, 'izq', COLOR.scl);
    txt(700, filas.v5 - 16, '+5 V', { size: 20, fill: GRIS, anchor: 'middle' });
    txt(760, filas.sda - 16, 'I2C: datos en ambos sentidos', { size: 20, fill: GRIS, anchor: 'middle' });
    // C3 entre 5 V y GND, junto al LCD.
    refs.add('C3');
    cable(null, COLOR.gnd, [[820, filas.gnd2], [820, filas.gnd2 + 37]], 5);
    cable(null, COLOR.v5, [[820, filas.v5 - 37], [820, filas.v5]], 5);
    capacitorV('C3', '100 µF', 820, filas.gnd2 + 45, { polar: true, plusAbajo: true });
    punto(820, filas.gnd2, COLOR.gnd);
    punto(820, filas.v5, COLOR.v5);
    // Nota de pull-ups dentro del bloque LCD.
    capas.bloques.push(`<rect x="110" y="1622" width="240" height="54" rx="8" fill="${PAPEL}" stroke="${GRIS}" stroke-width="2.5" stroke-dasharray="7 5"/>`);
    txt(230, 1645, 'pull-ups de SDA/SCL', { size: 18, fill: GRIS, anchor: 'middle', halo: false });
    txt(230, 1667, 'ya incluidos en la mochila', { size: 18, fill: GRIS, anchor: 'middle', halo: false });

    // ---------------------------------------------- lado derecho: salidas y entrada
    const XR = 1555;   // centro de las resistencias
    // Pulsador D2 -> SW1 -> GND
    refs.add('SW1');
    cable('BOTON', COLOR.ent, [[XD, der.btn], [1560, der.btn]]);
    cable('BOTON', COLOR.gnd, [[1680, der.btn], [XBUS, der.btn]]);
    capas.piezas.push(`<circle cx="1560" cy="${der.btn}" r="8" fill="${PAPEL}" stroke="${TINTA}" stroke-width="4"/>`
        + `<circle cx="1680" cy="${der.btn}" r="8" fill="${PAPEL}" stroke="${TINTA}" stroke-width="4"/>`
        + `<path d="M1566 ${der.btn - 7} L1668 ${der.btn - 30}" stroke="${TINTA}" stroke-width="4.5" stroke-linecap="round"/>`
        + `<path d="M1622 ${der.btn - 44} v-22 m-14 0 h28" stroke="${TINTA}" stroke-width="3.5" stroke-linecap="round" fill="none"/>`);
    txt(1620, der.btn + 40, 'SW1  pulsador', { size: 21, weight: 700, anchor: 'middle' });
    flecha(1470, der.btn, 'izq', COLOR.ent);
    pin(XD, der.btn, COLOR.ent);

    const salida = (id, y, rRef, rValor, ledRef, relleno, nombre) => {
        cable(id, COLOR.sal, [[XD, y], [XR - 36, y]]);
        cable(id, COLOR.sal, [[XR + 36, y], [1690, y]]);
        cable(id, COLOR.gnd, [[1730, y], [XBUS, y]]);
        resistorH(rRef, rValor, XR, y);
        led(ledRef, 1690, y, relleno, nombre);
        flecha(1470, y, 'der', COLOR.sal);
        pin(XD, y, COLOR.sal);
    };
    salida('LED-VERDE', der.l1, 'R9', '220 Ω', 'LED1', '#22c55e', 'verde');
    salida('LED-AMBAR', der.l2, 'R10', '220 Ω', 'LED2', '#f59e0b', 'ámbar');
    salida('LED-ROJO', der.l3, 'R11', '220 Ω', 'LED3', '#ef4444', 'rojo');

    // Zumbador D8 -> R12 -> BZ1 -> GND
    refs.add('BZ1');
    cable('ZUMBADOR', COLOR.sal, [[XD, der.bz], [XR - 36, der.bz]]);
    cable('ZUMBADOR', COLOR.sal, [[XR + 36, der.bz], [1690, der.bz]]);
    cable('ZUMBADOR', COLOR.gnd, [[1746, der.bz], [XBUS, der.bz]]);
    resistorH('R12', '100 Ω', XR, der.bz);
    capas.piezas.push(`<circle cx="1718" cy="${der.bz}" r="28" fill="${PAPEL}" stroke="${TINTA}" stroke-width="4"/>`
        + `<path d="M1750 ${der.bz - 16} q16 16 0 32 M1762 ${der.bz - 26} q26 26 0 52" stroke="${TINTA}" stroke-width="3" fill="none" stroke-linecap="round"/>`);
    txt(1704, der.bz - 6, '+', { size: 26, weight: 700, anchor: 'middle', halo: false });
    txt(1718, der.bz - 44, 'BZ1  piezo pasivo', { size: 21, weight: 700, anchor: 'middle' });
    txt(1718, der.bz + 58, 'tone() · terminal + a R12', { size: 18, fill: GRIS, anchor: 'middle' });
    flecha(1470, der.bz, 'der', COLOR.sal);
    pin(XD, der.bz, COLOR.sal);

    // GND del UNO (lado derecho) y bus de tierra.
    cable('GND-DER', COLOR.gnd, [[XD, der.gndR], [XBUS, der.gndR]], 6);
    cable('GND-DER', COLOR.gnd, [[XBUS, der.btn], [XBUS, der.gndR]], 6);
    pin(XD, der.gndR, COLOR.gnd);
    for (const y of [der.btn, der.l1, der.l2, der.l3, der.bz]) punto(XBUS, y, COLOR.gnd);
    punto(XBUS, der.gndR, COLOR.gnd);
    tierra(XBUS, der.gndR + 6);
    txt(XBUS + 30, der.gndR + 30, 'bus de tierra', { size: 19, fill: GRIS });

    // --------------------------------------------------------- notas de diseño
    const caja = (x, y, w, h, titulo) => {
        capas.bloques.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${PAPEL}" stroke="${GRIS_CLARO}" stroke-width="3"/>`);
        txt(x + 20, y + 36, titulo, { size: 23, weight: 700, halo: false });
    };
    const lineas = (x, y, arr, size = 19, paso = 28) => arr.forEach((s, i) => txt(x, y + i * paso, s, { size, halo: false }));

    caja(1980, 270, 360, 490, 'Parte digital');
    lineas(2000, 346, [
        'LED: (5 V − 2 V) / 220 Ω',
        '≈ 14 mA por LED, menos del',
        'límite de 20 mA por pin.',
        '',
        'Zumbador: R12 limita la',
        'corriente; pasivo con tone().',
        '',
        'Pulsador: pull-up interno',
        '(INPUT_PULLUP), sin resistencia',
        'externa. Reposo 5 V, pulsado 0 V.',
        '',
        'El botón solo cambia de',
        'página y avisa BTN: nunca',
        'cierra una sesión.',
    ]);

    // Leyenda de colores.
    caja(1470, 1040, 460, 540, 'Código de colores de los cables');
    const leyenda = [
        ['v5', '+5 V (alimentación)'], ['v33', '+3,3 V (alimentación)'], ['gnd', 'GND (tierra común)'],
        ['ss', 'SPI · SS / SDA (D10)'], ['sck', 'SPI · SCK (D13)'], ['mosi', 'SPI · MOSI (D11)'], ['miso', 'SPI · MISO (D12)'],
        ['rst', 'RST del MFRC522 (D9)'], ['sda', 'I2C · SDA (A4)'], ['scl', 'I2C · SCL (A5)'],
        ['sal', 'Salidas D5–D8 (LED, zumbador)'], ['ent', 'Entrada D2 (pulsador)'],
    ];
    leyenda.forEach(([k, s], i) => {
        const y = 1100 + i * 37;
        capas.cables.push(`<line x1="1496" y1="${y}" x2="1546" y2="${y}" stroke="${COLOR[k]}" stroke-width="7" stroke-linecap="round"/>`);
        txt(1562, y + 7, s, { size: 20, halo: false });
    });
    txt(1496, 1100 + 12 * 37 + 8, '→ sentido de la señal', { size: 19, fill: GRIS, halo: false });

    // Presupuesto de corriente.
    caja(1960, 1040, 380, 400, 'Consumo estimado a 5 V');
    const consumo = [
        ['UNO + conversor USB', '≈ 50 mA'], ['LCD con luz', '25–40 mA'], ['MFRC522 (3V3)', '13–30 mA'],
        ['LED (1 / 3 prendidos)', '14 / 42 mA'], ['Zumbador pasivo', '< 5 mA'], ['Divisores (4)', '≤ 7 mA'],
    ];
    consumo.forEach(([a, b], i) => {
        const y = 1112 + i * 34;
        txt(1980, y, a, { size: 20, halo: false });
        txt(2320, y, b, { size: 20, anchor: 'end', halo: false });
    });
    capas.bloques.push(`<line x1="1980" y1="1326" x2="2320" y2="1326" stroke="${GRIS_CLARO}" stroke-width="2.5"/>`);
    txt(1980, 1354, 'Típico ≈ 115 mA · peor ≈ 190 mA', { size: 19, weight: 700, halo: false });
    txt(1980, 1384, 'Puerto USB: hasta 500 mA', { size: 20, halo: false });
    txt(1980, 1420, 'Estimado con datos típicos; no medido.', { size: 18, fill: GRIS, italic: true, halo: false });

    caja(1960, 1470, 380, 210, 'Antes de energizar');
    lineas(1980, 1550, [
        '• RC522: alimentar SOLO a 3,3 V.',
        '• Soldar la tira de pines del RC522.',
        '• Cables SPI de menos de 15 cm.',
        '• Verificar polaridad de LED y C2/C3.',
        '• No conectar el pin IRQ.',
    ], 18, 28);

    // Notas al pie izquierdo.
    lineas(70, 1722, [
        'Esquema lógico: el orden de los pines en el bloque del UNO se eligió para no cruzar cables;',
        'no es la posición física de la placa. Todos los símbolos GND son el mismo nodo de tierra.',
        'Divisor: Vsalida = 5 V × 2 kΩ / (1 kΩ + 2 kΩ) = 3,33 V; el ATmega328P entrega ~5 V como nivel alto.',
        'Las líneas SS, SCK, MOSI y RST salen del UNO (5 V) y el MFRC522 solo tolera 3,3 V; MISO sale del',
        'MFRC522 (3,3 V) y el UNO lo lee como 1 con más de 3,0 V (0,6 × VCC, según la hoja de datos).',
    ], 19, 28);

    // ------------------------------------------------------- encabezado y cajetín
    txt(70, 78, 'Estación de aula SUSAN · esquema de conexión', { size: 48, weight: 700, halo: false });
    txt(70, 120, 'Arduino UNO R3 · lector RFID MFRC522 · LCD 16×2 I2C · 3 LED · zumbador · pulsador', { size: 24, fill: GRIS, halo: false });
    capas.bloques.push(`<rect x="1590" y="38" width="750" height="76" rx="10" fill="#fef3f2" stroke="#d92d20" stroke-width="4"/>`);
    txt(1965, 84, 'DISEÑO · SIN PROBAR EN HARDWARE FÍSICO', { size: 31, weight: 700, anchor: 'middle', fill: '#b42318', halo: false });

    const cx = 1470;
    const cy = 1700;
    capas.bloques.push(`<rect x="${cx}" y="${cy}" width="870" height="150" fill="${PAPEL}" stroke="${TINTA}" stroke-width="4"/>`
        + `<line x1="${cx}" y1="${cy + 50}" x2="${cx + 870}" y2="${cy + 50}" stroke="${TINTA}" stroke-width="2.5"/>`
        + `<line x1="${cx}" y1="${cy + 100}" x2="${cx + 870}" y2="${cy + 100}" stroke="${TINTA}" stroke-width="2.5"/>`
        + `<line x1="${cx + 560}" y1="${cy + 50}" x2="${cx + 560}" y2="${cy + 150}" stroke="${TINTA}" stroke-width="2.5"/>`
        + '');
    txt(cx + 16, cy + 34, 'SUSAN · UNACH · FCA C-I · Programación Avanzada · Manejo de puertos · 3° N', { size: 21, weight: 700, halo: false });
    txt(cx + 16, cy + 84, 'Estación de aula: esquema de conexión (hoja 1/1)', { size: 22, weight: 700, halo: false });
    txt(cx + 16, cy + 134, 'Generado por circuito/generar-circuito.mjs', { size: 18, fill: GRIS, halo: false });
    txt(cx + 576, cy + 84, `Rev. ${REV} · ${fecha}`, { size: 22, weight: 700, halo: false });
    txt(cx + 576, cy + 134, 'Estado: sin probar', { size: 21, weight: 700, fill: '#b42318', halo: false });

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FUENTE}">`
        + `<title>Estación de aula SUSAN - esquema de conexión (rev. ${REV})</title>`
        + `<rect width="${W}" height="${H}" fill="${PAPEL}"/>`
        + `<g>${capas.bloques.join('')}</g><g>${capas.cables.join('')}</g><g>${capas.piezas.join('')}</g><g>${capas.textos.join('')}</g></svg>`;
    return { svg, conexiones, refs };
}

// ------------------------------------------------------------- validaciones
function validar(conexiones, refs) {
    const errores = [];
    const pines = leerCsv(path.join(AQUI, 'pines.csv'));
    const idsCsv = new Set(pines.map((p) => p.id));
    for (const id of idsCsv) if (!conexiones.has(id)) errores.push(`pines.csv tiene "${id}" pero el dibujo no la traza`);
    for (const id of conexiones) if (!idsCsv.has(id)) errores.push(`el dibujo traza "${id}" que no está en pines.csv`);

    const mdRuta = path.join(AQUI, 'pines.md');
    if (existsSync(mdRuta)) {
        const md = readFileSync(mdRuta, 'utf8');
        for (const id of idsCsv) if (!md.includes(`\`${id}\``)) errores.push(`pines.md no menciona la conexión \`${id}\``);
    } else errores.push('falta pines.md');

    const bom = leerCsv(path.join(AQUI, 'bom.csv'));
    const refsBom = new Set();
    for (const fila of bom) {
        if (fila.en_diagrama === 'sí') for (const r of expandirRefs(fila.refs)) refsBom.add(r);
    }
    for (const r of refsBom) if (!refs.has(r)) errores.push(`bom.csv lista "${r}" pero no está dibujado`);
    for (const r of refs) if (!refsBom.has(r)) errores.push(`el dibujo contiene "${r}" que no está en bom.csv`);

    // Cantidad = número de referencias, para las filas dibujadas.
    for (const fila of bom) {
        if (fila.en_diagrama === 'sí' && expandirRefs(fila.refs).length !== Number(fila.cantidad)) {
            errores.push(`bom.csv: ${fila.refs} declara cantidad ${fila.cantidad}`);
        }
    }
    return errores;
}

// ------------------------------------------------------------------ PNG
function cargarPlaywright() {
    const require = createRequire(import.meta.url);
    const candidatos = [path.join(AQUI, 'tools', 'node_modules', 'playwright'), 'playwright'];
    for (const c of candidatos) {
        try { return require(c); } catch { /* siguiente */ }
    }
    throw new Error('Falta Playwright. Instálelo con: npm install --no-save --prefix circuito/tools playwright@1.56.1');
}

async function renderizarPng(svg, destino, escala = 1.5) {
    const { chromium } = cargarPlaywright();
    const navegador = await chromium.launch();
    try {
        const pagina = await navegador.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: escala });
        await pagina.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${svg}</body></html>`);
        await pagina.screenshot({ path: destino, clip: { x: 0, y: 0, width: W, height: H } });
    } finally {
        await navegador.close();
    }
}

async function main() {
    const { values } = parseArgs({
        options: {
            'sin-png': { type: 'boolean', default: false },
            verificar: { type: 'boolean', default: false },
            fecha: { type: 'string', default: '2026-10-30' },
        },
    });
    const { svg, conexiones, refs } = construir(values.fecha);
    const errores = validar(conexiones, refs);
    if (errores.length) {
        console.error('El dibujo no coincide con las tablas:\n - ' + errores.join('\n - '));
        process.exit(1);
    }
    console.log(`Validación correcta: ${conexiones.size} conexiones y ${refs.size} componentes coinciden con pines.csv, pines.md y bom.csv`);
    if (values.verificar) return;
    writeFileSync(path.join(AQUI, 'circuito.svg'), svg);
    console.log('Escrito circuito/circuito.svg');
    if (values['sin-png']) return;
    await renderizarPng(svg, path.join(AQUI, 'circuito.png'));
    console.log(`Escrito circuito/circuito.png (${Math.round(W * 1.5)} px de ancho)`);
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
