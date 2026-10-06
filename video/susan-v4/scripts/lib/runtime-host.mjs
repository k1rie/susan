// runtime-host.mjs - abre una composicion con el RUNTIME REAL de la CLI fijada (0.8.134) en Chrome headless y la posiciona en el
// tiempo como lo hacen `snapshot` y `render`: compilado con bundleToSingleHtml, espera de window.__renderReady y busqueda con
// window.__player.renderSeek(t, { exact: true }).
//
// Por que no el arnes de la v3 (scripts/lib/frame-host.mjs de susan-presentacion): aquel IMITABA el runtime 0.8.114 (envoltorio
// .scene, totalTime + "meneo" de 1 ms, ventanas de visibilidad a mano) y SINTESIS pide no fiarse de el con la 0.8.134. Aqui el que
// anida timelines, oculta clips fuera de su ventana y busca el instante es el propio runtime.
//
// Un cuadro aislado se aloja en un proyecto temporal (enlaces simbolicos a assets/, compositions/... del proyecto real y un index.html
// minimo con ese cuadro en 0 s), asi el cuadro se revisa antes de ensamblar el video y sin tocar index.html.
//
// API:
//   const host = await crearHost(R);
//   const c = await host.abrirCuadro('s05-tendencia', { duracion, archivo });  // -> { page, meta, errores, ir(t), captura(t, op), cerrar() }
//   const v = await host.abrirIndice();                                         // index.html completo del proyecto
//   await host.cerrar();
import { createServer } from 'node:http';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { tmpdir } from 'node:os';
import { compilar, desviarGsap, lanzarChrome } from './hf-cli.mjs';

const MIME = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.gif': 'image/gif',
    '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.mp4': 'video/mp4', '.webm': 'video/webm',
};
const NO_ENLAZAR = new Set(['index.html', 'compositions', 'node_modules', '.git', 'renders', 'snapshots', 'revision', 'voz-cache', 'capture', 'referencia', 'datos']);

