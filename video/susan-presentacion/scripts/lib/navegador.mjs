// navegador.mjs - localiza Chrome headless y puppeteer-core ya instalados (sin tocar el proyecto).
//
// Busca, en este orden:
//   Chrome: $CHROME, ~/.cache/hyperframes/chrome/**/chrome-headless-shell, ~/.cache/puppeteer/**/chrome-headless-shell | chrome
//   puppeteer-core: $PUPPETEER_CORE (carpeta del paquete), node_modules del proyecto, ~/.npm/_npx/*/node_modules/puppeteer-core
// Uso (desde otros scripts):  const { lanzar } = await import('./lib/navegador.mjs');  const b = await lanzar();
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { execFileSync } from 'node:child_process';

const HOME = homedir();

function buscarEjecutable(base, nombres) {
    if (!existsSync(base)) return null;
    try {
        const salida = execFileSync('find', [base, '-type', 'f', '(', ...nombres.flatMap((n, i) => (i ? ['-o', '-name', n] : ['-name', n])), ')'], { encoding: 'utf8' })
            .split('\n')
            .filter(Boolean);
        return salida[0] || null;
    } catch {
        return null;
    }
}

export function rutaChrome() {
    if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
    const a = buscarEjecutable(join(HOME, '.cache/hyperframes/chrome'), ['chrome-headless-shell']);
    if (a) return a;
    const b = buscarEjecutable(join(HOME, '.cache/puppeteer'), ['chrome-headless-shell']);
    if (b) return b;
    throw new Error('No se encontro Chrome headless (define CHROME=/ruta o ejecuta una vez `npx hyperframes@0.8.114 doctor`).');
}

export function cargarPuppeteer(raiz) {
    const candidatos = [];
    if (process.env.PUPPETEER_CORE) candidatos.push(process.env.PUPPETEER_CORE);
    if (raiz) candidatos.push(join(raiz, 'node_modules/puppeteer-core'));
    const npx = join(HOME, '.npm/_npx');
    if (existsSync(npx)) {
        for (const d of readdirSync(npx)) candidatos.push(join(npx, d, 'node_modules/puppeteer-core'));
    }
    for (const c of candidatos) {
        if (existsSync(join(c, 'package.json')) && statSync(c).isDirectory()) return createRequire(import.meta.url)(c);
    }
    throw new Error('No se encontro puppeteer-core (define PUPPETEER_CORE=/ruta/al/paquete o ejecuta una vez `npx hyperframes@0.8.114 --version`).');
}

export async function lanzar(raiz) {
    const puppeteer = cargarPuppeteer(raiz);
    return puppeteer.launch({
        executablePath: rutaChrome(),
        headless: 'shell',
        args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none', '--hide-scrollbars', '--force-color-profile=srgb'],
    });
}
