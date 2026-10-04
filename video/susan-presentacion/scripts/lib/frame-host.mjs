// frame-host.mjs - arnes de UN cuadro: lo aloja en Chrome headless como lo hace el runtime de HyperFrames.
//
// Que reproduce del runtime (hyperframes 0.8.114, ver `bundleToSingleHtml` + adaptador gsap):
//   - un envoltorio .scene[data-composition-id=<id>] a 1920x1080 con la raiz del cuadro dentro (#root del cuadro);
//   - las fuentes y recursos por ruta relativa a la raiz del proyecto (<base href="/">, servidor estatico local);
//   - GSAP local (scripts/lib/vendor/gsap.min.js, 3.14.2, la misma version que usa el proyecto);
//   - el <script> del cuadro se ejecuta DESPUES de medir el CSS (para detectar transform CSS que choque con GSAP);
//   - posicionar el tiempo = timeline.pause() + totalTime(t, suppressEvents=false) + el "meneo" de +-1 ms que hace el adaptador;
//   - elementos con data-start/data-duration (class="clip" o no) se ocultan fuera de su ventana (visibility), en tiempo LOCAL del cuadro.
//
// API:
//   const host = await crearHost(raiz);                 // servidor + Chrome (uno para varios cuadros)
//   const c = await host.abrir('06-vivo', { archivo });  // -> { page, id, errores, meta, ir(t), captura(t, opts), cerrar() }
//   await host.cerrar();
import { createServer } from 'node:http';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lanzar } from './navegador.mjs';

const AQUI = dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.gif': 'image/gif' };

export function leerCuadro(raiz, id, archivo) {
    const ruta = archivo ? resolve(archivo) : join(raiz, 'compositions/frames', `${id}.html`);
    if (!existsSync(ruta)) throw new Error(`No existe el cuadro ${id}: ${ruta}`);
    return { ruta, texto: readFileSync(ruta, 'utf8') };
}

// Separa el <template> del cuadro en { contenido sin scripts, scripts inline[] }.
export function trocearCuadro(texto) {
    const m = /<template[^>]*>([\s\S]*)<\/template>\s*$/i.exec(texto.trim());
    const dentro = m ? m[1] : texto;
    const scripts = [];
    const contenido = dentro.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi, (todo, attrs, cuerpo) => {
        const src = /\bsrc="([^"]+)"/.exec(attrs)?.[1];
        if (src) return /gsap/i.test(src) ? '' : todo; // GSAP va local; otros externos se dejan
        scripts.push(cuerpo);
        return '';
    });
    return { tieneTemplate: !!m, contenido, scripts, original: dentro };
}

function htmlArnes(id, troceado) {
    const scripts = JSON.stringify(troceado.scripts).replace(/</g, '\\u003c');
    return `<!doctype html><html><head><meta charset="utf-8"><base href="/">
<style>*{margin:0;padding:0;box-sizing:border-box}html,body{width:1920px;height:1080px;overflow:hidden;background:#000}
#main{position:relative;width:1920px;height:1080px;overflow:hidden;background:#f7f5f2}
.scene{position:absolute;inset:0;width:100%;height:100%;background:#f7f5f2}</style>
<script src="/__vendor/gsap.min.js"></script><script>window.__timelines={};window.__errores=[];
window.addEventListener('error',function(e){window.__errores.push(String(e.message||e.error))});
window.addEventListener('unhandledrejection',function(e){window.__errores.push('promesa: '+String(e.reason))});</script>
</head><body><div id="main"><div id="__escena" class="scene" data-composition-id="${id}">${troceado.contenido}</div></div>
<script>
window.__ID=${JSON.stringify(id)};
window.__SCRIPTS=${scripts};
// Instantanea del transform CSS antes de que corra el script del cuadro (GSAP lo pisaria o lo mezclaria).
window.__cssTransform=function(){
  var r=[];var els=document.querySelectorAll('#__escena *');
  for(var i=0;i<els.length;i++){var el=els[i];if(/^(STYLE|SCRIPT)$/.test(el.tagName))continue;var cs=getComputedStyle(el);var t=cs.transform;
    var ident=!t||t==='none'||/^matrix\\(1, 0, 0, 1, 0, 0\\)$/.test(t)||/^matrix3d\\(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1\\)$/.test(t);
    var ind=(cs.translate&&cs.translate!=='none')||(cs.rotate&&cs.rotate!=='none')||(cs.scale&&cs.scale!=='none');
    if(!ident||ind){el.setAttribute('data-hf-csstf',ident?'(translate/rotate/scale)':t);r.push(el.id||el.className||el.tagName);}}
  return r;};
window.__correr=function(){
  for(var i=0;i<window.__SCRIPTS.length;i++){var s=document.createElement('script');s.textContent=window.__SCRIPTS[i];document.body.appendChild(s);}
};
// Ventanas de visibilidad (data-start/data-duration en tiempo local del cuadro).
window.__ventanas=function(){
  var out=[];var els=document.querySelectorAll('#__escena [data-start][data-duration]');
  for(var i=0;i<els.length;i++){var el=els[i];if(el.tagName==='AUDIO'||el.tagName==='VIDEO')continue;
    out.push({el:el,t0:parseFloat(el.getAttribute('data-start')),t1:parseFloat(el.getAttribute('data-start'))+parseFloat(el.getAttribute('data-duration'))});}
  return out;};
window.__ir=function(t){
  var tl=window.__timelines[window.__ID];if(!tl)throw new Error('sin timeline '+window.__ID);
  if(!window.__vent)window.__vent=window.__ventanas();
  tl.pause();tl.totalTime(t,false);tl.totalTime(t>=0.001?t-0.001:t+0.001,true);tl.totalTime(t,true);
  for(var i=0;i<window.__vent.length;i++){var v=window.__vent[i];var vis=t>=v.t0-1e-6&&t<v.t1-1e-6;v.el.style.visibility=vis?'':'hidden';}
};
</script></body></html>`;
}

