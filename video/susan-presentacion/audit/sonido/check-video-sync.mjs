#!/usr/bin/env node
// Comprueba que el fotograma N del MP4 renderizado corresponde al instante N/30 del timeline (desfase visual del render).
// Método: se busca el tiempo en Chrome (mismo bundle que `render`), se captura el cuadro, y se compara (MSE a 240x135) con los fotogramas
// k-4..k+4 del MP4 extraídos con ffmpeg; el desfase es el k con menor MSE. Se evalúan instantes de cambio rápido (slams, transiciones).
import { createServer } from 'node:http';
import { execSync, execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, extname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const HOME = process.env.HOME;
const base = join(HOME, '.npm/_npx');
const nm = readdirSync(base).map((d) => join(base, d, 'node_modules')).find((p) => existsSync(join(p, 'hyperframes/dist')) && existsSync(join(p, 'puppeteer-core')));
const dist = join(nm, 'hyperframes/dist');
const puppeteer = createRequire(import.meta.url)(join(nm, 'puppeteer-core'));
const { bundleToSingleHtml } = await import(pathToFileURL(join(dist, readdirSync(dist).find((f) => /^compiler-.*\.js$/.test(f)))).href);
const html = await bundleToSingleHtml(RAIZ);
const srv = createServer((req, res) => {
    const u = decodeURIComponent((req.url || '/').split('?')[0]);
    if (u === '/' || u === '/index.html') { res.writeHead(200, { 'content-type': 'text/html' }); res.end(html); return; }
    const f = join(RAIZ, u);
    if (existsSync(f) && statSync(f).isFile()) { res.writeHead(200); res.end(readFileSync(f)); } else { res.writeHead(404); res.end(); }
});
await new Promise((r) => srv.listen(0, '127.0.0.1', r));
const exe = execSync(`find ${join(HOME, '.cache/hyperframes/chrome')} -type f -name chrome-headless-shell | head -1`).toString().trim();
const browser = await puppeteer.launch({ executablePath: exe, headless: 'shell', args: ['--no-sandbox'] });
const pg = await browser.newPage();
await pg.setViewport({ width: 1920, height: 1080 });
await pg.goto(`http://127.0.0.1:${srv.address().port}/`, { waitUntil: 'networkidle0', timeout: 90000 });
await new Promise((r) => setTimeout(r, 2500));
const gris = (buf) => { // PNG/JPG -> 240x135 gris con ffmpeg
    return new Uint8Array(execFileSync('ffmpeg', ['-v', 'error', '-i', 'pipe:0', '-vf', 'scale=240:135,format=gray', '-f', 'rawvideo', '-'], { input: buf, maxBuffer: 1e8 }));
};
const mse = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) { const d = a[i] - b[i]; s += d * d; } return s / a.length; };
const tiempos = [4.6, 7.55, 11.4, 14.95, 17.7, 21.1, 23.8, 30.0, 35.75, 40.7, 52.2, 53.3];
const out = [];
for (const t of tiempos) {
    const k0 = Math.round(t * 30);
    await pg.evaluate((tt) => { (window.__hf && window.__hf.seek) ? window.__hf.seek(tt) : window.__player.renderSeek(tt); }, k0 / 30);
    await new Promise((r) => setTimeout(r, 250));
    const png = await pg.screenshot({ type: 'png' });
    const ref = gris(png);
    const cand = [];
    for (let d = -4; d <= 4; d++) {
        const tf = (k0 + d) / 30;
        const raw = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(tf), '-i', join(RAIZ, 'renders/video.mp4'), '-frames:v', '1', '-vf', 'scale=240:135,format=gray', '-f', 'rawvideo', '-'], { maxBuffer: 1e8 });
        cand.push({ d, mse: mse(ref, new Uint8Array(raw)) });
    }
    cand.sort((a, b) => a.mse - b.mse);
    out.push({ t, fotogramaEsperado: k0, mejorDesfaseFotogramas: cand[0].d, mseMejor: Math.round(cand[0].mse * 10) / 10, mseSegundo: Math.round(cand[1].mse * 10) / 10 });
    console.log(JSON.stringify(out.at(-1)));
}
await browser.close(); srv.close();
const sesgo = out.map((o) => o.mejorDesfaseFotogramas);
console.log('desfase (fotogramas) por instante:', sesgo.join(' '), ' -> mediana', sesgo.sort((a, b) => a - b)[Math.floor(sesgo.length / 2)]);
