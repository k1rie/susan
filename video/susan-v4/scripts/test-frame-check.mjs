#!/usr/bin/env node
// test-frame-check.mjs - prueba de las herramientas de revision por cuadro (frame-check.mjs, preview-frame.mjs) con el runtime 0.8.134.
//   1. frame-check sobre los cuadros del juguete: los sfx_cues de STORYBOARD.md caen en sus tweens (0 huerfanos) y no hay errores de
//      pose, estructura ni trampas (el juguete solo tiene movimiento escaso: 'movimiento' se tolera).
//   2. frame-check sobre un borrador roto a proposito (test-fixtures/frame-check/s02-linea-trampas.html, como --file de s02-linea): deben
//      salir TODOS los codigos esperados (pose 3D, pose no plana al final, giro en el plano, GSAP del CDN, CSS transition, transform CSS,
//      cursor, recurso, fromTo repetido, determinismo, salida, cue huerfano) y los avisos (peso, 3D aplanado, blur, ids sin prefijo).
//   3. preview-frame con --bordes --anclas --sheet: PNG al tamano del video y hoja de contactos.
// Uso: node scripts/test-frame-check.mjs [--dir <carpeta de trabajo>]
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { DIR_SCRIPTS, opcion } from './lib/rutas.mjs';
import { crearPasos, prepararJuguete, sh } from './lib/juguete.mjs';

const D = resolve(opcion(process.argv, '--dir', join(tmpdir(), 'susan-v4-toy-frames')));
const TRAMPAS = join(DIR_SCRIPTS, 'test-fixtures/frame-check/s02-linea-trampas.html');
const nodeS = (s, ...a) => sh('node', [join(DIR_SCRIPTS, s), '--root', D, ...a]);
const { paso, resumen } = crearPasos();
const afirmar = (titulo, ok, detalle = '') => paso(titulo, { status: ok ? 0 : 1, stdout: detalle });
const json = (r) => { try { return JSON.parse(r.stdout); } catch { console.log(r.stdout, r.stderr); return null; } };

prepararJuguete(D);
console.log(`juguete en ${D}`);

// ---- 1. cuadros sanos del juguete
const r1 = nodeS('frame-check.mjs', 's01-tarjeta', 's02-linea', 's03-cierre', '--json');
const inf = json(r1);
afirmar('frame-check corre sobre los 3 cuadros con el runtime real', Array.isArray(inf) && inf.length === 3, r1.stderr);
const codigos = inf.flatMap((x) => x.errores.map((e) => `${x.id}:${e.cod}`));
afirmar('cuadros del juguete: solo errores de movimiento escaso (ninguno de sonido, pose, estructura ni trampas)', codigos.every((c) => c.endsWith(':movimiento')), codigos.join(', '));
afirmar('sfx_cues de los 3 cuadros: 17 cues, 0 huerfanos', inf.reduce((s, x) => s + x.info.sonido.cues, 0) === 17 && inf.every((x) => x.info.sonido.huerfanos === 0), JSON.stringify(inf.map((x) => x.info.sonido)));
afirmar('s02 y s03 se saben bajo una transicion entrante de 0.5 s; s03 es el final', inf[1].info.entrada === 0.5 && inf[2].info.entrada === 0.5 && inf[2].info.final === true && inf[0].info.final === false);

// ---- 2. borrador con trampas
const r2 = nodeS('frame-check.mjs', 's02-linea', '--file', TRAMPAS, '--json');
const t = json(r2)?.[0];
afirmar('frame-check sale con codigo 1 sobre el borrador roto', r2.status === 1 && !!t, r2.stderr);
const errs = new Set(t.errores.map((e) => e.cod)), avs = new Set(t.avisos.map((e) => e.cod));
const esperados = ['pose-3d', 'pose-plana', 'giro-plano', 'gsap-cdn', 'css-transition', 'transform-css', 'cursor', 'recurso', 'fromTo-repetido', 'determinismo', 'exit', 'sfx-huerfano'];
const faltan = esperados.filter((c) => !errs.has(c));
afirmar(`borrador roto: los ${esperados.length} errores esperados`, !faltan.length, `faltan: ${faltan.join(', ') || 'ninguno'}\nerrores: ${t.errores.map((e) => `[${e.cod}] ${e.msg}`).join('\n')}`);
const avEsperados = ['peso', '3d-aplanado', 'blur', 'estructura'];
const faltanAv = avEsperados.filter((c) => !avs.has(c));
afirmar(`borrador roto: los ${avEsperados.length} avisos esperados`, !faltanAv.length, `faltan: ${faltanAv.join(', ') || 'ninguno'}\navisos: ${t.avisos.map((e) => `[${e.cod}] ${e.msg}`).join('\n')}`);
afirmar('borrador roto: el sobreimpulso back.out se cuenta', t.info.sobreimpulsos === 1, String(t.info.sobreimpulsos));
afirmar('el cue huerfano es "0.70 draw" (los demas caen en tweens del borrador o en la transicion)', t.errores.filter((e) => e.cod === 'sfx-huerfano').length === 1 && /0\.70 draw/.test(t.errores.find((e) => e.cod === 'sfx-huerfano').msg));
paso('CONTROL frame-check con un cuadro que no existe', nodeS('frame-check.mjs', 's99-nada'), { debeFallar: true, patron: /No existe el cuadro s99-nada/ });

// ---- 3. preview-frame
const out = join(D, 'revision/s02-linea');
paso('preview-frame --bordes --anclas --sheet', nodeS('preview-frame.mjs', 's02-linea', '--bordes', '--anclas', '--sheet'), { patron: /hoja de contactos/ });
const dims = (f) => { const b = readFileSync(f); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const esperadosPng = ['t-0.00.png', 't-0.25.png', 't-0.50.png', 't-0.80.png', 't-1.25.png', 't-2.97.png', 'sheet.png'];
const presentes = esperadosPng.filter((f) => existsSync(join(out, f)));
afirmar('preview-frame: bordes (0, fin de la transicion, handoff), anclas de voz y cues, y hoja', presentes.length === esperadosPng.length, `faltan: ${esperadosPng.filter((f) => !presentes.includes(f)).join(', ')}`);
afirmar('preview-frame: PNG al tamano del video (960x540 en el juguete)', JSON.stringify(dims(join(out, 't-0.50.png'))) === '[960,540]', JSON.stringify(dims(join(out, 't-0.50.png'))));
console.log(`\n${resumen.join('\n')}\n\nPRUEBA DE REVISION COMPLETA (juguete en ${D})`);
