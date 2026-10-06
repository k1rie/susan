// hf-cli.mjs - acceso a la CLI de HyperFrames FIJADA (0.8.134) desde los scripts: su compilador (bundleToSingleHtml), su
// puppeteer-core y el Chrome headless que descarga la CLI.
//
// Por que: en la v3 extract-events tomaba "el primer hyperframes/dist" de ~/.npm/_npx y en esta maquina hay varias cachés (0.8.114 y
// 0.8.134). Aqui se elige la entrada cuya hyperframes/package.json dice exactamente CLI_VERSION; si no existe se pide
// `npx --yes hyperframes@0.8.134 --version` (sin red tambien funciona si la cache ya esta).
//
// GSAP: cdn.jsdelivr.net da 403 desde esta maquina (frame.md 1). Los cuadros usan assets/vendor/gsap.min.js, pero el indice que
// escribe assemble-index.mjs vuelve a apuntar al CDN. Para que estas herramientas no dependan de la red: (1) al compilar, el `fetch`
// del compilador recibe la copia local cuando pide gsap@3.14.2 (mismo sha384 que el `integrity` del ensamblador, asi que se inlinea
// igual que con red); (2) en Chrome, cualquier peticion a gsap@*/dist/gsap.min.js en el CDN se sirve desde la copia local.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { CLI_VERSION } from './rutas.mjs';

const HOME = homedir();
const RE_GSAP_CDN = /^https?:\/\/(cdn\.jsdelivr\.net\/npm|unpkg\.com)\/gsap@([\w.]+)\/dist\/gsap\.min\.js/;

export function distCli(version = CLI_VERSION) {
    const base = join(HOME, '.npm/_npx');
    if (existsSync(base)) {
        for (const d of readdirSync(base)) {
            const pkg = join(base, d, 'node_modules/hyperframes/package.json');
            try {
                if (JSON.parse(readFileSync(pkg, 'utf8')).version === version) return join(base, d, 'node_modules/hyperframes/dist');
            } catch { /* entrada sin hyperframes */ }
        }
    }
    throw new Error(`No esta la CLI hyperframes@${version} en ~/.npm/_npx: ejecuta una vez  npx --yes hyperframes@${version} --version`);
}

export function cargarPuppeteer(dist = distCli()) {
    const ruta = join(dist, '../../puppeteer-core');
    if (!existsSync(join(ruta, 'package.json'))) throw new Error(`No hay puppeteer-core junto a ${dist}`);
    return createRequire(import.meta.url)(ruta);
}

export function rutaChrome() {
    if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
    for (const base of [join(HOME, '.cache/hyperframes/chrome'), join(HOME, '.cache/puppeteer')]) {
        if (!existsSync(base)) continue;
        const r = execFileSync('find', [base, '-type', 'f', '-name', 'chrome-headless-shell'], { encoding: 'utf8' }).split('\n').filter(Boolean)[0];
        if (r) return r;
    }
    throw new Error(`No se encontro Chrome headless (define CHROME=/ruta o ejecuta una vez  npx --yes hyperframes@${CLI_VERSION} doctor)`);
}

// Copia local de GSAP 3.14.2 para servir en lugar del CDN: la del proyecto (assets/vendor/gsap.min.js, frame.md 1).
export function gsapLocal(R) {
    const r = join(R, 'assets/vendor/gsap.min.js');
    if (existsSync(r)) return readFileSync(r);
    throw new Error(`Falta ${join(R, 'assets/vendor/gsap.min.js')} (GSAP 3.14.2 local; ver frame.md 1)`);
}
const versionGsap = (buf) => /GSAP (\d+\.\d+\.\d+)/.exec(buf.subarray(0, 200).toString())?.[1] ?? null;

// bundleToSingleHtml de la CLI fijada, con el fetch del compilador desviado a la copia local de GSAP.
export async function compilar(R, { dist = distCli() } = {}) {
    const compilador = readdirSync(dist).find((f) => /^compiler-.*\.js$/.test(f));
    if (!compilador) throw new Error(`No hay compiler-*.js en ${dist}`);
    const { bundleToSingleHtml } = await import(pathToFileURL(join(dist, compilador)).href);
    const local = gsapLocal(R), vLocal = versionGsap(local);
    const original = globalThis.fetch;
    globalThis.fetch = async (url, ...resto) => {
        const m = RE_GSAP_CDN.exec(String(url?.url ?? url));
        if (m && (m[2] === vLocal || m[2] === '3')) return new Response(local, { status: 200, headers: { 'content-type': 'text/javascript' } });
        return original(url, ...resto);
    };
    try {
        return await bundleToSingleHtml(R);
    } finally {
        globalThis.fetch = original;
    }
}

// Chrome headless con el puppeteer de la CLI fijada.
export async function lanzarChrome({ dist = distCli() } = {}) {
    const puppeteer = cargarPuppeteer(dist);
    return puppeteer.launch({
        executablePath: rutaChrome(),
        headless: 'shell',
        args: ['--no-sandbox', '--disable-gpu', '--font-render-hinting=none', '--hide-scrollbars', '--force-color-profile=srgb', '--autoplay-policy=no-user-gesture-required', '--mute-audio'],
    });
}

// Intercepta en la pagina las peticiones de GSAP al CDN y las sirve desde la copia local.
export async function desviarGsap(page, R) {
    const local = gsapLocal(R);
    await page.setRequestInterception(true);
    page.on('request', (req) => {
        if (RE_GSAP_CDN.test(req.url())) req.respond({ status: 200, contentType: 'text/javascript', body: local });
        else req.continue();
    });
}
