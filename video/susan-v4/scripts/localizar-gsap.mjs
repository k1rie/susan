#!/usr/bin/env node
// localizar-gsap.mjs - cambia el GSAP del CDN por la copia local en index.html (equivale al `sed` de frame.md 1, con comprobacion).
//
// Por que: cdn.jsdelivr.net y unpkg.com dan 403 desde esta maquina; el render avisa «Failed to download CDN script» y el video sale sin
// animacion. assemble-index.mjs vuelve a escribir el <script> del CDN en CADA ensamblado, asi que esto se corre despues de cada
// assemble-index y antes de `transitions inject` (el orden de frame.md). Solo reescribe index.html; los cuadros (zona de los workers)
// solo se revisan: deben cargar assets/vendor/gsap.min.js.
//
// Uso: node scripts/localizar-gsap.mjs [--root <proyecto>] [--check]
//   --check  no escribe; sale con codigo 1 si queda alguna referencia a GSAP en un CDN (index.html o compositions/frames/*.html)
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { bandera, raiz, rutas } from './lib/rutas.mjs';

const R = raiz();
const P = rutas(R);
const CHECK = bandera(process.argv, '--check');
const RE = /<script\b[^>]*\bsrc="https?:\/\/(?:cdn\.jsdelivr\.net\/npm|unpkg\.com)\/gsap@[\w.]+\/dist\/gsap\.min\.js"[^>]*><\/script>/g;
const LOCAL = '<script src="assets/vendor/gsap.min.js"></script>';

if (!existsSync(P.gsapLocal)) { console.error(`falta ${P.gsapLocal} (GSAP 3.14.2 local)`); process.exit(1); }
if (!existsSync(P.index)) { console.error(`falta ${P.index}`); process.exit(1); }
const html = readFileSync(P.index, 'utf8');
const n = (html.match(RE) ?? []).length;
const restantes = [];
if (existsSync(P.cuadros)) {
    for (const f of readdirSync(P.cuadros).filter((x) => x.endsWith('.html'))) {
        const t = readFileSync(join(P.cuadros, f), 'utf8');
        if (/(cdn\.jsdelivr\.net|unpkg\.com)\/[^"']*gsap/.test(t)) restantes.push(`compositions/frames/${f}`);
    }
}
if (CHECK) {
    if (n) restantes.unshift(`index.html (${n})`);
    if (restantes.length) { console.error(`GSAP por CDN en: ${restantes.join(', ')}`); process.exit(1); }
    console.log('GSAP local en index.html y en todos los cuadros');
    process.exit(0);
}
if (n) writeFileSync(P.index, html.replace(RE, LOCAL));
console.log(`index.html: ${n} <script> de GSAP del CDN -> ${LOCAL}`);
if (restantes.length) { console.error(`AVISO: cuadros que cargan GSAP del CDN (deben usar assets/vendor/gsap.min.js): ${restantes.join(', ')}`); process.exit(1); }
