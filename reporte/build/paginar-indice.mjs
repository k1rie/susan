#!/usr/bin/env node
// Índice estático en dos (o más) pasadas.
//
//   node paginar-indice.mjs <modulo.mjs> [salida.docx] [--max=6]
//
// <modulo.mjs> debe exportar  construir({ paginas })  que devuelva el Document de crearDocumento()
// (con la propiedad `encabezados`). El programa:
//   1. construye con números provisionales y lo convierte a PDF (convertir.sh, LibreOffice);
//   2. con pdftotext busca en qué página aparece cada título (id h0, h1, ... en orden de documento);
//   3. reconstruye con los números reales y repite hasta que los números no cambian y el total de
//      páginas se mantiene (los números del índice no cambian el diseño, así que converge en 2 pasadas);
//   4. deja <salida>.docx, <salida>.pdf y <salida>.paginas.json, e imprime un resumen JSON.
// Código de salida 0 si convergió y todos los títulos se encontraron; 1 si no.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const argumentos = process.argv.slice(2);
const opciones = Object.fromEntries(
    argumentos.filter((a) => a.startsWith('--')).map((a) => a.replace(/^--/, '').split('=')),
);
const posicionales = argumentos.filter((a) => !a.startsWith('--'));
if (posicionales.length < 1) {
    console.error('Uso: node paginar-indice.mjs <modulo.mjs> [salida.docx] [--max=6]');
    process.exit(2);
}
const modulo = path.resolve(posicionales[0]);
const salidaDocx = path.resolve(posicionales[1] ?? path.join(AQUI, 'salida', `${path.basename(modulo, '.mjs').replace(/^build-/, '')}.docx`));
const maxPasadas = Number(opciones.max ?? 6);

const { Packer } = await import(pathToFileURL(path.join(AQUI, 'lib', 'estilo.mjs')).href);
const { construir } = await import(pathToFileURL(modulo).href);
if (typeof construir !== 'function') {
    console.error(`${modulo} no exporta construir({ paginas }).`);
    process.exit(2);
}

fs.mkdirSync(path.dirname(salidaDocx), { recursive: true });
const salidaPdf = salidaDocx.replace(/\.docx$/, '.pdf');
const salidaJson = salidaDocx.replace(/\.docx$/, '.paginas.json');

// ---- utilidades -----------------------------------------------------------------------------
const normalizar = (t) => t.normalize('NFKC').replace(/\s+/g, ' ').trim();

function convertirAPdf() {
    const r = spawnSync('bash', [path.join(AQUI, 'convertir.sh'), salidaDocx, path.dirname(salidaDocx)], { encoding: 'utf8' });
    if (r.status !== 0) throw new Error(`convertir.sh falló: ${r.stderr || r.stdout}`);
}

function paginasDelPdf() {
    const r = spawnSync('pdftotext', ['-enc', 'UTF-8', salidaPdf, '-'], { encoding: 'utf8', maxBuffer: 1 << 26 });
    if (r.status !== 0) throw new Error(`pdftotext falló: ${r.stderr}`);
    const partes = r.stdout.split('\f');
    if (partes[partes.length - 1].trim() === '') partes.pop();
    return partes.map(normalizar);
}

/** Páginas del índice: las que tienen varias líneas de puntos guía (o el título ÍNDICE.). */
function paginasDeIndice(textos) {
    const idx = new Set();
    textos.forEach((t, i) => {
        const guias = (t.match(/\.{8,}/g) || []).length;
        if (guias >= 3) idx.add(i + 1);
    });
    return idx;
}

/** Ubica cada título en la primera página (>= la del título anterior) que contiene su texto. */
function ubicar(encabezados, textos) {
    const indice = paginasDeIndice(textos);
    let cursor = indice.size ? Math.max(...indice) + 1 : 1;
    const paginas = {};
    const faltan = [];
    for (const e of encabezados) {
        const buscado = normalizar(e.texto);
        let hallada = null;
        for (let p = cursor; p <= textos.length; p++) {
            if (indice.has(p)) continue;
            if (textos[p - 1].includes(buscado)) {
                hallada = p;
                break;
            }
        }
        if (hallada === null) {
            faltan.push(e);
        } else {
            paginas[e.id] = hallada;
            cursor = hallada;
        }
    }
    return { paginas, faltan, paginasIndice: [...indice] };
}

// ---- pasadas --------------------------------------------------------------------------------
let paginas = {};
let totalAnterior = null;
const historial = [];
let convergio = false;
let faltantes = [];
let textos = [];

for (let pasada = 1; pasada <= maxPasadas; pasada++) {
    const doc = construir({ paginas });
    fs.writeFileSync(salidaDocx, await Packer.toBuffer(doc));
    convertirAPdf();
    textos = paginasDelPdf();
    const { paginas: halladas, faltan, paginasIndice } = ubicar(doc.encabezados, textos);
    faltantes = faltan;

    const claves = doc.encabezados.map((e) => e.id);
    const igual = claves.every((k) => paginas[k] === halladas[k]);
    historial.push({ pasada, totalPaginas: textos.length, paginasIndice, titulos: claves.length, hallados: Object.keys(halladas).length, cambios: claves.filter((k) => paginas[k] !== halladas[k]).length });

    if (igual && totalAnterior === textos.length && faltan.length === 0) {
        convergio = true;
        break;
    }
    paginas = halladas;
    totalAnterior = textos.length;
}

fs.writeFileSync(salidaJson, JSON.stringify(paginas, null, 2));
const resumen = {
    convergio,
    pasadas: historial.length,
    totalPaginas: textos.length,
    titulosSinUbicar: faltantes.map((e) => e.texto),
    historial,
    docx: salidaDocx,
    pdf: salidaPdf,
};
console.log(JSON.stringify(resumen, null, 2));
process.exit(convergio && faltantes.length === 0 ? 0 : 1);
