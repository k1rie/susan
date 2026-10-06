// juguete.mjs - prepara el proyecto de juguete de scripts/test-fixtures/toy-sfx para las pruebas (test-sfx-toy, test-voz-dry).
// Copia el fixture a una carpeta de trabajo (nunca se escribe dentro de scripts/test-fixtures), le agrega la biblioteca de SFX y el
// GSAP local del proyecto real y lo ensambla con los scripts REALES de la skill product-launch-video.
import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { DIR_SCRIPTS } from './rutas.mjs';

export const PROYECTO = resolve(DIR_SCRIPTS, '..');
export const FIXTURE = join(DIR_SCRIPTS, 'test-fixtures/toy-sfx');
export const SKILL = process.env.PLV_SCRIPTS || '/root/.claude/skills/product-launch-video/scripts';

export const sh = (cmd, args, o = {}) => spawnSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26, ...o });

export function prepararJuguete(D) {
    rmSync(D, { recursive: true, force: true });
    cpSync(FIXTURE, D, { recursive: true });
    mkdirSync(join(D, 'assets/sfx'), { recursive: true });
    mkdirSync(join(D, 'assets/vendor'), { recursive: true });
    cpSync(join(PROYECTO, 'assets/sfx/derived'), join(D, 'assets/sfx/derived'), { recursive: true });
    cpSync(join(PROYECTO, 'assets/sfx/CATALOG.json'), join(D, 'assets/sfx/CATALOG.json'));
    cpSync(join(PROYECTO, 'assets/vendor/gsap.min.js'), join(D, 'assets/vendor/gsap.min.js'));
}

// Pasos del pipeline real sobre el juguete: [titulo, resultado de spawnSync]
export function pasosEnsamblado(D) {
    return [
        ['assemble-index.mjs (skill)', () => sh('node', [join(SKILL, 'assemble-index.mjs'), '--storyboard', './STORYBOARD.md', '--hyperframes', '.'], { cwd: D })],
        ['localizar-gsap.mjs', () => sh('node', [join(DIR_SCRIPTS, 'localizar-gsap.mjs'), '--root', D])],
        ['localizar-gsap.mjs --check', () => sh('node', [join(DIR_SCRIPTS, 'localizar-gsap.mjs'), '--root', D, '--check'])],
        ['transitions.mjs inject (skill, una sola vez)', () => sh('node', [join(SKILL, 'transitions.mjs'), 'inject', '--storyboard', './STORYBOARD.md', '--hyperframes', '.'], { cwd: D })],
    ];
}

// Ejecutor de pasos con salida legible: paso(titulo, r, { debeFallar, patron }) y el resumen final.
export function crearPasos() {
    const resumen = [];
    const paso = (titulo, r, { debeFallar = false, patron = null } = {}) => {
        const salida = `${r.stdout || ''}\n${r.stderr || ''}`;
        const fallo = r.status !== 0;
        const ok = debeFallar ? fallo && (!patron || patron.test(salida)) : !fallo && (!patron || patron.test(salida));
        resumen.push(`${ok ? 'OK   ' : 'FALLO'} ${titulo}`);
        console.log(`\n=== ${titulo}: ${ok ? 'OK' : 'FALLO'} (codigo ${r.status}${debeFallar ? ', se esperaba != 0' : ''}${patron ? `, patron ${patron}` : ''})`);
        console.log(salida.trim().split('\n').slice(-(ok ? 14 : 40)).join('\n'));
        if (!ok) { console.log(`\n${resumen.join('\n')}\n\nPRUEBA FALLIDA`); process.exit(1); }
        return r;
    };
    return { paso, resumen };
}
