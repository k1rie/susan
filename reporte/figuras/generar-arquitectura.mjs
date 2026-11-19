// Genera la figura de arquitectura general de SUSAN (SVG + PNG de al menos 2400 px de ancho).
// Uso: node generar-arquitectura.mjs   (escribe arquitectura.svg y arquitectura.png junto a este archivo)
// Los hechos de la figura salen del repositorio: docs/ARCHITECTURE.md (capas), hardware/estacion-aula/ (estación y
// protocolo serie) y recognition-service/ (endpoint /v1/recognize). Playwright se busca primero en ./tools y luego en
// la instalación global; nunca se ejecuta "playwright install".
import { createRequire } from 'node:module';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// ---------------------------------------------------------------- paleta y medidas
const FUENTE = "'Liberation Sans', Arial, Helvetica, sans-serif";
const C = {
    lienzo: '#ffffff',
    panel: '#eef0f2',
    panelBorde: '#cfd4da',
    caja: '#ffffff',
    cajaBorde: '#9aa3ad',
    titulo: '#1d2733',
    subtitulo: '#5b6570',
    nucleo: '#1f4e79',
    nucleoTexto: '#ffffff',
    nucleoSub: '#d3e3f3',
    panelNucleo: '#e3edf7',
    panelNucleoBorde: '#8fb0d1',
    flecha: '#3b4652',
    pendiente: '#8a4b00',
};

const W = 900;
const ALTO_PANEL = 150;
const T = { aula: 16, pc: 232, app: 448, bd: 664 };   // arriba de cada capa
const H = T.bd + ALTO_PANEL + 16;                       // alto total
const CAJA_Y = 42;                                       // desplazamiento de las cajas dentro de la capa
const CAJA_H = 92;

const partes = [];
const add = (s) => partes.push(s);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// ---------------------------------------------------------------- piezas
function panel({ x, y, w, titulo, nucleo = false }) {
    add(`<rect x="${x}" y="${y}" width="${w}" height="${ALTO_PANEL}" rx="14" fill="${nucleo ? C.panelNucleo : C.panel}" stroke="${nucleo ? C.panelNucleoBorde : C.panelBorde}" stroke-width="1.4"/>`);
    add(`<text x="${x + 18}" y="${y + 27}" font-family="${FUENTE}" font-size="15" font-weight="700" fill="${nucleo ? C.nucleo : C.titulo}">${esc(titulo)}</text>`);
}

function caja({ x, y, w, titulo, lineas, nucleo = false }) {
    add(`<rect x="${x}" y="${y}" width="${w}" height="${CAJA_H}" rx="9" fill="${nucleo ? C.nucleo : C.caja}" stroke="${nucleo ? C.nucleo : C.cajaBorde}" stroke-width="1.3"/>`);
    const cx = x + w / 2;
    add(`<text x="${cx}" y="${y + 31}" text-anchor="middle" font-family="${FUENTE}" font-size="16.5" font-weight="700" fill="${nucleo ? C.nucleoTexto : C.titulo}">${esc(titulo)}</text>`);
    lineas.forEach((l, i) => {
        add(`<text x="${cx}" y="${y + 54 + i * 18}" text-anchor="middle" font-family="${FUENTE}" font-size="13" fill="${nucleo ? C.nucleoSub : C.subtitulo}">${esc(l)}</text>`);
    });
}