// Servidor estatico: '/' = el HTML compilado; el resto, archivos bajo `base` (sigue enlaces simbolicos).
async function servir(base, html) {
    base = resolve(base);
    const srv = createServer((req, res) => {
        const u = decodeURIComponent((req.url || '/').split('?')[0]);
        if (u === '/' || u === '/index.html') { res.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' }); res.end(html); return; }
        const f = normalize(join(base, u));
        if ((f === base || f.startsWith(base + sep)) && existsSync(f) && statSync(f).isFile()) {
            res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
            res.end(readFileSync(f));
        } else { res.writeHead(404); res.end(); }
    });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    return { url: `http://127.0.0.1:${srv.address().port}/`, cerrar: () => new Promise((r) => srv.close(() => r())) };
}

// Color de fondo del video: la primera clave `canvas` de frame.md (la misma regla que assemble-index), o el crema de la app.
function colorCanvas(R) {
    const f = join(R, 'frame.md');
    if (!existsSync(f)) return '#F7F5F2';
    return /^\s*canvas:\s*["']?(#[0-9a-fA-F]{3,8})/m.exec(readFileSync(f, 'utf8'))?.[1] ?? '#F7F5F2';
}

// Proyecto temporal con UN cuadro montado en 0 s. `archivo`: borrador fuera de compositions/frames (opcional).
export function proyectoDeUnCuadro(R, id, { archivo = null, duracion, ancho = 1920, alto = 1080 } = {}) {
    const tmp = mkdtempSync(join(tmpdir(), `susan-cuadro-${id}-`));
    for (const e of readdirSync(R)) if (!NO_ENLAZAR.has(e)) symlinkSync(join(R, e), join(tmp, e));
    mkdirSync(join(tmp, 'compositions/frames'), { recursive: true });
    const comp = join(R, 'compositions');
    if (existsSync(comp)) for (const e of readdirSync(comp)) if (e !== 'frames') symlinkSync(join(comp, e), join(tmp, 'compositions', e));
    const frames = join(comp, 'frames');
    if (existsSync(frames)) for (const e of readdirSync(frames)) if (e !== `${id}.html`) symlinkSync(join(frames, e), join(tmp, 'compositions/frames', e));
    const fuente = archivo ? resolve(archivo) : join(frames, `${id}.html`);
    if (!existsSync(fuente)) throw new Error(`No existe el cuadro ${id}: ${fuente}`);
    copyFileSync(fuente, join(tmp, 'compositions/frames', `${id}.html`));
    const gsap = existsSync(join(R, 'assets/vendor/gsap.min.js')) ? 'assets/vendor/gsap.min.js' : 'https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js';
    writeFileSync(join(tmp, 'index.html'), `<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=${ancho}, height=${alto}" />
    <script src="${gsap}"></script>
    <style>
      * { margin: 0; padding: 0; box-sizing: border-box; }
      html, body { width: ${ancho}px; height: ${alto}px; overflow: hidden; background: #000; }
      #root { position: relative; width: ${ancho}px; height: ${alto}px; overflow: hidden; background: ${colorCanvas(R)}; }
      .scene { position: absolute; inset: 0; width: 100%; height: 100%; }
    </style>
  </head>
  <body>
    <div id="root" data-composition-id="main" data-start="0" data-duration="${duracion}" data-width="${ancho}" data-height="${alto}">
      <div id="el-${id}" class="scene" data-composition-id="${id}" data-composition-src="compositions/frames/${id}.html" data-start="0" data-duration="${duracion}" data-track-index="1"></div>
    </div>
    <script>
      window.__timelines = window.__timelines || {};
      window.__timelines["main"] = gsap.timeline({ paused: true });
    </script>
  </body>
</html>
`);
    return { dir: tmp, fuente, limpiar: () => rmSync(tmp, { recursive: true, force: true }) };
}

// Dimensiones de la raiz de un indice.
function dimensiones(html) {
    const tag = /<div\b[^>]*\bid="root"[^>]*>/.exec(html)?.[0] ?? '';
    return { ancho: Number(/data-width="(\d+)"/.exec(tag)?.[1] ?? 1920), alto: Number(/data-height="(\d+)"/.exec(tag)?.[1] ?? 1080) };
}

export async function crearHost(R, { timeoutListo = 20000 } = {}) {
    R = resolve(R);
    const navegador = await lanzarChrome();

    async function abrir(base, html, { ancho, alto, limpiar = null }) {
        const srv = await servir(base, html);
        const page = await navegador.newPage();
        await page.evaluateOnNewDocument('self.__name = self.__name || ((fn) => fn);');
        await page.setViewport({ width: ancho, height: alto, deviceScaleFactor: 1 });
        const errores = [];
        page.on('pageerror', (e) => errores.push(String(e.message || e)));
        page.on('requestfailed', (r) => errores.push(`recurso fallido: ${r.url().replace(srv.url, '/')}`));
        page.on('response', (r) => { if (r.status() >= 400) errores.push(`HTTP ${r.status()}: ${r.url().replace(srv.url, '/')}`); });
        await desviarGsap(page, R);
        await page.goto(srv.url, { waitUntil: 'load', timeout: 90000 });
        const listo = await page.waitForFunction(() => Boolean(window.__renderReady), { timeout: timeoutListo }).then(() => true).catch(() => false);
        await page.evaluate(() => document.fonts.ready);
        await new Promise((r) => setTimeout(r, 250));
        const api = {
            page, errores, listo, ancho, alto,
            // Posiciona la composicion en t (s) con el runtime, como snapshot/render (renderSeek exacto) y espera dos fotogramas.
            async ir(t) {
                await page.evaluate(async (x) => {
                    const p = window.__player;
                    if (p && typeof p.renderSeek === 'function') await p.renderSeek(x, { exact: true });
                    else if (window.__hf && typeof window.__hf.seek === 'function') await window.__hf.seek(x);
                    else if (p && typeof p.seek === 'function') await p.seek(x);
                    else for (const tl of Object.values(window.__timelines || {})) { tl.pause(); tl.seek(x); }
                    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
                }, t);
            },
            async captura(t, { ruta = null, escala = 1, formato = 'png' } = {}) {
                await api.ir(t);
                const op = { type: formato, clip: { x: 0, y: 0, width: ancho, height: alto, scale: escala } };
                if (ruta) op.path = ruta;
                return page.screenshot(op);
            },
            async cerrar() { await page.close().catch(() => {}); await srv.cerrar(); if (limpiar) limpiar(); },
        };
        return api;
    }

    return {
        navegador,
        // Un cuadro aislado. `duracion`: la del storyboard (si falta, el data-duration de la raiz del cuadro).
        async abrirCuadro(id, { archivo = null, duracion = null, ancho = 1920, alto = 1080 } = {}) {
            const fuente = archivo ? resolve(archivo) : join(R, 'compositions/frames', `${id}.html`);
            if (!existsSync(fuente)) throw new Error(`No existe el cuadro ${id}: ${fuente}`);
            const texto = readFileSync(fuente, 'utf8');
            const raizDur = Number(new RegExp(`data-composition-id="${id}"[^>]*?data-duration="([\\d.]+)"`).exec(texto)?.[1] ?? /data-duration="([\d.]+)"/.exec(texto)?.[1]);
            const D = duracion ?? raizDur;
            if (!(D > 0)) throw new Error(`${id}: sin duracion (ni en STORYBOARD.md ni en la raiz del cuadro)`);
            const p = proyectoDeUnCuadro(R, id, { archivo, duracion: D, ancho, alto });
            let html;
            try { html = await compilar(p.dir); } catch (e) { p.limpiar(); throw e; }
            const c = await abrir(p.dir, html, { ancho, alto, limpiar: p.limpiar });
            c.meta = await c.page.evaluate((idc) => {
                const tl = (window.__timelines || {})[idc];
                const raizEl = document.querySelector(`[data-composition-id="${idc}"]`);
                return {
                    registrado: !!tl, duracionTimeline: tl ? tl.duration() : null, pausado: tl ? tl.paused() : null,
                    claves: Object.keys(window.__timelines || {}), tienePlayer: !!window.__player,
                    raizAncho: raizEl ? raizEl.getAttribute('data-width') : null, raizAlto: raizEl ? raizEl.getAttribute('data-height') : null,
                };
            }, id);
            Object.assign(c.meta, { id, duracion: D, raizDuracion: raizDur || null, fuente, texto });
            return c;
        },
        // El index.html completo del proyecto (o el HTML ya compilado que se pase).
        async abrirIndice({ html = null } = {}) {
            const h = html ?? await compilar(R);
            const { ancho, alto } = dimensiones(readFileSync(join(R, 'index.html'), 'utf8'));
            const c = await abrir(R, h, { ancho, alto });
            c.html = h;
            return c;
        },
        async cerrar() { await navegador.close(); },
    };
}
