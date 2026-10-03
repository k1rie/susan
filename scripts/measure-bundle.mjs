#!/usr/bin/env node
// Mide el JS que descarga cada ruta (suma de los chunks que referencia su manifiesto de cliente + los del shell raíz),
// en bytes crudos y gzip. Sirve para vigilar el presupuesto de rendimiento del diseño (docs/DESIGN_PLAN.md §3:
// JS inicial de /docente <= +15 % respecto a la base).
//
// Uso:  cd web && npm run build && node ../scripts/measure-bundle.mjs [directorio-web] [--json]
// Compara dos compilaciones: node scripts/measure-bundle.mjs <dirBase> --json > base.json (y lo mismo con la nueva).
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

const args = process.argv.slice(2);
const json = args.includes('--json');
const web = path.resolve(args.find((a) => !a.startsWith('--')) ?? 'web');
const next = fs.realpathSync(path.join(web, '.next'));

const RUTAS = {
    '/login': '(public)/login',
    '/docente': '(app)/docente',
    '/admin': '(app)/admin',
    '/alumno': '(app)/alumno',
    '/analitica': '(app)/analitica',
    '/reportes': '(app)/reportes',
    '/docente/sesiones/[id]': '(app)/docente/sesiones/[id]',
    '/modulos': '(app)/modulos',
};

const tam = (rel) => {
    const f = path.join(next, rel.replace(/^\/_next\//, ''));
    if (!fs.existsSync(f) || !f.endsWith('.js')) return null;
    const buf = fs.readFileSync(f);
    return { crudo: buf.length, gzip: zlib.gzipSync(buf, { level: 9 }).length };
};

function chunksDe(rutaApp) {
    const f = path.join(next, 'server/app', rutaApp, 'page_client-reference-manifest.js');
    if (!fs.existsSync(f)) return null;
    const s = fs.readFileSync(f, 'utf8');
    const m = s.match(/__RSC_MANIFEST\[".*?"\]\s*=\s*(\{.*\})\s*;?\s*$/s);
    if (!m) return null;
    const manifiesto = JSON.parse(m[1]);
    const set = new Set();
    for (const mod of Object.values(manifiesto.clientModules ?? {})) for (const c of mod.chunks ?? []) set.add(c);
    for (const lista of Object.values(manifiesto.entryJSFiles ?? {})) for (const c of lista) set.add(`/_next/${c.replace(/^\/?_next\//, '')}`);
    return set;
}

function raiz() {
    const f = path.join(next, 'build-manifest.json');
    const set = new Set();
    if (fs.existsSync(f)) {
        const b = JSON.parse(fs.readFileSync(f, 'utf8'));
        for (const c of [...(b.rootMainFiles ?? []), ...(b.polyfillFiles ?? [])]) set.add(`/_next/${c}`);
    }
    return set;
}

const base = raiz();
const filas = [];
for (const [ruta, dir] of Object.entries(RUTAS)) {
    const chunks = chunksDe(dir);
    if (!chunks) continue;
    let crudo = 0;
    let gzip = 0;
    for (const c of new Set([...base, ...chunks])) {
        const t = tam(c);
        if (t) {
            crudo += t.crudo;
            gzip += t.gzip;
        }
    }
    filas.push({ ruta, crudoKB: +(crudo / 1024).toFixed(1), gzipKB: +(gzip / 1024).toFixed(1) });
}

if (json) console.log(JSON.stringify(filas, null, 2));
else {
    console.log('ruta'.padEnd(28), 'crudo KB'.padStart(10), 'gzip KB'.padStart(10));
    for (const f of filas) console.log(f.ruta.padEnd(28), String(f.crudoKB).padStart(10), String(f.gzipKB).padStart(10));
}
