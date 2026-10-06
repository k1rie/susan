// rutas.mjs - rutas y constantes compartidas por los scripts de sonido, voz y revision de la v4.
//
// Por que existe: en la v3 la carpeta de datos `v2/` y la version de la CLI (0.8.114) estaban fijas en 11 scripts
// (LECCIONES-V3 2.3). Aqui se centralizan: un solo lugar para la carpeta de datos (`datos/`), la CLI fijada (0.8.134) y los
// archivos que leen y escriben los scripts. Todos aceptan `--root <proyecto>` para poder probarse en un proyecto de juguete
// (scripts/test-fixtures) sin tocar el video.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const CLI_VERSION = '0.8.134';
// Comando de la CLI fijada (funciona sin red desde la cache de npx). Igual que package.json del proyecto.
export const HF = ['npx', '--yes', `hyperframes@${CLI_VERSION}`];

export const r3 = (x) => Math.round(x * 1000) / 1000;

// Valor de una opcion `--nombre valor` (null si no esta).
export const opcion = (argv, nombre, defecto = null) => {
    const i = argv.indexOf(nombre);
    return i >= 0 && i + 1 < argv.length ? argv[i + 1] : defecto;
};
export const bandera = (argv, nombre) => argv.includes(nombre);

// Raiz del proyecto: --root <dir> o la carpeta que contiene scripts/.
export function raiz(argv = process.argv) {
    const r = opcion(argv, '--root');
    if (r) return resolve(r);
    return resolve(dirname(fileURLToPath(import.meta.url)), '../..');
}

// Carpeta de los scripts (para invocar a los hermanos con spawn).
export const DIR_SCRIPTS = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function rutas(R) {
    return {
        raiz: R,
        storyboard: join(R, 'STORYBOARD.md'),
        script: join(R, 'SCRIPT.md'),
        index: join(R, 'index.html'),
        frameMd: join(R, 'frame.md'),
        cuadros: join(R, 'compositions/frames'),
        datos: join(R, 'datos'),
        catalogo: join(R, 'assets/sfx/CATALOG.json'),
        sfxDerivados: join(R, 'assets/sfx/derived'),
        sfxCues: join(R, 'datos/sfx-cues.json'),
        sfxMontado: join(R, 'datos/sfx-montado.json'),
        eventos: join(R, 'datos/eventos.json'),
        verifySfx: join(R, 'datos/verify-sfx.json'),
        verifySync: join(R, 'datos/verify-sfx-sync.json'),
        vozDir: join(R, 'assets/voz'),
        vozCache: join(R, 'voz-cache'),
        vozAlineacion: join(R, 'datos/voz-alineacion.json'),
        vozMontada: join(R, 'datos/voz-montada.json'),
        vozTomas: join(R, 'datos/voz-tomas.json'),
        revision: join(R, 'revision'),
        gsapLocal: join(R, 'assets/vendor/gsap.min.js'),
        env: join(R, '.env'),
    };
}

// Lee un JSON o devuelve null si no existe.
export function leerJson(ruta) {
    if (!existsSync(ruta)) return null;
    return JSON.parse(readFileSync(ruta, 'utf8'));
}
