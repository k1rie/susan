// Convierte un SVG en PNG con Chromium (Playwright). Busca Playwright primero en ./tools (instalado con
// npm --no-save) y despues en la instalacion global del equipo; nunca ejecuta "playwright install".
import { createRequire } from 'node:module';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

function cargarPlaywright() {
    const candidatos = [
        join(AQUI, 'tools', 'node_modules', 'playwright'),
        '/opt/node22/lib/node_modules/playwright',
        'playwright',
    ];
    for (const c of candidatos) {
        try {
            if (c !== 'playwright' && !existsSync(c)) continue;
            return require(c);
        } catch { /* siguiente candidato */ }
    }
    throw new Error('Playwright no esta disponible: instalar con "npm --no-save" dentro de reporte/bd/tools');
}

let navegador = null;

export async function renderizarPng(rutaSvg, ancho, alto, anchoMinimoPx = 2600) {
    const { chromium } = cargarPlaywright();
    if (!navegador) navegador = await chromium.launch();
    const escala = Math.min(4, Math.max(2, Math.ceil(anchoMinimoPx / ancho)));
    const pagina = await navegador.newPage({ viewport: { width: ancho, height: alto }, deviceScaleFactor: escala });
    await pagina.goto(pathToFileURL(rutaSvg).href);
    const salida = rutaSvg.replace(/\.svg$/, '.png');
    await pagina.screenshot({ path: salida, clip: { x: 0, y: 0, width: ancho, height: alto } });
    await pagina.close();
    return { ruta: salida, pxAncho: ancho * escala, pxAlto: alto * escala, escala };
}

// Hay que cerrar el navegador de forma explicita; si no, el proceso de Node no termina.
export async function cerrarNavegador() {
    if (navegador) { const n = navegador; navegador = null; await n.close(); }
}