// Flecha recta con puntas opcionales; la etiqueta se coloca con (lx, ly) y ancla.
function flecha({ x1, y1, x2, y2, inicio = false, fin = true, discontinua = false }) {
    const color = discontinua ? C.pendiente : C.flecha;
    const m = discontinua ? 'url(#punta-pend)' : 'url(#punta)';
    const mi = discontinua ? 'url(#punta-pend-ini)' : 'url(#punta-ini)';
    add(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="2.2"${discontinua ? ' stroke-dasharray="8 6"' : ''}${fin ? ` marker-end="${m}"` : ''}${inicio ? ` marker-start="${mi}"` : ''}/>`);
}

function etiqueta({ x, y, lineas, ancla = 'start', color = C.flecha, negrita = false, rot = 0 }) {
    const tr = rot ? ` transform="rotate(${rot} ${x} ${y})"` : '';
    lineas.forEach((l, i) => {
        add(`<text x="${x}" y="${y + i * 16}" text-anchor="${ancla}" font-family="${FUENTE}" font-size="13.5" font-weight="${negrita ? 700 : 400}" fill="${color}"${tr}>${esc(l)}</text>`);
    });
}

// ---------------------------------------------------------------- composición
add(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="Arquitectura general del sistema SUSAN">`);
add(`<defs>
<marker id="punta" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C.flecha}"/></marker>
<marker id="punta-ini" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M10,0 L0,5 L10,10 z" fill="${C.flecha}"/></marker>
<marker id="punta-pend" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0,0 L10,5 L0,10 z" fill="${C.pendiente}"/></marker>
<marker id="punta-pend-ini" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M10,0 L0,5 L10,10 z" fill="${C.pendiente}"/></marker>
</defs>`);
add(`<rect width="${W}" height="${H}" fill="${C.lienzo}"/>`);

const xIzq = 70, wIzq = 460;            // capas de la columna izquierda
const xSvc = 640, wSvc = 240;           // servicio de reconocimiento
const wTodo = 810;                      // capas de ancho completo (x = 70)
const cajaIzq = 202;                    // ancho de las cajas de la columna izquierda

// Capa 1: Aula
panel({ x: xIzq, y: T.aula, w: wTodo, titulo: 'Aula' });
caja({ x: 88, y: T.aula + CAJA_Y, w: 452, titulo: 'Estación de aula (Arduino UNO R3)', lineas: ['Lector RFID MFRC522 · pantalla LCD 16x2 (I2C)', '3 LED · zumbador · pulsador'] });
caja({ x: 658, y: T.aula + CAJA_Y, w: 204, titulo: 'Cámara IP del aula', lineas: ['entrega un fotograma', 'por HTTP (snapshot)'] });

// Capa 2: Computadora del docente
panel({ x: xIzq, y: T.pc, w: wIzq, titulo: 'Computadora del docente' });
caja({ x: 88, y: T.pc + CAJA_Y, w: cajaIzq, titulo: 'Puente serie (Node)', lineas: ['lee y escribe el', 'puerto USB de la estación'] });
caja({ x: 88 + cajaIzq + 16, y: T.pc + CAJA_Y, w: cajaIzq, titulo: 'Navegador', lineas: ['interfaz web del docente', 'webcam opcional'] });

// Capa 3a: Aplicación web (núcleo)
panel({ x: xIzq, y: T.app, w: wIzq, titulo: 'Aplicación web (Next.js 16)', nucleo: true });
caja({ x: 88, y: T.app + CAJA_Y, w: cajaIzq, titulo: 'Páginas y formularios', lineas: ['pantallas P-01 a P-09', 'React 19 · Tailwind 4'], nucleo: true });
caja({ x: 88 + cajaIzq + 16, y: T.app + CAJA_Y, w: cajaIzq, titulo: 'Route Handlers', lineas: ['/api/*: autentican,', 'validan y llaman a la BD'], nucleo: true });

// Capa 3b: Servicio de reconocimiento
panel({ x: xSvc, y: T.app, w: wSvc, titulo: 'Servicio de reconocimiento' });
caja({ x: 658, y: T.app + CAJA_Y, w: 204, titulo: 'FastAPI + FAISS', lineas: ['detecta y vectoriza rostros', 'busca en el índice FAISS'] });

// Capa 4: Supabase / PostgreSQL 16
panel({ x: xIzq, y: T.bd, w: wTodo, titulo: 'Supabase / PostgreSQL 16' });
caja({ x: 88, y: T.bd + CAJA_Y, w: 400, titulo: 'Tablas, RPC y RLS', lineas: ['PostgreSQL 16: reglas de negocio,', 'seguridad por fila y bitácora'] });
caja({ x: 508, y: T.bd + CAJA_Y, w: 354, titulo: 'Storage privado', lineas: ['bucket susan-private:', 'recortes e índice FAISS (JSON)'] });

// ---------------------------------------------------------------- enlaces
// Estación <-> Puente (USB serie)
const xUsb = 88 + cajaIzq / 2;
flecha({ x1: xUsb, y1: T.aula + ALTO_PANEL, x2: xUsb, y2: T.pc, inicio: true });
etiqueta({ x: xUsb + 12, y: 195, lineas: ['USB serie 115200 8N1', 'líneas de texto ASCII'], negrita: false });

// Navegador <-> Aplicación web
const xNav = 88 + cajaIzq + 16 + cajaIzq / 2;
flecha({ x1: xNav, y1: T.pc + ALTO_PANEL, x2: xNav, y2: T.app, inicio: true });
etiqueta({ x: xNav + 12, y: 418, lineas: ['HTTP: páginas y /api/*'] });

// Aplicación web <-> Servicio de reconocimiento
const yRec = T.app + CAJA_Y + CAJA_H / 2;
flecha({ x1: xIzq + wIzq, y1: yRec, x2: xSvc, y2: yRec, inicio: true });
etiqueta({ x: (xIzq + wIzq + xSvc) / 2, y: yRec - 34, lineas: ['POST', '/v1/recognize'], ancla: 'middle' });

// Cámara IP -> Servicio de reconocimiento (el servicio jala el fotograma)
flecha({ x1: 760, y1: T.aula + CAJA_Y + CAJA_H, x2: 760, y2: T.app });
etiqueta({ x: 748, y: 304, lineas: ['fotograma', 'por HTTP'], ancla: 'end' });

// Aplicación web <-> Supabase
flecha({ x1: xNav, y1: T.app + ALTO_PANEL, x2: xNav, y2: T.bd, inicio: true });
etiqueta({ x: xNav + 12, y: 636, lineas: ['supabase-js · RPC'] });

// Servicio de reconocimiento <-> Storage
flecha({ x1: 760, y1: T.app + ALTO_PANEL, x2: 760, y2: T.bd, inicio: true });
etiqueta({ x: 748, y: 636, lineas: ['recortes e índice'], ancla: 'end' });

// Estación -> base de datos (pendiente): sale del puente por la izquierda y llega a la capa de datos
const yPuente = T.pc + CAJA_Y + CAJA_H / 2;
const yBd = T.bd + CAJA_Y + CAJA_H / 2;
add(`<path d="M 88 ${yPuente} H 44 V ${yBd} H 70" fill="none" stroke="${C.pendiente}" stroke-width="2.2" stroke-dasharray="8 6" stroke-linejoin="round" marker-end="url(#punta-pend)"/>`);
etiqueta({ x: 31, y: (yPuente + yBd) / 2, lineas: ['siguiente avance'], ancla: 'middle', color: C.pendiente, negrita: true, rot: -90 });

add('</svg>');

const svg = partes.join('\n');
const rutaSvg = join(AQUI, 'arquitectura.svg');
writeFileSync(rutaSvg, svg, 'utf8');

// ---------------------------------------------------------------- PNG (Chromium vía Playwright)
function cargarPlaywright() {
    const candidatos = [join(AQUI, 'tools', 'node_modules', 'playwright'), '/opt/node22/lib/node_modules/playwright', 'playwright'];
    for (const c of candidatos) {
        try {
            if (c !== 'playwright' && !existsSync(c)) continue;
            return require(c);
        } catch { /* siguiente candidato */ }
    }
    throw new Error('Playwright no está disponible: instalar con "npm --no-save playwright" dentro de reporte/figuras/tools');
}

const { chromium } = cargarPlaywright();
const navegador = await chromium.launch();
const escala = Math.max(2, Math.ceil(2700 / W));
const pagina = await navegador.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: escala });
await pagina.goto(pathToFileURL(rutaSvg).href);
const rutaPng = join(AQUI, 'arquitectura.png');
await pagina.screenshot({ path: rutaPng, clip: { x: 0, y: 0, width: W, height: H } });
await navegador.close();
console.log(`arquitectura.svg ${W}x${H}; arquitectura.png ${W * escala}x${H * escala} px`);