export async function crearHost(raiz, opciones = {}) {
    raiz = resolve(raiz);
    const gsapLocal = readFileSync(join(AQUI, 'vendor/gsap.min.js'));
    const arnes = new Map(); // id -> { html }
    const srv = createServer((req, res) => {
        const u = decodeURIComponent((req.url || '/').split('?')[0]);
        if (u === '/__vendor/gsap.min.js') { res.writeHead(200, { 'content-type': 'text/javascript' }); res.end(gsapLocal); return; }
        const m = /^\/__cuadro\/([^/]+)$/.exec(u);
        if (m && arnes.has(m[1])) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }); res.end(arnes.get(m[1])); return; }
        const f = normalize(join(raiz, u));
        if (f.startsWith(raiz) && existsSync(f) && statSync(f).isFile()) {
            res.writeHead(200, { 'content-type': MIME[extname(f).toLowerCase()] ?? 'application/octet-stream', 'cache-control': 'no-store' });
            res.end(readFileSync(f));
        } else { res.writeHead(404); res.end(); }
    });
    await new Promise((r) => srv.listen(0, '127.0.0.1', r));
    const base = `http://127.0.0.1:${srv.address().port}`;
    const navegador = await lanzar(raiz);

    async function abrir(id, { archivo, ancho = 1920, alto = 1080 } = {}) {
        const { ruta, texto } = leerCuadro(raiz, id, archivo);
        const troceado = trocearCuadro(texto);
        arnes.set(id, htmlArnes(id, troceado));
        const page = await navegador.newPage();
        await page.setViewport({ width: ancho, height: alto, deviceScaleFactor: 1 });
        const erroresConsola = [];
        page.on('pageerror', (e) => erroresConsola.push(String(e.message || e)));
        page.on('requestfailed', (r) => erroresConsola.push(`recurso fallido: ${r.url().replace(base, '')}`));
        page.on('response', (r) => { if (r.status() >= 400) erroresConsola.push(`HTTP ${r.status()}: ${r.url().replace(base, '')}`); });
        await page.goto(`${base}/__cuadro/${id}`, { waitUntil: 'load', timeout: 60000 });
        await page.evaluate(() => document.fonts.ready);
        const transformCss = await page.evaluate(() => window.__cssTransform());
        await page.evaluate(() => window.__correr());
        await page.evaluate(() => document.fonts.ready);
        const meta = await page.evaluate((idc) => {
            const raizEl = document.querySelector('#__escena > [data-composition-id], #__escena #root, #__escena > div');
            const tl = window.__timelines[idc];
            return {
                registrado: !!tl,
                duracionTimeline: tl ? tl.duration() : null,
                pausado: tl ? tl.paused() : null,
                raizId: raizEl ? raizEl.getAttribute('data-composition-id') : null,
                raizDuracion: raizEl && raizEl.getAttribute('data-duration') ? parseFloat(raizEl.getAttribute('data-duration')) : null,
                raizAncho: raizEl ? raizEl.getAttribute('data-width') : null,
                raizAlto: raizEl ? raizEl.getAttribute('data-height') : null,
                claves: Object.keys(window.__timelines),
            };
        }, id);
        const errores = erroresConsola.concat(await page.evaluate(() => window.__errores));
        const api = {
            page, id, ruta, texto, troceado, meta, errores, transformCss,
            async ir(t) { await page.evaluate((x) => window.__ir(x), t); },
            async captura(t, { ruta: destino, escala = 1, formato = 'png' } = {}) {
                await api.ir(t);
                const opts = { type: formato, clip: { x: 0, y: 0, width: 1920, height: 1080, scale: escala } };
                if (destino) opts.path = destino;
                return page.screenshot(opts);
            },
            async cerrar() { await page.close(); },
        };
        return api;
    }

    return {
        base, raiz, navegador, abrir,
        async cerrar() { await navegador.close(); srv.close(); },
    };
}
