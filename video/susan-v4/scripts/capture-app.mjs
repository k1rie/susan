#!/usr/bin/env node
// Captura de referencia de la app REAL de SUSAN (modo local de demostración) para el video v4.
//
// Produce, bajo capture/app-real/:
//   desktop/NN-slug.png        1920x1080 @2x, viewport, con movimiento y ya asentado (fuentes + animaciones de entrada)
//   desktop/NN-slug.rm.png     igual, segunda pasada con "reducir movimiento" (estado final sin animar)
//   desktop/NN-slug.clean.png  pasada rm sin la tarjeta «Reloj de demostración» (solo existe en modo local)
//   desktop/NN-slug.full.png   página completa (en escritorio el panel blanco hace su propio scroll: se desenrolla con CSS)
//   mobile/NN-slug.png         390x844 @3x (+ .full.png si hace scroll) para las pantallas que importan en el teléfono
//   dom/NN-slug.html           outerHTML renderizado sin scripts, con CSS, fuentes e imágenes copiadas a dom/assets/
//   crops/NN-slug--Comp.png    recorte @2x de cada componente clave (ubicado por el árbol de React del modo dev)
//   crops/NN-slug.json         cajas de esos componentes en px CSS de la página completa (x2 = px del .full.png)
//   video/*.webm               flujos interactivos a 1920x1080
//   tokens/globals.css + tokens.json
//   manifest.json              lo que se capturó (y lo que falló); de aquí sale INVENTORY.md
//
// Requisitos: la pila local arriba (docs/DEMO.md) y Playwright en este proyecto (npm i --no-save playwright@1.56.1).
// Uso:   node scripts/capture-app.mjs [--fases=estaticas,vivo,manual,videos,tokens,inventario] [--solo=slug1,slug2]
// Env:   CAPTURE_BASE (http://localhost:3100) · DEMO_PASSWORD (la de desarrollo del README) · SUSAN_REPO (raíz del repo)
//        PGBIN/PGUSER/WEB_PORT se pasan tal cual a scripts/seed-demo.sh --reset (fases vivo y manual).
// Las fases vivo y manual MODIFICAN el escenario de hoy (abren y cierran la sesión 19 / 115) y terminan con
// scripts/seed-demo.sh --reset para dejarlo como estaba.

import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const REPO = process.env.SUSAN_REPO ?? path.resolve(AQUI, '../../..');
const OUT = path.resolve(AQUI, '../capture/app-real');
const BASE = (process.env.CAPTURE_BASE ?? 'http://localhost:3100').replace(/\/$/, '');
const PASS = process.env.DEMO_PASSWORD ?? 'demo1234';
// Instante del escenario de la demostración (lunes 14-sep-2026 07:12, sede -06). El navegador se pone a esta hora para que
// el saludo («Buenos días») y los «hace N» coincidan con el reloj de negocio del servidor.
const HORA_DEMO = new Date('2026-09-14T07:12:00-06:00');
const ZONA = 'America/Mexico_City';

const args = Object.fromEntries(process.argv.slice(2).map((a) => a.replace(/^--/, '').split('=')).map(([k, v]) => [k, v ?? '1']));
const FASES = (args.fases ?? 'estaticas,vivo,manual,videos,tokens,inventario').split(',');
const SOLO = args.solo ? new Set(args.solo.split(',')) : null;

const ESCRITORIO = { width: 1920, height: 1080 };
const MOVIL = { width: 390, height: 844 };
const UA_MOVIL = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';

const manifiesto = { generado: new Date().toISOString(), base: BASE, horaDemo: HORA_DEMO.toISOString(), pantallas: [], videos: [], fallas: [] };
const log = (...a) => console.log('[captura]', ...a);
let faseActual = '';
const falla = (donde, e) => {
    const msg = String(e?.message ?? e).split('\n')[0];
    manifiesto.fallas.push({ fase: faseActual, donde, error: msg });
    console.warn('[captura] FALLA', donde, msg);
};

// ------------------------------------------------------------------------------------------------ componentes a recortar
// Nombres = carpetas de web/src/components con mayúscula inicial (convención "un componente = una carpeta"), menos los
// envoltorios de pantalla completa y las primitivas de formulario (demasiado chicas o repetidas para servir de referencia).
const EXCLUIR = new Set([
    'AppShell', 'AppShellCliente', 'HomeRol', 'PanelDocente', 'PortalAlumno', 'Analitica', 'ReporteAsistencia', 'ConsolaTecnico',
    'SesionClase', 'ColaRevision', 'Onboarding', 'Button', 'Input', 'Select', 'Field', 'Checkbox', 'Textarea', 'Spinner',
    'PasswordInput', 'FileInput', 'Toast', 'DataState', 'Reveal', 'StaggerList', 'BlurText', 'CountUp', 'Card', 'Badge',
    'Avatar', 'Detalles', 'Pagination', 'ShellContext', 'AuthCard',
]);
function nombresDeComponentes() {
    const raiz = path.join(REPO, 'web/src/components');
    const out = new Set();
    const recorrer = (dir, prof) => {
        for (const n of readdirSync(dir)) {
            const p = path.join(dir, n);
            if (!statSync(p).isDirectory()) continue;
            if (/^[A-Z]/.test(n)) out.add(n);
            else if (prof < 2) recorrer(p, prof + 1);
        }
    };
    recorrer(raiz, 0);
    for (const n of EXCLUIR) out.delete(n);
    return [...out].sort();
}
const COMPONENTES = nombresDeComponentes();
const MAX_POR_COMPONENTE = 6;
// El cromo del AppShell se repite en todas las pantallas: se recorta solo en estas.
const CROMO = new Set(['Sidebar', 'BrandMark', 'MenuCuenta', 'RelojDemo', 'TopbarMovil', 'BottomNav']);
const PANTALLAS_CON_CROMO = new Set(['10-docente-home', '50-alumno-e260001-limite', '60-admin-resumen', '80-tecnico-camaras', '30-pasar-lista-inicio']);

// ------------------------------------------------------------------------------------------------ pantallas
// cuenta: null = sin sesión. movil: también a 390x844. accion(page, {movil}): deja la pantalla en el estado a capturar.
const tab = (nombre) => async (page) => {
    await page.getByRole('tab', { name: nombre }).first().click();
    await page.waitForTimeout(400);
};
const abrirPaleta = async (page) => {
    await page.keyboard.press('Control+k');
    await page.getByRole('dialog').first().waitFor({ timeout: 8000 });
    await page.waitForTimeout(300);
};
const elegirGrupo = (etiqueta) => async (page) => {
    await page.getByLabel('Grupo', { exact: true }).first().selectOption({ label: etiqueta });
};
const abrirDetalles = async (page) => {
    await page.evaluate(() => document.querySelectorAll('main details').forEach((d) => { d.open = true; }));
    await page.waitForTimeout(300);
};
const primerCaso = async (page) => {
    await page.locator('[role="tabpanel"] button').filter({ hasText: /Quedan|Pendiente|Por resolver|pendiente/ }).first().click();
};

const PANTALLAS = [
    // ---- públicas
    { nn: '01', slug: 'login', cuenta: null, ruta: '/login', movil: true, desc: 'Acceso: tarjeta de inicio de sesión con el panel de producto.' },
    { nn: '02', slug: 'recuperar', cuenta: null, ruta: '/recuperar', desc: 'Recuperar contraseña.' },
    { nn: '03', slug: 'activar-cuenta', cuenta: null, ruta: '/activar-cuenta', desc: 'Activar cuenta (sin enlace válido).' },
    // ---- docente1 (Patricia Ortega Salinas: 3A y 5C)
    { nn: '10', slug: 'docente-home', cuenta: 'docente1', ruta: '/docente', movil: true, desc: 'Home del docente: saludo, campo ⌘K, tarjeta «Pasar lista» del 3A, pendientes, sesiones de hoy, alertas, mis grupos, herramientas.' },
    { nn: '11', slug: 'docente-paleta', cuenta: 'docente1', ruta: '/docente', movil: true, accion: abrirPaleta, desc: 'Paleta de comandos ⌘K abierta sobre el Home.' },
    { nn: '12', slug: 'docente-menu-cuenta', cuenta: 'docente1', ruta: '/docente', accion: async (page) => { await page.locator('aside').getByRole('button', { name: /Patricia/ }).first().click(); await page.waitForTimeout(400); }, desc: 'Menú de cuenta abierto (riel lateral).' },
    { nn: '13', slug: 'docente-nav-movil', cuenta: 'docente1', ruta: '/docente', soloMovil: true, accion: async (page) => { await page.getByRole('button', { name: 'Abrir menú' }).click({ timeout: 8000 }); await page.waitForTimeout(700); }, desc: 'Móvil: cajón de navegación (el riel) abierto desde el botón de menú de la barra superior; la barra flotante inferior queda debajo.' },
    { nn: '14', slug: 'modulos', cuenta: 'docente1', ruta: '/modulos', desc: 'Catálogo de módulos (Pills por categoría, TarjetaPortada).' },
    { nn: '15', slug: 'modulo-notificaciones', cuenta: 'docente1', ruta: '/modulos/notificaciones', desc: 'Notificaciones: módulo «Próximamente» (no hay pantalla de notificaciones aún).' },
    { nn: '16', slug: 'modulo-asistente', cuenta: 'docente1', ruta: '/modulos/asistente', desc: 'Asistente SUSAN: módulo «Próximamente» con portada en degradado.' },
    { nn: '17', slug: 'reportes-periodo', cuenta: 'docente1', ruta: '/reportes', desc: 'Reportes: resumen del periodo de los grupos del docente.' },
    { nn: '18', slug: 'reportes-grupos-tab', cuenta: 'docente1', ruta: '/reportes', accion: tab(/Grupos/), desc: 'Reportes: pestaña «Grupos».' },
    { nn: '19', slug: 'reportes-grupo-3a', cuenta: 'docente1', ruta: '/reportes?grupo=1', desc: 'Reportes del grupo 3A (detalle de grupo).' },
    { nn: '20', slug: 'reportes-alumno', cuenta: 'docente1', ruta: '/reportes?grupo=1&alumno=1', desc: 'Reportes: detalle de un alumno (E260001, en el límite).' },
    { nn: '21', slug: 'analitica-3a', cuenta: 'docente1', ruta: '/analitica?grupo=1', movil: true, desc: 'Analítica de ausentismo del 3A: cifras, avisos, serie semanal con proyección, acumulado, patrón semanal, riesgo.' },
    { nn: '22', slug: 'analitica-3a-procedimiento', cuenta: 'docente1', ruta: '/analitica?grupo=1', accion: abrirDetalles, desc: 'Analítica del 3A con los paneles «Detalles» (procedimiento numérico) abiertos.' },
    { nn: '23', slug: 'analitica-5c', cuenta: 'docente1', ruta: '/analitica?grupo=3', desc: 'Analítica de ausentismo del 5C.' },
    { nn: '24', slug: 'revision-pendientes', cuenta: 'docente1', ruta: '/docente/revision', movil: true, desc: 'Revisión: 8 pendientes de las clases de reposición.' },
    { nn: '25', slug: 'revision-caso', cuenta: 'docente1', ruta: '/docente/revision', accion: primerCaso, desc: 'Revisión: caso abierto con lecturas, recortes de rostro sintéticos y «Resolver como».' },
    { nn: '26', slug: 'revision-justificantes', cuenta: 'docente1', ruta: '/docente/revision?pestana=justificantes', desc: 'Revisión: 4 justificantes por resolver.' },
    { nn: '27', slug: 'revision-justificante', cuenta: 'docente1', ruta: '/docente/revision?pestana=justificantes', accion: async (page) => { await page.locator('[role="tabpanel"] button').first().click(); }, desc: 'Revisión: justificante abierto.' },
    { nn: '28', slug: 'revision-correcciones', cuenta: 'docente1', ruta: '/docente/revision?pestana=correcciones', desc: 'Revisión: correcciones.' },
    { nn: '29', slug: 'sesion-cerrada-18', cuenta: 'docente1', ruta: '/docente/sesiones/18', desc: 'Resumen de una sesión cerrada (3A, 11-sep).' },
    // ---- otros docentes
    { nn: '40', slug: 'docente2-home', cuenta: 'docente2', ruta: '/docente', desc: 'Home de docente2 (3B).' },
    { nn: '41', slug: 'docente2-analitica-3b', cuenta: 'docente2', ruta: '/analitica?grupo=2', desc: 'Analítica del 3B (docente2).' },
    { nn: '42', slug: 'docente3-home-vacio', cuenta: 'docente3', ruta: '/docente', desc: 'Home de docente3 (en licencia, sin grupos): estado vacío.' },
    // ---- alumnos
    { nn: '50', slug: 'alumno-e260001-limite', cuenta: 'e260001', ruta: '/alumno', movil: true, desc: 'Vista del alumno E260001: en el límite (9 de 9 faltas).' },
    { nn: '51', slug: 'alumno-e260014-sin-derecho', cuenta: 'e260014', ruta: '/alumno', movil: true, desc: 'Vista del alumno E260014: sin derecho a examen.' },
    { nn: '52', slug: 'alumno-e260016-justificante', cuenta: 'e260016', ruta: '/alumno', desc: 'Vista del alumno E260016: justificante pendiente.' },
    { nn: '53', slug: 'alumno-e260016-justificar', cuenta: 'e260016', ruta: '/alumno', accion: async (page) => { await page.getByRole('button', { name: /^Justificar/ }).first().click(); await page.waitForTimeout(600); }, desc: 'Vista del alumno E260016: formulario «Justificar» abierto.' },
    { nn: '54', slug: 'alumno-e260024-justificadas', cuenta: 'e260024', ruta: '/alumno', desc: 'Vista del alumno E260024: faltas justificadas y aprobadas.' },
    { nn: '55', slug: 'alumno-e260025-baja', cuenta: 'e260025', ruta: '/alumno', desc: 'Vista del alumno E260025: inscripción en baja.' },
    { nn: '56', slug: 'alumno-paleta', cuenta: 'e260001', ruta: '/alumno', movil: true, accion: abrirPaleta, desc: 'Paleta ⌘K del alumno.' },
    // ---- administración
    { nn: '60', slug: 'admin-resumen', cuenta: 'admin', ruta: '/admin', desc: 'Home de administración: resumen del periodo.' },
    { nn: '61', slug: 'admin-grupos', cuenta: 'admin', ruta: '/admin/grupos', desc: 'Catálogo de grupos.' },
    { nn: '62', slug: 'admin-grupo-3a', cuenta: 'admin', ruta: '/admin/grupos/1', desc: 'Detalle del grupo 3A (datos).' },
    { nn: '63', slug: 'admin-grupo-3a-inscripciones', cuenta: 'admin', ruta: '/admin/grupos/1', accion: tab(/Inscripciones/), desc: 'Detalle del grupo 3A: inscripciones.' },
    { nn: '64', slug: 'admin-grupo-3a-horario', cuenta: 'admin', ruta: '/admin/grupos/1', accion: tab(/Horario/), desc: 'Detalle del grupo 3A: horario.' },
    { nn: '65', slug: 'admin-alumnos', cuenta: 'admin', ruta: '/admin/alumnos', desc: 'Catálogo de alumnos.' },
    { nn: '66', slug: 'admin-alumno-ficha', cuenta: 'admin', ruta: '/admin/alumnos/1', desc: 'Ficha del alumno E260001: consentimiento y plantilla facial.' },
    { nn: '67', slug: 'admin-docentes', cuenta: 'admin', ruta: '/admin/docentes', desc: 'Catálogo de docentes.' },
    { nn: '68', slug: 'admin-materias', cuenta: 'admin', ruta: '/admin/materias', desc: 'Catálogo de materias.' },
    { nn: '69', slug: 'admin-aulas', cuenta: 'admin', ruta: '/admin/aulas', desc: 'Catálogo de aulas.' },
    { nn: '70', slug: 'admin-usuarios', cuenta: 'admin', ruta: '/admin/usuarios', desc: 'Cuentas de acceso.' },
    { nn: '71', slug: 'admin-bitacora', cuenta: 'admin', ruta: '/admin/bitacora', desc: 'Bitácora de auditoría.' },
    { nn: '72', slug: 'admin-modulos', cuenta: 'admin', ruta: '/modulos', desc: 'Catálogo de módulos (administración: 17).' },
    { nn: '73', slug: 'admin-reportes', cuenta: 'admin', ruta: '/reportes', desc: 'Reportes como administración (3 grupos).' },
    // ---- técnico
    { nn: '80', slug: 'tecnico-camaras', cuenta: 'tecnico', ruta: '/tecnico', desc: 'Consola técnica: cámaras.' },
    { nn: '81', slug: 'tecnico-parametros', cuenta: 'tecnico', ruta: '/tecnico', accion: tab(/Parámetros/), desc: 'Consola técnica: parámetros del sistema.' },
    { nn: '82', slug: 'tecnico-indice', cuenta: 'tecnico', ruta: '/tecnico', accion: tab(/Índice facial/), desc: 'Consola técnica: índice facial.' },
];
// Onboarding (/bienvenida) se recorre aparte (pasos 90..), ver capturarOnboarding().

// ------------------------------------------------------------------------------------------------ utilidades de navegador
const CSS_CAPTURA = 'nextjs-portal{display:none!important}';
const CSS_SIN_RELOJ = 'section[aria-label*="Reloj de demostración"],[data-cap-reloj]{display:none!important}';
const CSS_DESENROLLAR = `html,body{height:auto!important;overflow:visible!important}
.lg\\:h-dvh{height:auto!important}.lg\\:overflow-hidden{overflow:visible!important}
main#contenido{overflow:visible!important;min-height:0!important}`;

async function nuevoContexto(browser, { movil = false, rm = false, video = null, estado = null, dpr } = {}) {
    const ctx = await browser.newContext({
        viewport: movil ? MOVIL : ESCRITORIO,
        deviceScaleFactor: dpr ?? (movil ? 3 : 2),
        isMobile: movil,
        hasTouch: movil,
        userAgent: movil ? UA_MOVIL : undefined,
        locale: 'es-MX',
        timezoneId: ZONA,
        reducedMotion: rm ? 'reduce' : 'no-preference',
        colorScheme: 'light',
        storageState: estado ?? undefined,
        recordVideo: video ? { dir: video, size: ESCRITORIO } : undefined,
    });
    // El indicador de Next (modo dev) tapa el avatar del riel: no es parte de la app.
    await ctx.addInitScript((css) => {
        const poner = () => {
            if (document.getElementById('cap-estilos')) return;
            const s = document.createElement('style');
            s.id = 'cap-estilos';
            s.textContent = css;
            (document.head || document.documentElement).appendChild(s);
        };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner);
        else poner();
    }, CSS_CAPTURA);
    if (!args['reloj-real']) {
        await ctx.clock.install({ time: HORA_DEMO });
    }
    return ctx;
}

const estados = new Map(); // cuenta -> storageState
async function sesion(browser, cuenta) {
    if (!cuenta) return null;
    if (estados.has(cuenta)) return estados.get(cuenta);
    const ctx = await browser.newContext({ viewport: ESCRITORIO, locale: 'es-MX', timezoneId: ZONA });
    // Ruta local de sesión (la misma que usa el formulario en modo local; ver docs/DEMO-RELOJ.md «Desde una terminal»).
    const r = await ctx.request.post(`${BASE}/api/_local/auth/login`, { headers: { Origin: BASE }, data: { email: `${cuenta}@susan.local`, password: PASS } }).catch(() => null);
    if (!r?.ok()) {
        // Respaldo: el formulario, esperando a que React hidrate (si no, el envío nativo deja la página en /login).
        const page = await ctx.newPage();
        await page.goto(`${BASE}/login`, { waitUntil: 'networkidle', timeout: 90000 });
        await page.waitForTimeout(1500);
        await page.fill('input[name=correo]', `${cuenta}@susan.local`);
        await page.fill('input[name=contrasena]', PASS);
        await Promise.all([page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60000 }), page.click('button[type=submit]')]);
    }
    const st = await ctx.storageState();
    if (!st.cookies.length) throw new Error(`sin cookie de sesión para ${cuenta}`);
    await ctx.close();
    estados.set(cuenta, st);
    return st;
}

async function asentar(page, extra = 1600) {
    await page.waitForLoadState('networkidle', { timeout: 25000 }).catch(() => {});
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    // Sin spinners de carga a la vista (DataState pinta <Spinner role="status">).
    await page
        .waitForFunction(() => ![...document.querySelectorAll('[role="status"]')].some((n) => n.querySelector('.animate-spin') && n.checkVisibility?.()), null, { timeout: 15000 })
        .catch(() => {});
    await page.waitForTimeout(extra);
}

async function ponerCss(page, id, css) {
    await page.evaluate(([id, css]) => {
        let s = document.getElementById(id);
        if (!s) {
            s = document.createElement('style');
            s.id = id;
            document.head.appendChild(s);
        }
        s.textContent = css;
    }, [id, css]);
}
const quitarCss = (page, id) => page.evaluate((id) => document.getElementById(id)?.remove(), id);

// Marca la tarjeta del reloj de demostración para poder ocultarla (la variante .clean).
async function marcarReloj(page) {
    await page.evaluate(() => {
        const t = [...document.querySelectorAll('main *')].find((n) => n.childElementCount > 0 && /^Reloj de demostración/.test(n.innerText || '') && n.getBoundingClientRect().height < 200);
        let n = t;
        // Sube hasta el contenedor directo de <main> (el envoltorio del AppShell).
        while (n && n.parentElement && n.parentElement.id !== 'contenido') n = n.parentElement;
        if (n && n.parentElement?.id === 'contenido' && /Reloj de demostración/.test(n.innerText)) n.setAttribute('data-cap-reloj', '');
    });
}

async function haceScroll(page, movil) {
    return page.evaluate((movil) => {
        if (movil) return document.scrollingElement.scrollHeight > innerHeight + 4;
        const m = document.querySelector('main#contenido');
        if (m && m.scrollHeight > m.clientHeight + 4) return true;
        return document.scrollingElement.scrollHeight > innerHeight + 4;
    }, movil);
}

async function irArriba(page) {
    await page.evaluate(() => {
        window.scrollTo(0, 0);
        const m = document.querySelector('main#contenido');
        if (m) m.scrollTop = 0;
    });
}

// Localiza las instancias de componentes por el árbol de fibras de React (modo dev conserva los nombres de función) y marca
// el nodo DOM raíz de cada una con data-cap="Nombre" (también queda en el DOM volcado: sirve de mapa a quien reconstruya).
async function marcarComponentes(page) {
    return page.evaluate(([nombres, max]) => {
        document.querySelectorAll('[data-cap]').forEach((n) => { n.removeAttribute('data-cap'); n.removeAttribute('data-cap-key'); });
        const set = new Set(nombres);
        const clave = Object.keys(document.body).find((k) => k.startsWith('__reactFiber$'));
        if (!clave) return { error: 'sin fibra de React' };
        let f = document.body[clave];
        while (f.return) f = f.return;
        const raiz = f.stateNode?.current ?? f;
        const nombreDe = (t) => {
            if (!t) return null;
            if (typeof t === 'function') return t.displayName || t.name;
            if (typeof t === 'object') return t.displayName || t.render?.displayName || t.render?.name || t.type?.displayName || t.type?.name || null;
            return null;
        };
        const raicesHost = (fib) => {
            const out = [];
            const visitar = (n) => {
                for (let c = n; c; c = c.sibling) {
                    if (c.tag === 5) out.push(c.stateNode);
                    else if (c.tag !== 6) visitar(c.child);
                }
            };
            visitar(fib.child);
            return out;
        };
        const instancias = [];
        const vistos = new Set();
        const cuenta = {};
        const pila = [raiz];
        while (pila.length) {
            const n = pila.pop();
            if ([0, 1, 11, 14, 15].includes(n.tag)) {
                const nm = nombreDe(n.type);
                if (nm && set.has(nm)) {
                    const hosts = raicesHost(n).filter((e) => e instanceof Element);
                    const el = hosts[0];
                    const idv = el && `${nm}::${hosts.length}`;
                    if (el && !(vistos.has(el) && el.getAttribute('data-cap')?.split(' ').includes(nm))) {
                        vistos.add(el);
                        const r = el.getBoundingClientRect();
                        const visible = r.width > 2 && r.height > 2 && !el.closest('.sr-only') && (el.checkVisibility?.({ checkOpacity: false, checkVisibilityCSS: true }) ?? true);
                        if (visible) {
                            cuenta[nm] = (cuenta[nm] ?? 0) + 1;
                            if (cuenta[nm] <= max) {
                                const key = String(instancias.length);
                                el.setAttribute('data-cap', [el.getAttribute('data-cap'), nm].filter(Boolean).join(' '));
                                if (!el.hasAttribute('data-cap-key')) el.setAttribute('data-cap-key', key);
                                instancias.push({ componente: nm, instancia: cuenta[nm], key: el.getAttribute('data-cap-key'), raices: hosts.length, etiqueta: el.tagName.toLowerCase(), clases: String(el.getAttribute('class') ?? '').slice(0, 400), idv });
                            }
                        }
                    }
                }
            }
            if (n.sibling) pila.push(n.sibling);
            if (n.child) pila.push(n.child);
        }
        return { instancias, conteo: cuenta };
    }, [COMPONENTES, MAX_POR_COMPONENTE]);
}

// Cajas en px CSS del documento (con el panel desenrollado en escritorio = coordenadas del .full.png / 2).
async function cajas(page) {
    return page.evaluate(() => {
        const out = {};
        document.querySelectorAll('[data-cap-key]').forEach((el) => {
            const r = el.getBoundingClientRect();
            out[el.getAttribute('data-cap-key')] = { x: Math.round(r.left + scrollX), y: Math.round(r.top + scrollY), width: Math.round(r.width), height: Math.round(r.height) };
        });
        return out;
    });
}

// Cifras visibles: tarjetas de cifra, resúmenes de gráficas (texto alternativo) y titulares. Alimenta INVENTORY.md.
async function cifras(page) {
    return page.evaluate(() => {
        const limpio = (t) => String(t ?? '').replace(/\s+/g, ' ').trim();
        const main = document.querySelector('main') ?? document.body;
        const titulos = [...main.querySelectorAll('h1,h2')].map((h) => limpio(h.innerText)).filter(Boolean).slice(0, 20);
        const stat = [...document.querySelectorAll('[data-cap~="StatCard"]')].map((n) => limpio(n.innerText)).slice(0, 12);
        const resumenes = [...main.querySelectorAll('[role="img"][aria-label], figure [aria-label]')]
            .map((n) => limpio(n.getAttribute('aria-label')))
            .filter((t) => /\d/.test(t))
            .filter((t, i, a) => a.indexOf(t) === i)
            .slice(0, 14);
        const sr = [...main.querySelectorAll('figure p.sr-only, figure .sr-only, figcaption')].map((n) => limpio(n.textContent)).filter((t) => /\d/.test(t) && t.length < 600).filter((t, i, a) => a.indexOf(t) === i).slice(0, 10);
        const texto = limpio(main.innerText).replace(/^Reloj de demostración.*?Fijar hora/, '').slice(0, 3000);
        return { titulos, stat, resumenes, sr, texto };
    });
}

// ------------------------------------------------------------------------------------------------ volcado del DOM
const cacheRecursos = new Map(); // url absoluta -> ruta relativa a dom/
async function bajar(ctx, url, sub, extPorDefecto) {
    if (cacheRecursos.has(url)) return cacheRecursos.get(url);
    const r = await ctx.request.get(url).catch(() => null);
    if (!r || !r.ok()) return null;
    const cuerpo = await r.body();
    const tipo = r.headers()['content-type'] ?? '';
    let base = path.basename(new URL(url).pathname).replace(/[^\w.-]+/g, '_') || 'recurso';
    if (sub === 'img') {
        const ext = /svg/.test(tipo) ? '.svg' : /png/.test(tipo) ? '.png' : /jpe?g/.test(tipo) ? '.jpg' : /webp/.test(tipo) ? '.webp' : /avif/.test(tipo) ? '.avif' : extPorDefecto ?? path.extname(base);
        base = crypto.createHash('sha1').update(url).digest('hex').slice(0, 12) + ext;
    }
    let datos = cuerpo;
    if (sub === 'css') {
        // Fuentes e imágenes que pide la hoja: también locales.
        let css = cuerpo.toString('utf8');
        const urls = [...new Set([...css.matchAll(/url\((['"]?)([^'")]+)\1\)/g)].map((m) => m[2]).filter((u) => !u.startsWith('data:')))];
        for (const u of urls) {
            const abs = new URL(u, url).href;
            const local = await bajar(ctx, abs, 'media');
            if (local) css = css.split(u).join('../' + local.replace(/^assets\//, ''));
        }
        datos = Buffer.from(css, 'utf8');
        base = base.endsWith('.css') ? base : base + '.css';
    }
    const rel = `assets/${sub}/${base}`;
    await fs.mkdir(path.join(OUT, 'dom', 'assets', sub), { recursive: true });
    await fs.writeFile(path.join(OUT, 'dom', rel), datos);
    cacheRecursos.set(url, rel);
    return rel;
}

async function volcarDom(page, archivo, meta) {
    const { html, hojas, imagenes } = await page.evaluate(() => {
        const vivos = [...document.querySelectorAll('canvas')];
        const camposVivos = [...document.querySelectorAll('input,select,textarea')];
        const clon = document.documentElement.cloneNode(true);
        // Los <canvas> (cámara simulada) no viajan en el HTML: se cambian por la imagen de su contenido.
        [...clon.querySelectorAll('canvas')].forEach((c, i) => {
            try {
                const img = document.createElement('img');
                img.src = vivos[i].toDataURL('image/png');
                for (const a of c.getAttributeNames()) img.setAttribute(a, c.getAttribute(a));
                img.setAttribute('data-desde-canvas', `${vivos[i].width}x${vivos[i].height}`);
                c.replaceWith(img);
            } catch {
                /* lienzo protegido: se deja vacío */
            }
        });
        [...clon.querySelectorAll('input,select,textarea')].forEach((c, i) => {
            const v = camposVivos[i];
            if (!v) return;
            if (c.tagName === 'SELECT') [...c.options].forEach((o, j) => { if (v.options[j]?.selected) o.setAttribute('selected', ''); else o.removeAttribute('selected'); });
            else if (c.type === 'checkbox' || c.type === 'radio') { if (v.checked) c.setAttribute('checked', ''); else c.removeAttribute('checked'); }
            else if (c.tagName === 'TEXTAREA') c.textContent = v.value;
            else c.setAttribute('value', v.value);
        });
        clon.querySelectorAll('script,noscript,nextjs-portal,link[rel="preload"],link[rel="modulepreload"],link[rel="prefetch"],link[rel="dns-prefetch"],#cap-estilos,#cap-sin-reloj,#cap-desenrollar').forEach((n) => n.remove());
        const hojas = [...clon.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'));
        const imagenes = [...clon.querySelectorAll('img[src]')].map((i) => i.getAttribute('src')).filter((s) => !s.startsWith('data:'));
        clon.querySelectorAll('img[srcset]').forEach((i) => { i.removeAttribute('srcset'); i.removeAttribute('sizes'); });
        return { html: clon.outerHTML, hojas, imagenes };
    });
    let salida = html;
    const ctx = page.context();
    for (const h of [...new Set(hojas)]) {
        const local = await bajar(ctx, new URL(h, BASE).href, 'css');
        if (local) salida = salida.split(`href="${h.replace(/&/g, '&amp;')}"`).join(`href="${local}"`).split(`href="${h}"`).join(`href="${local}"`);
    }
    for (const s of [...new Set(imagenes)]) {
        const local = await bajar(ctx, new URL(s, BASE).href, 'img');
        if (local) salida = salida.split(`src="${s.replace(/&/g, '&amp;')}"`).join(`src="${local}"`).split(`src="${s}"`).join(`src="${local}"`);
    }
    const cabecera = `<!doctype html>\n<!-- SUSAN · captura de la app real (modo local de demostración)\n     ruta: ${meta.ruta} · rol: ${meta.cuenta ?? 'sin sesión'} · viewport: ${meta.viewport} · ${new Date().toISOString()}\n     Scripts quitados; CSS, fuentes e imágenes copiadas a dom/assets/. data-cap="Componente" marca la raíz de cada componente de web/src/components. -->\n`;
    await fs.writeFile(archivo, cabecera + salida);
}

// ------------------------------------------------------------------------------------------------ captura de una pantalla
async function correrAccion(p, page, movil) {
    if (!p.accion) return;
    await p.accion(page, { movil });
    await asentar(page, 900);
}

async function capturarEscritorio(browser, p) {
    const estado = await sesion(browser, p.cuenta);
    const reg = { nn: p.nn, slug: p.slug, ruta: p.ruta, cuenta: p.cuenta, desc: p.desc, archivos: [], componentes: {} };
    const base = `${p.nn}-${p.slug}`;
    // Pasada 1: con movimiento, asentada.
    {
        const ctx = await nuevoContexto(browser, { estado });
        const page = await ctx.newPage();
        await page.goto(BASE + p.ruta, { waitUntil: 'domcontentloaded', timeout: 90000 });
        await asentar(page);
        await correrAccion(p, page, false);
        reg.url = page.url();
        await encuadrar(page, null, { conservarMain: true });
        await page.screenshot({ path: path.join(OUT, 'desktop', `${base}.png`) });
        reg.archivos.push(`desktop/${base}.png`);
        await ctx.close();
    }
    // Pasada 2: reducir movimiento (estado final), variante limpia, DOM, página completa, recortes.
    const ctx = await nuevoContexto(browser, { estado, rm: true });
    const page = await ctx.newPage();
    await page.goto(BASE + p.ruta, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await asentar(page, 900);
    await correrAccion(p, page, false);
    await encuadrar(page, null, { conservarMain: true });
    await page.screenshot({ path: path.join(OUT, 'desktop', `${base}.rm.png`) });
    reg.archivos.push(`desktop/${base}.rm.png`);
    await marcarReloj(page);
    if (p.cuenta) {
        await ponerCss(page, 'cap-sin-reloj', CSS_SIN_RELOJ);
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(OUT, 'desktop', `${base}.clean.png`) });
        reg.archivos.push(`desktop/${base}.clean.png`);
        await quitarCss(page, 'cap-sin-reloj');
    }
    const marcas = await marcarComponentes(page);
    reg.componentes = marcas.conteo ?? {};
    reg.cifras = await cifras(page);
    await volcarDom(page, path.join(OUT, 'dom', `${base}.html`), { ...p, viewport: '1920x1080' });
    reg.archivos.push(`dom/${base}.html`);
    const scroll = await haceScroll(page, false);
    await ponerCss(page, 'cap-desenrollar', CSS_DESENROLLAR);
    await page.waitForTimeout(300);
    if (scroll) {
        await page.screenshot({ path: path.join(OUT, 'desktop', `${base}.full.png`), fullPage: true });
        reg.archivos.push(`desktop/${base}.full.png`);
    }
    await recortar(page, base, marcas, reg);
    await ctx.close();
    return reg;
}

async function recortar(page, base, marcas, reg, sufijo = '') {
    if (!marcas?.instancias?.length) return;
    const boxes = await cajas(page);
    const lista = [];
    for (const inst of marcas.instancias) {
        if (CROMO.has(inst.componente) && !PANTALLAS_CON_CROMO.has(base)) continue;
        const nombre = `${base}--${inst.componente}${inst.instancia > 1 ? `-${inst.instancia}` : ''}${sufijo}.png`;
        const box = boxes[inst.key];
        if (!box || box.width < 4 || box.height < 4 || box.height > 6000) continue;
        try {
            await page.locator(`[data-cap-key="${inst.key}"]`).first().screenshot({ path: path.join(OUT, 'crops', nombre), timeout: 10000, animations: 'disabled' });
            lista.push({ componente: inst.componente, instancia: inst.instancia, archivo: `crops/${nombre}`, caja: box, raicesDom: inst.raices, etiqueta: inst.etiqueta, clases: inst.clases });
        } catch (e) {
            falla(`recorte ${nombre}`, e);
        }
    }
    const json = {
        pantalla: base,
        ruta: reg.ruta,
        cuenta: reg.cuenta,
        sistemaDeCoordenadas: 'px CSS de la página completa (en escritorio, con el panel blanco desenrollado); multiplicar por el deviceScaleFactor (2 escritorio, 3 móvil) para px del .full.png',
        componentes: lista,
    };
    await fs.writeFile(path.join(OUT, 'crops', `${base}${sufijo}.json`), JSON.stringify(json, null, 2));
    reg.recortes = (reg.recortes ?? 0) + lista.length;
}

async function capturarMovil(browser, p, reg) {
    const estado = await sesion(browser, p.cuenta);
    const base = `${p.nn}-${p.slug}`;
    const ctx = await nuevoContexto(browser, { estado, movil: true });
    const page = await ctx.newPage();
    await page.goto(BASE + p.ruta, { waitUntil: 'domcontentloaded', timeout: 90000 });
    await asentar(page);
    await correrAccion(p, page, true);
    await encuadrar(page, null, { conservarMain: true });
    await page.screenshot({ path: path.join(OUT, 'mobile', `${base}.png`) });
    reg.archivos.push(`mobile/${base}.png`);
    if (p.cuenta && !p.accion) {
        await marcarReloj(page);
        await ponerCss(page, 'cap-sin-reloj', CSS_SIN_RELOJ);
        await page.waitForTimeout(150);
        await page.screenshot({ path: path.join(OUT, 'mobile', `${base}.clean.png`) });
        reg.archivos.push(`mobile/${base}.clean.png`);
        await quitarCss(page, 'cap-sin-reloj');
    }
    if (!p.accion && (await haceScroll(page, true))) {
        // Recorre la página para disparar las entradas «una vez en vista» antes de la captura completa.
        await recorrerDocumento(page);
        await page.screenshot({ path: path.join(OUT, 'mobile', `${base}.full.png`), fullPage: true });
        reg.archivos.push(`mobile/${base}.full.png`);
    }
    await volcarDom(page, path.join(OUT, 'dom', `${base}.mobile.html`), { ...p, viewport: '390x844' });
    reg.archivos.push(`dom/${base}.mobile.html`);
    await ctx.close();
}

async function recorrerDocumento(page) {
    await page.evaluate(async () => {
        const h = document.scrollingElement.scrollHeight;
        for (let y = 0; y < h; y += Math.round(innerHeight * 0.7)) {
            window.scrollTo(0, y);
            await new Promise((r) => setTimeout(r, 250));
        }
        window.scrollTo(0, 0);
    });
    await page.waitForTimeout(1200);
}

async function faseEstaticas(browser) {
    for (const p of PANTALLAS) {
        if (SOLO && !SOLO.has(p.slug)) continue;
        log(`${p.nn}-${p.slug} (${p.cuenta ?? 'pública'}) ${p.ruta}`);
        let reg = { nn: p.nn, slug: p.slug, ruta: p.ruta, cuenta: p.cuenta, desc: p.desc, archivos: [], componentes: {} };
        try {
            if (!p.soloMovil) reg = await capturarEscritorio(browser, p);
        } catch (e) {
            falla(`${p.nn}-${p.slug} escritorio`, e);
        }
        if (p.movil || p.soloMovil) {
            try {
                await capturarMovil(browser, p, reg);
            } catch (e) {
                falla(`${p.nn}-${p.slug} móvil`, e);
            }
        }
        manifiesto.pantallas.push(reg);
    }
    if (!SOLO || SOLO.has('bienvenida')) await capturarOnboarding(browser);
}

async function capturarOnboarding(browser) {
    try {
        const estado = await sesion(browser, 'docente1');
        const ctx = await nuevoContexto(browser, { estado, rm: false });
        const page = await ctx.newPage();
        await page.goto(`${BASE}/bienvenida`, { waitUntil: 'domcontentloaded' });
        await asentar(page);
        for (let paso = 1; paso <= 6; paso++) {
            const base = `9${paso - 1}-bienvenida-paso${paso}`;
            const reg = { nn: `9${paso - 1}`, slug: `bienvenida-paso${paso}`, ruta: '/bienvenida', cuenta: 'docente1', desc: `Onboarding «bienvenida», paso ${paso}.`, archivos: [] };
            await page.screenshot({ path: path.join(OUT, 'desktop', `${base}.png`) });
            reg.archivos.push(`desktop/${base}.png`);
            const marcas = await marcarComponentes(page);
            reg.componentes = marcas.conteo ?? {};
            reg.cifras = await cifras(page);
            await volcarDom(page, path.join(OUT, 'dom', `${base}.html`), { ruta: '/bienvenida', cuenta: 'docente1', viewport: '1920x1080' });
            reg.archivos.push(`dom/${base}.html`);
            manifiesto.pantallas.push(reg);
            const continuar = page.getByRole('button', { name: /^Continuar/ });
            if (!(await continuar.count())) break; // último paso («Listo»): no se pulsa (guardaría preferencias)
            await continuar.first().click();
            await page.waitForTimeout(1400);
        }
        await ctx.close();
    } catch (e) {
        falla('onboarding /bienvenida', e);
    }
}

// ------------------------------------------------------------------------------------------------ flujo en vivo
function resetDemo(opcion = '--reset') {
    log(`scripts/seed-demo.sh ${opcion}`);
    const puerto = new URL(BASE).port || '3000';
    execFileSync('bash', [path.join(REPO, 'scripts/seed-demo.sh'), opcion], { cwd: REPO, env: { ...process.env, WEB_PORT: puerto }, stdio: ['ignore', 'pipe', 'pipe'], timeout: 300000 });
}

async function esperarTexto(page, re, ms = 90000) {
    await page.waitForFunction((src) => new RegExp(src).test(document.querySelector('main')?.innerText ?? ''), re.source, { timeout: ms, polling: 500 });
}

// Encuadre: el shell tiene contenedores con overflow-hidden que igual se pueden desplazar por código (scrollIntoView los
// mueve y la app entera «sube»). Se regresan a 0 y solo se desplaza el contenedor real: main#contenido en escritorio, el
// documento en móvil. destino = Locator (su borde superior queda a `margen` px) o null (arriba del todo).
async function encuadrar(page, destino = null, { margen = 16, suave = false, conservarMain = false } = {}) {
    const fn = (el, [margen, suave, conservarMain]) => {
        const main = document.querySelector('main#contenido');
        const usaMain = !!main && getComputedStyle(main).overflowY !== 'visible' && main.scrollHeight > main.clientHeight + 4;
        for (const e of document.querySelectorAll('body, body *')) {
            if (e !== main && e.scrollTop > 0 && !e.closest('[role="dialog"]')) e.scrollTop = 0;
        }
        if (usaMain) document.scrollingElement.scrollTop = 0;
        if (conservarMain) return; // solo el cascarón: el desplazamiento propio de la pantalla se respeta
        const sc = usaMain ? main : document.scrollingElement;
        let top = 0;
        if (el && el !== document.body) {
            const r = el.getBoundingClientRect();
            const base = usaMain ? main.getBoundingClientRect().top : 0;
            top = sc.scrollTop + r.top - base - margen;
        }
        sc.scrollTo({ top: Math.max(0, top), behavior: suave ? 'smooth' : 'instant' });
    };
    await (destino ?? page.locator('body')).first().evaluate(fn, [margen, suave, conservarMain]);
    await page.waitForTimeout(suave ? 1100 : conservarMain ? 60 : 150);
}

// Toma de un estado vivo (no se puede recargar sin perder la simulación). full=false en la corrida grabada en video: el
// desenrollado y los recortes moverían la pantalla dentro del video.
async function capturaViva(page, base, p, { movil = false, crops = true, full = true, destino = null } = {}) {
    const reg = { nn: p.nn, slug: p.slug, ruta: new URL(page.url()).pathname + new URL(page.url()).search, cuenta: 'docente1', desc: p.desc, archivos: [], componentes: {} };
    const dir = movil ? 'mobile' : 'desktop';
    if (!(await page.getByRole('dialog').count())) await encuadrar(page, destino);
    await page.screenshot({ path: path.join(OUT, dir, `${base}.png`) });
    reg.archivos.push(`${dir}/${base}.png`);
    await marcarReloj(page);
    await ponerCss(page, 'cap-sin-reloj', CSS_SIN_RELOJ);
    await page.waitForTimeout(120);
    await page.screenshot({ path: path.join(OUT, dir, `${base}.clean.png`) });
    reg.archivos.push(`${dir}/${base}.clean.png`);
    await quitarCss(page, 'cap-sin-reloj');
    const marcas = await marcarComponentes(page);
    reg.componentes = marcas.conteo ?? {};
    reg.cifras = await cifras(page);
    await volcarDom(page, path.join(OUT, 'dom', `${base}${movil ? '.mobile' : ''}.html`), { ruta: reg.ruta, cuenta: 'docente1', viewport: movil ? '390x844' : '1920x1080' });
    reg.archivos.push(`dom/${base}${movil ? '.mobile' : ''}.html`);
    if (full && (await haceScroll(page, movil))) {
        if (!movil) await ponerCss(page, 'cap-desenrollar', CSS_DESENROLLAR);
        await page.waitForTimeout(250);
        await page.screenshot({ path: path.join(OUT, dir, `${base}.full.png`), fullPage: true });
        reg.archivos.push(`${dir}/${base}.full.png`);
        if (crops && !movil) await recortar(page, base, marcas, reg);
        if (!movil) await quitarCss(page, 'cap-desenrollar');
        await encuadrar(page, destino);
    }
    manifiesto.pantallas.push(reg);
    return reg;
}

const seccionSimulador = (page) => page.locator('section').filter({ has: page.getByRole('heading', { name: /Cámara simulada/ }) }).first();

async function activarSimulador(page, escenario) {
    const sec = seccionSimulador(page);
    await sec.waitFor({ timeout: 30000 });
    await encuadrar(page, sec, { margen: 120, suave: true });
    await sec.getByLabel('Escenario').selectOption({ label: escenario });
    await page.waitForTimeout(700);
    await sec.getByRole('switch').click();
    await page.waitForTimeout(1200);
    await encuadrar(page, null, { suave: true });
}

async function abrirPaseDeLista(page) {
    await page.goto(`${BASE}/docente`, { waitUntil: 'domcontentloaded' });
    await asentar(page, 1500);
    await page.getByRole('button', { name: /Abrir y pasar lista/ }).first().click();
    await page.waitForURL(/\/docente\/sesiones\/19/, { timeout: 60000 });
    await asentar(page, 1500);
}

const MONITOR_MS = 5500; // el monitor de la sesión se refresca cada 5 s

async function faseVivo(browser) {
    const estado = await sesion(browser, 'docente1');
    // --- R1: «Todos llegan a tiempo» grabado en video (solo tomas de viewport y DOM: nada que mueva la pantalla).
    try {
        resetDemo();
        const dirVideo = path.join(OUT, 'video', '_tmp');
        const ctx = await nuevoContexto(browser, { estado, video: dirVideo });
        const page = await ctx.newPage();
        await abrirPaseDeLista(page);
        await page.waitForTimeout(1500);
        await activarSimulador(page, 'Todos llegan a tiempo');
        await esperarTexto(page, /Última captura:\s*24 rostros/);
        await esperarTexto(page, /24\s+de 24 presentes/);
        await page.waitForTimeout(2500);
        // Para el video: baja a la tabla de alumnos (todos «Presente») y vuelve.
        const tabla = page.locator('main table').first();
        if (await tabla.count()) {
            await encuadrar(page, tabla, { margen: 140, suave: true });
            await page.waitForTimeout(2500);
            await encuadrar(page, null, { suave: true });
        }
        await esperarTexto(page, /Simulación completa/);
        await page.waitForTimeout(2000);
        await page.getByRole('button', { name: /\+30 min/ }).first().click();
        await esperarTexto(page, /Fuera de la ventana|ya puedes cerrar/);
        await page.waitForTimeout(2500);
        await capturaViva(page, '35-pasar-lista-fuera-de-ventana', { nn: '35', slug: 'pasar-lista-fuera-de-ventana', desc: 'Tolerancia terminada (+30 min, 07:32 en el reloj de la demo): chip «Fuera de la ventana», «Cerrar pase de lista» habilitado; 24 de 24 presentes.' }, { full: false });
        await page.getByRole('button', { name: /^Cerrar pase de lista/ }).first().click();
        await page.getByRole('dialog').first().waitFor({ timeout: 10000 });
        await page.waitForTimeout(1200);
        await capturaViva(page, '36-cierre-dialogo', { nn: '36', slug: 'cierre-dialogo', desc: 'Diálogo de confirmación «Cerrar sesion de clase».' }, { full: false });
        await page.getByRole('dialog').getByRole('button', { name: /Cerrar sesi/ }).last().click();
        await esperarTexto(page, /Cerrada/, 60000);
        await asentar(page, 3000);
        await page.mouse.move(1100, 600);
        await rueda(page, 1400, 600);
        await page.waitForTimeout(1500);
        const v = page.video();
        await ctx.close();
        await v.saveAs(path.join(OUT, 'video', '01-pasar-lista-camara-simulada.webm'));
        await v.delete();
        manifiesto.videos.push({ archivo: 'video/01-pasar-lista-camara-simulada.webm', desc: 'docente1: Home → «Abrir y pasar lista» (sesión 19, 3A) → cámara simulada «Todos llegan a tiempo»: fotogramas cada ~9 s, alumnos Pendiente 1/3 → 2/3 → Presente (24 de 24) → tabla → «Simulación completa» → +30 min → «Cerrar pase de lista» → confirmar → resumen de la sesión cerrada.' });
        // Resumen de la sesión cerrada, ya sin video (página estática: admite desenrollado y recortes).
        const ctx2 = await nuevoContexto(browser, { estado, rm: true });
        const p2 = await ctx2.newPage();
        await p2.goto(`${BASE}/docente/sesiones/19`, { waitUntil: 'domcontentloaded' });
        await asentar(p2, 1500);
        await capturaViva(p2, '37-sesion-19-cerrada', { nn: '37', slug: 'sesion-19-cerrada', desc: 'Resumen de la sesión 19 (3A, 14-sep) cerrada tras el pase con cámara simulada.' });
        await ctx2.close();
    } catch (e) {
        falla('vivo R1 (a tiempo, video)', e);
    }
    // --- R1b: «Todos llegan a tiempo» otra vez, sin video: tomas completas y recortes de cada estado.
    try {
        resetDemo();
        const ctx = await nuevoContexto(browser, { estado });
        const page = await ctx.newPage();
        await abrirPaseDeLista(page);
        await page.waitForTimeout(1500);
        await capturaViva(page, '30-pasar-lista-inicio', { nn: '30', slug: 'pasar-lista-inicio', desc: 'Sesión 19 (3A) recién abierta en modo automático (07:12): guía de 3 pasos, aviso real «No se pudo usar la cámara de este dispositivo» (el navegador sin interfaz no tiene webcam) con «Usar la cámara simulada», vista de cámara «En pausa / Sin imagen», «0 de 24 presentes», cierre deshabilitado (faltan 8 min), tarjeta de la cámara simulada apagada.' });
        await activarSimulador(page, 'Todos llegan a tiempo');
        await esperarTexto(page, /Última captura:\s*24 rostros/);
        await page.waitForTimeout(MONITOR_MS);
        await capturaViva(page, '31-pasar-lista-fotograma1', { nn: '31', slug: 'pasar-lista-fotograma1', desc: 'Cámara simulada, 1.er fotograma: 24 rostros · 24 válidos; los 24 alumnos en Pendiente con lecturas 1/3. El lienzo ya muestra el fotograma siguiente (con «Visita»).' });
        await esperarTexto(page, /Última captura:\s*25 rostros/);
        await page.waitForTimeout(MONITOR_MS);
        await capturaViva(page, '32-pasar-lista-fotograma2', { nn: '32', slug: 'pasar-lista-fotograma2', desc: 'Cámara simulada, 2.º fotograma: 25 rostros · 24 válidos (un visitante sin atribuir); lecturas 2/3.' });
        await esperarTexto(page, /24\s+de 24 presentes/);
        await page.waitForTimeout(MONITOR_MS);
        await capturaViva(page, '33-pasar-lista-presentes', { nn: '33', slug: 'pasar-lista-presentes', desc: '3.er fotograma: lecturas 3/3, 24 de 24 presentes; barra y anillo completos.' });
        await esperarTexto(page, /Simulación completa/);
        await page.waitForTimeout(MONITOR_MS);
        await capturaViva(page, '34-pasar-lista-simulacion-completa', { nn: '34', slug: 'pasar-lista-simulacion-completa', desc: '«Simulación completa: 5 ciclos enviados», muestreo en pausa, 24 de 24 presentes.' });
        await ctx.close();
    } catch (e) {
        falla('vivo R1b (a tiempo, tomas completas)', e);
    }
    // --- R2: «Llegan escalonados» (mezcla presente/retardo; el simulador adelanta el reloj 4 min por ciclo).
    try {
        resetDemo();
        const ctx = await nuevoContexto(browser, { estado });
        const page = await ctx.newPage();
        await abrirPaseDeLista(page);
        await activarSimulador(page, 'Llegan escalonados');
        await esperarTexto(page, /Última captura:\s*1[67] rostros/);
        await page.waitForTimeout(MONITOR_MS);
        await capturaViva(page, '38-escalonados-a-medias', { nn: '38', slug: 'escalonados-a-medias', desc: '«Llegan escalonados», 2.º fotograma: 16 alumnos + visitante ante la cámara; primeras tandas en Pendiente (lecturas 1/3 y 2/3).' });
        await esperarTexto(page, /Simulación completa/, 120000);
        await page.waitForTimeout(MONITOR_MS + 1000);
        await capturaViva(page, '39-escalonados-final', { nn: '39', slug: 'escalonados-final', desc: '«Llegan escalonados» completo: presentes y retardos (la 3.ª tanda llegó después del minuto 10).' });
        await ctx.close();
    } catch (e) {
        falla('vivo R2 (escalonados)', e);
    }
    // --- R3: móvil @3x, «Todos llegan a tiempo».
    try {
        resetDemo();
        const ctx = await nuevoContexto(browser, { estado, movil: true });
        const page = await ctx.newPage();
        await abrirPaseDeLista(page);
        await page.waitForTimeout(1500);
        await capturaViva(page, '30-pasar-lista-inicio', { nn: '30', slug: 'pasar-lista-inicio', desc: 'Móvil: sesión 19 abierta, antes de la cámara simulada.' }, { movil: true });
        await activarSimulador(page, 'Todos llegan a tiempo');
        await esperarTexto(page, /Última captura:\s*24 rostros/);
        await page.waitForTimeout(MONITOR_MS);
        const camara = page.locator('main').getByText('Asistencia ahora').first();
        await capturaViva(page, '31-pasar-lista-fotograma1', { nn: '31', slug: 'pasar-lista-fotograma1', desc: 'Móvil: 1.er fotograma, pendientes 1/3.' }, { movil: true });
        await esperarTexto(page, /24\s+de 24 presentes/);
        await page.waitForTimeout(2500);
        await capturaViva(page, '33-pasar-lista-presentes', { nn: '33', slug: 'pasar-lista-presentes', desc: 'Móvil: 24 de 24 presentes.' }, { movil: true });
        // En el teléfono la cifra queda debajo de la cámara: toma extra encuadrada en «Asistencia ahora».
        await encuadrar(page, camara, { margen: 380 });
        await page.screenshot({ path: path.join(OUT, 'mobile', '33-pasar-lista-presentes.camara.png') });
        manifiesto.pantallas.at(-1).archivos.push('mobile/33-pasar-lista-presentes.camara.png');
        await ctx.close();
    } catch (e) {
        falla('vivo R3 (móvil)', e);
    }
}

async function faseManual(browser) {
    const estado = await sesion(browser, 'docente1');
    try {
        resetDemo();
        const ctx = await nuevoContexto(browser, { estado });
        const page = await ctx.newPage();
        await page.goto(`${BASE}/docente`, { waitUntil: 'domcontentloaded' });
        await asentar(page, 600);
        const r = await page.request.post(`${BASE}/api/_local/reloj`, { headers: { Origin: BASE, 'Content-Type': 'application/json' }, data: { fijar: '2026-09-14 09:05' } });
        if (!r.ok()) throw new Error(`reloj ${r.status()}`);
        await page.goto(`${BASE}/docente/pasar-lista`, { waitUntil: 'domcontentloaded' });
        await page.waitForURL(/\/docente\/sesiones\/115/, { timeout: 60000 }).catch(() => {});
        await asentar(page, 1800);
        await capturaViva(page, '45-pase-manual-5c', { nn: '45', slug: 'pase-manual-5c', desc: 'Sesión 115 (5C, aula B-04 sin cámaras activas) a las 09:05: pase de lista manual con selector de estado por alumno.' });
        await ctx.close();
    } catch (e) {
        falla('pase manual 5C', e);
    }
}

// ------------------------------------------------------------------------------------------------ videos de navegación
async function rueda(page, total, velocidad = 650) {
    // Desplaza el contenedor real (main#contenido en escritorio, el documento en móvil) a paso fijo cada 20 ms. No se usa la
    // rueda del ratón: al llegar al final del panel encadena el desplazamiento al documento y el cascarón entero «sube».
    const paso = (Math.sign(total) * velocidad) / 50;
    let hecho = 0;
    while (Math.abs(hecho) < Math.abs(total)) {
        const movio = await page.evaluate((d) => {
            const m = document.querySelector('main#contenido');
            const sc = m && getComputedStyle(m).overflowY !== 'visible' && m.scrollHeight > m.clientHeight + 4 ? m : document.scrollingElement;
            const antes = sc.scrollTop;
            sc.scrollTop = antes + d;
            return sc.scrollTop - antes;
        }, paso);
        if (Math.abs(movio) < 0.5) break;
        hecho += movio;
        await page.waitForTimeout(20);
    }
}

async function faseVideos(browser) {
    const dirVideo = path.join(OUT, 'video', '_tmp');
    // V2: Home → grupo (reportes del 3A) → analítica del 3A.
    try {
        const estado = await sesion(browser, 'docente1');
        const ctx = await nuevoContexto(browser, { estado, video: dirVideo, dpr: 1 });
        const page = await ctx.newPage();
        await page.goto(`${BASE}/docente`, { waitUntil: 'domcontentloaded' });
        await asentar(page, 2200);
        await page.mouse.move(1100, 600);
        await rueda(page, 2600, 700);
        await page.waitForTimeout(900);
        await rueda(page, -2600, 2600);
        await page.locator('aside').getByRole('link', { name: /^Reportes/ }).first().click();
        await asentar(page, 1200);
        await page.getByLabel('Grupo', { exact: true }).first().selectOption({ label: 'Administración Financiera · 3A' });
        await asentar(page, 1600);
        await page.mouse.move(1100, 600);
        await rueda(page, 1800, 650);
        await page.waitForTimeout(800);
        await page.locator('aside').getByRole('link', { name: /^Analítica/ }).first().click();
        await asentar(page, 1000);
        await page.getByLabel('Grupo', { exact: true }).first().selectOption({ label: 'Administración Financiera · 3A' });
        await asentar(page, 2200);
        await page.mouse.move(1100, 600);
        await rueda(page, 3600, 550);
        await page.waitForTimeout(1500);
        const v = page.video();
        await ctx.close();
        await v.saveAs(path.join(OUT, 'video', '02-navegacion-home-grupo-analitica.webm'));
        await v.delete();
        manifiesto.videos.push({ archivo: 'video/02-navegacion-home-grupo-analitica.webm', desc: 'docente1: Home (scroll) → Reportes, grupo 3A → Analítica, grupo 3A (scroll por todas las gráficas).' });
    } catch (e) {
        falla('video 02 navegación', e);
    }
    // V3: vista del alumno + paleta ⌘K.
    try {
        const estado = await sesion(browser, 'e260001');
        const ctx = await nuevoContexto(browser, { estado, video: dirVideo, dpr: 1 });
        const page = await ctx.newPage();
        await page.goto(`${BASE}/alumno`, { waitUntil: 'domcontentloaded' });
        await asentar(page, 2500);
        await page.mouse.move(1100, 600);
        await rueda(page, 3000, 600);
        await page.waitForTimeout(1000);
        await rueda(page, -3000, 3000);
        await page.waitForTimeout(600);
        await page.keyboard.press('Control+k');
        await page.waitForTimeout(900);
        await page.keyboard.type('asis', { delay: 140 });
        await page.waitForTimeout(1500);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(800);
        const v = page.video();
        await ctx.close();
        await v.saveAs(path.join(OUT, 'video', '03-alumno-y-paleta.webm'));
        await v.delete();
        manifiesto.videos.push({ archivo: 'video/03-alumno-y-paleta.webm', desc: 'e260001: vista del alumno (scroll completo) y paleta ⌘K con búsqueda.' });
    } catch (e) {
        falla('video 03 alumno', e);
    }
    await fs.rm(dirVideo, { recursive: true, force: true });
}

// ------------------------------------------------------------------------------------------------ tokens
async function faseTokens(browser) {
    const css = await fs.readFile(path.join(REPO, 'web/src/app/globals.css'), 'utf8');
    await fs.writeFile(path.join(OUT, 'tokens', 'globals.css'), css);
    // Nombres declarados en el bloque :root (modo claro) de globals.css.
    const bloque = css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {')));
    const nombres = [...bloque.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]);
    const estado = await sesion(browser, 'docente1');
    const ctx = await nuevoContexto(browser, { estado, rm: true });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/docente`, { waitUntil: 'domcontentloaded' });
    await asentar(page, 500);
    const valores = await page.evaluate((nombres) => {
        const cs = getComputedStyle(document.documentElement);
        const lienzo = document.createElement('canvas');
        lienzo.width = lienzo.height = 1;
        const c2d = lienzo.getContext('2d', { willReadFrequently: true });
        const sonda = document.createElement('div');
        document.body.appendChild(sonda);
        const hex = (n) => n.toString(16).padStart(2, '0');
        const out = {};
        for (const n of nombres) {
            const crudo = cs.getPropertyValue(n).trim();
            const reg = { valor: crudo };
            const esColor = /^(#|rgb|hsl|oklch|oklab|lab|lch|color\(|color-mix)/.test(crudo);
            if (esColor) {
                // Una sonda nueva por variable (reusar una sola devolvía el color de la primera).
                const d = document.createElement('div');
                d.style.color = `var(${n})`;
                sonda.appendChild(d);
                const computado = getComputedStyle(d).color;
                d.remove();
                c2d.clearRect(0, 0, 1, 1);
                c2d.fillStyle = '#000';
                c2d.fillStyle = computado;
                c2d.fillRect(0, 0, 1, 1);
                const [r, g, b, a] = c2d.getImageData(0, 0, 1, 1).data;
                reg.computado = computado;
                reg.srgb = `#${hex(r)}${hex(g)}${hex(b)}${a < 255 ? hex(a) : ''}`;
            }
            out[n] = reg;
        }
        sonda.remove();
        const fuentes = { body: getComputedStyle(document.body).fontFamily, bodySize: getComputedStyle(document.body).fontSize };
        const h1 = document.querySelector('h1');
        if (h1) fuentes.saludo = { family: getComputedStyle(h1).fontFamily, size: getComputedStyle(h1).fontSize, weight: getComputedStyle(h1).fontWeight };
        return { tokens: out, fuentes };
    }, nombres);
    // Colores de gráfica (lib/graficas.js): estados y series traducidos a --g-*.
    const graficas = {
        nota: 'web/src/lib/graficas.js: los componentes reciben colores de TEXTO y colorGrafica() los cambia por los de gráfica (--g-*).',
        estados: { presente: ['--presente', '--g-presente'], retardo: ['--retardo', '--g-retardo'], ausente: ['--ausente', '--g-ausente'], justificado: ['--justificado', '--g-justificado'], pendiente: ['--pendiente', '--g-pendiente'] },
        series: { 'chart-1': '--g-azul', 'chart-2': '--g-dorado', 'chart-3': '--g-presente', 'chart-4': '--g-ausente', 'chart-5': '--g-violeta' },
        ordenSeries: ['--chart-1', '--chart-2', '--chart-3', '--chart-5', '--chart-4'],
    };
    const resueltos = (lista) => Object.fromEntries(lista.map((n) => [n, valores.tokens[n]?.srgb ?? valores.tokens[n]?.valor ?? null]));
    const tokens = {
        fuente: 'getComputedStyle(:root) en /docente (modo claro), colores convertidos a sRGB con un <canvas>',
        semanticos: resueltos(['--background', '--card', '--card-foreground', '--popover', '--muted', '--muted-foreground', '--accent', '--accent-foreground', '--foreground', '--border', '--input', '--ring', '--primary', '--primary-foreground', '--primary-hover', '--secondary', '--link', '--destructive', '--success', '--warning', '--info']),
        marca: resueltos(['--brand-gold', '--brand-gold-soft', '--brand-navy']),
        tonos: resueltos(nombres.filter((n) => n.startsWith('--tono-'))),
        estados: resueltos(['--presente', '--presente-bg', '--ausente', '--ausente-bg', '--retardo', '--retardo-bg', '--justificado', '--justificado-bg', '--pendiente', '--pendiente-bg']),
        graficaTexto: resueltos(['--chart-1', '--chart-2', '--chart-3', '--chart-4', '--chart-5']),
        graficaRelleno: resueltos(nombres.filter((n) => n.startsWith('--g-'))),
        sidebar: resueltos(nombres.filter((n) => n.startsWith('--sidebar'))),
        radios: resueltos(nombres.filter((n) => n.startsWith('--radius'))),
        sombras: resueltos(nombres.filter((n) => n.startsWith('--shadow'))),
        fuentes: valores.fuentes,
        graficas,
        todos: valores.tokens,
    };
    await fs.writeFile(path.join(OUT, 'tokens', 'tokens.json'), JSON.stringify(tokens, null, 2));
    await ctx.close();
    log(`tokens: ${nombres.length} variables de :root`);
}

// ------------------------------------------------------------------------------------------------ INVENTORY.md
// Las cifras animadas (CountUp) y los titulares con BlurText se leen dos veces (texto accesible + texto visual): «8 8»,
// «Buenos días, Buenos días, Patricia». Se colapsan las repeticiones inmediatas de 1 a 4 palabras.
const deduplicar = (t) => String(t ?? '').replace(/(^|\s)((?:\S+\s+){0,3}\S+)\s+\2(?=\s|$)/g, '$1$2');
const celda = (t, max = 400) => {
    const s = deduplicar(deduplicar(String(t ?? '').replace(/\|/g, '\\|').replace(/\s+/g, ' ').trim()));
    return s.length > max ? s.slice(0, max - 1) + '…' : s;
};

function contarArchivos(dir, re) {
    const p = path.join(OUT, dir);
    if (!existsSync(p)) return 0;
    return readdirSync(p).filter((f) => re.test(f)).length;
}

function tamanoTotal(dir) {
    let total = 0;
    const recorrer = (d) => {
        for (const n of readdirSync(d)) {
            const p = path.join(d, n);
            const st = statSync(p);
            if (st.isDirectory()) recorrer(p);
            else total += st.size;
        }
    };
    if (existsSync(dir)) recorrer(dir);
    return total;
}

const NOTAS_REEJECUCION = `## Cómo volver a correrlo

Desde la raíz del repo (\`/home/user/susan\`), con PostgreSQL 16 y sin Docker. En este contenedor se corre como **root**, que
PostgreSQL no admite: \`.local/pgbin/\` (ignorado por Git) envuelve \`initdb\`/\`pg_ctl\`/\`postgres\` con
\`runuser -u postgres\` y enlaza el resto de \`/usr/lib/postgresql/16/bin\`; el clúster en \`.local/pgdata\` es del usuario
\`postgres\`, y \`PGUSER=postgres\` hace que \`psql\` y \`pg\` (Node) entren con ese rol. El servicio de reconocimiento usa
\`recognition-service/.venv.nosync\` (Python 3.12 del sistema; \`run-local.sh\` lo reutiliza en lugar del Python de Homebrew).

\`\`\`bash
# 1. Pila local (idempotente: respeta lo que ya corre). Web en :3100 con su propio distDir.
export PGBIN=/home/user/susan/.local/pgbin PGUSER=postgres WEB_PORT=3100 NEXT_DIST_DIR=.next-capture
scripts/dev-all.sh                 # PostgreSQL :54329 + reconocimiento :8000 (EMBEDDER=fake) + next dev :3100
scripts/seed-demo.sh --reset       # escenario de hoy: sesión 19 programada, 8 pendientes, reloj 14-sep 07:12

# 2. Captura (Playwright 1.56.1 = chromium-1194 de /opt/pw-browsers; no se instala ningún navegador)
cd video/susan-v4
npm i --no-save playwright@1.56.1  # sin tocar package.json
node scripts/capture-app.mjs                                     # todo (≈ 30 min)
node scripts/capture-app.mjs --fases=estaticas --solo=docente-home,analitica-3a
node scripts/capture-app.mjs --fases=vivo,manual                 # flujos con cámara simulada (reinician la demo al final)
node scripts/capture-app.mjs --fases=videos,tokens,inventario
\`\`\`

- \`--fases\` = \`estaticas,vivo,manual,videos,tokens,inventario\`; \`--solo\` filtra pantallas estáticas por slug (\`bienvenida\` = onboarding);
  \`--reloj-real\` no fija la hora del navegador. Las corridas parciales se fusionan en \`manifest.json\`.
- Variables: \`CAPTURE_BASE\` (http://localhost:3100), \`DEMO_PASSWORD\` (la de desarrollo del README), \`CAPTURE_CHROME\`
  (ruta de un Chromium si Playwright no encontrara el suyo, p. ej. \`/opt/pw-browsers/chromium-1194/chrome-linux/chrome\`).
- Las fases \`vivo\` y \`manual\` abren y cierran las sesiones 19 y 115 y mueven el reloj: llaman a \`scripts/seed-demo.sh --reset\`
  antes de cada recorrido y al final. Abrir un caso de Revisión deja una fila «consulta» en la bitácora (es de solo inserción).
- Detener todo: \`PGBIN=/home/user/susan/.local/pgbin scripts/dev-stop.sh --all\` (sin \`--all\` deja PostgreSQL arriba).

## Notas para quien reconstruya la interfaz

- El indicador de Next del modo dev (\`<nextjs-portal>\`, una «N» sobre el avatar) se oculta con CSS en todas las tomas: no es de la app.
- La tarjeta «Reloj de demostración» y la sección «Cámara simulada (demostración)» SOLO existen en modo local; en producción la
  cámara del navegador o las cámaras IP del aula alimentan la misma vista. Las variantes \`.clean.png\` quitan la tarjeta del reloj.
- Los «rostros» de la cámara simulada son cuadrados de color con marco magenta (el embedder sintético de la demo): son la vista
  previa real del pase de lista en local, no una maqueta. Las iniciales debajo son de alumnos ficticios.
- Las gráficas son SVG/CSS hechos a mano (\`components/ui\`): AnilloEstados, BarrasPildora, TiraSemana, BarraSegmentada,
  GraficaLinea, Sparkline, MedidorLiquido, CalendarioAsistencia, dentro de TarjetaGrafica. En el DOM volcado se ven como
  \`data-cap="..."\` y su geometría exacta está en el SVG.
`;

const OMISIONES = `
Omisiones y limitaciones conocidas (no son fallas del script):

- **No hay pantalla de notificaciones**: «Notificaciones» es un módulo *Próximamente* (\`/modulos/notificaciones\`, captura 15). Las
  alertas de asistencia viven en el Home del docente (10) y en Analítica (21-23).
- **No hay lista de grupos del docente ni ruta de detalle de grupo para el docente**: «Mis grupos» del Home son filas sin enlace.
  El detalle de grupo está en Reportes con \`?grupo=1\` (19) y, para administración, en \`/admin/grupos/1\` (62-64).
- **Sin webcam en el navegador sin interfaz**: al abrir la sesión 19 el panel muestra el aviso real «No se pudo usar la cámara de este
  dispositivo — No se encontró ninguna cámara» con «Usar la cámara simulada» (30). En un equipo con cámara se vería la vista previa
  «En pausa» esperando permiso. A partir de 31 la cámara simulada reemplaza la vista.
- **La barra inferior del docente no tiene «Más»** (sus 5 destinos caben): el cajón móvil (13) se abrió con el botón de menú superior.
- **Solo modo claro**: \`globals.css\` trae una clase \`.dark\`, pero la app no la activa; no se capturó modo oscuro.
- **Estado de la demo al terminar**: las fases vivo/manual cierran la sesión 19 y mueven el reloj; el script termina con
  \`scripts/seed-demo.sh --reset\` (sesión 19 programada, 8 pendientes, reloj 07:12 detenido). Abrir casos de Revisión (25, 27) dejó
  filas «consulta» en la bitácora (solo inserción, no se borran).
- **Entorno de esta máquina** (resuelto, ver «Cómo volver a correrlo»): \`npm ci\` falla porque \`web/package-lock.json\` no trae
  \`@emnapi/core\`/\`@emnapi/runtime\` 1.11.3; se usó \`npm install\` y se restauró el lockfile con \`git checkout\`. PostgreSQL no corre como
  root (envoltorios en \`.local/pgbin\`); \`run-local.sh\` busca Python en Homebrew (se creó \`.venv.nosync\` con Python 3.12 del sistema).
`;

async function faseInventario() {
    const m = JSON.parse(await fs.readFile(path.join(OUT, 'manifest.json'), 'utf8'));
    const notas = NOTAS_REEJECUCION;
    const conteos = {
        'desktop (todas las variantes)': contarArchivos('desktop', /\.png$/),
        'desktop viewport con movimiento (NN-slug.png)': contarArchivos('desktop', /^\d\d-[^.]+\.png$/),
        'desktop .rm.png': contarArchivos('desktop', /\.rm\.png$/),
        'desktop .clean.png': contarArchivos('desktop', /\.clean\.png$/),
        'desktop .full.png': contarArchivos('desktop', /\.full\.png$/),
        'mobile (todas las variantes)': contarArchivos('mobile', /\.png$/),
        'dom (.html)': contarArchivos('dom', /\.html$/),
        'crops (.png)': contarArchivos('crops', /\.png$/),
        'crops (.json)': contarArchivos('crops', /\.json$/),
        'video (.webm)': contarArchivos('video', /\.webm$/),
    };
    const mb = (tamanoTotal(OUT) / 1048576).toFixed(1);
    const filas = m.pantallas.map((p) => {
        const archivos = p.archivos ?? [];
        const agrupar = (dir) => {
            const xs = archivos.filter((a) => a.startsWith(dir + '/')).map((a) => a.slice(dir.length + 1));
            if (!xs.length) return '';
            const base = `${p.nn}-${p.slug}`;
            const sufijos = xs.map((x) => x.replace(base, '') || x);
            return `${dir}/${base}{${sufijos.join(',')}}`;
        };
        const files = [agrupar('desktop'), agrupar('mobile'), agrupar('dom')].filter(Boolean).join('<br>') + (p.recortes ? `<br>crops/${p.nn}-${p.slug}--*.png (${p.recortes}) + .json` : '');
        const comps = Object.entries(p.componentes ?? {})
            .filter(([n]) => !CROMO.has(n))
            .map(([n, c]) => (c > 1 ? `${n}×${c}` : n))
            .join(', ');
        const c = p.cifras ?? {};
        // Resúmenes accesibles de las gráficas: se prefieren las frases limpias («A: 1; B: 2»), no las leyendas pegadas.
        const srLimpios = (c.sr ?? []).filter((t) => /;/.test(t) || /^[^:]+: \d/.test(t)).slice(0, 3);
        const cifrasTxt = [...(c.stat ?? []).map((s) => `[${deduplicar(deduplicar(s.replace(/\s+/g, ' ').trim()))}]`), ...srLimpios, ...(c.resumenes ?? []).slice(0, 3)].join(' · ') || celda((c.texto ?? '').slice(0, 300));
        const visible = [p.desc, c.titulos?.length ? `Títulos: ${c.titulos.slice(0, 6).join(' / ')}` : ''].filter(Boolean).join(' ');
        return `| ${files} | \`${p.ruta}\` | ${p.cuenta ?? 'pública'} | ${celda(visible, 420)} | ${celda(cifrasTxt, 700)} | ${celda(comps, 420)} |`;
    });
    const fallas = m.fallas ?? [];
    const md = `# Capturas de la app real de SUSAN (fuente visual del video v4)

Generado por \`scripts/capture-app.mjs\` el ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC contra ${m.base} (modo local de
demostración, semilla \`scripts/seed-demo.sh --reset\`). Hora de negocio del escenario: **lunes 14-sep-2026 07:12 (-06)**; el
navegador se fijó a esa misma hora (por eso el saludo dice «Buenos días»). Todo dato es ficticio (semilla de demostración).

## Qué hay y cómo leerlo

| Carpeta | Contenido |
|---|---|
| \`desktop/NN-slug.png\` | 1920×1080 @2x (3840×2160), solo viewport, con movimiento, ya asentado (fuentes + animaciones de entrada, ~1.6 s tras *network idle*). |
| \`desktop/NN-slug.rm.png\` | Igual, en una segunda carga con \`prefers-reduced-motion: reduce\` (estado final sin animar). |
| \`desktop/NN-slug.clean.png\` | La pasada rm **sin la tarjeta «Reloj de demostración»** (solo existe en el modo local; en producción no se pinta). Úsala como referencia de la pantalla real. |
| \`desktop/NN-slug.full.png\` | Página completa. En escritorio el panel blanco hace su propio scroll (\`main#contenido\`), así que se desenrolla con CSS solo para esta toma: el riel lateral queda estirado a lo alto. |
| \`mobile/\` | 390×844 @3x (1170×2532) + \`.clean.png\` y \`.full.png\`. La barra flotante inferior (BottomNav) aparece en todas. |
| \`dom/NN-slug.html\` | \`outerHTML\` renderizado (pasada rm) sin scripts, con la hoja de Tailwind compilada, las fuentes (Hanken Grotesk, EB Garamond) y las imágenes copiadas a \`dom/assets/\`: **se abre tal cual desde el disco** y se ve como la app. Cada raíz de componente lleva \`data-cap="NombreDelComponente"\` (nombre de la carpeta en \`web/src/components\`). Los \`<canvas>\` (cámara simulada) van como \`<img>\` PNG. \`*.mobile.html\` = el DOM a 390 px. |
| \`crops/NN-slug--Comp[-n].png\` | Recorte @2x de cada componente (ubicado por el árbol de React del modo dev, no por heurística). Máx. ${MAX_POR_COMPONENTE} instancias por componente y pantalla; el cromo del shell (${[...CROMO].join(', ')}) solo en ${[...PANTALLAS_CON_CROMO].join(', ')}. |
| \`crops/NN-slug.json\` | Cajas \`{x,y,width,height}\` en px CSS de la página completa (multiplica por 2 —3 en móvil— para px del \`.full.png\`), con la etiqueta y las clases de la raíz. |
| \`video/*.webm\` | Flujos grabados por Playwright a 1920×1080. |
| \`tokens/\` | \`globals.css\` (copia) y \`tokens.json\` (valores resueltos del modo claro, en sRGB). |
| \`manifest.json\` | Todo lo de abajo en JSON, con el texto visible de cada pantalla y las cifras de sus gráficas. |

Conteos: ${Object.entries(conteos).map(([k, v]) => `${k}: **${v}**`).join(' · ')}. Tamaño total: **${mb} MB**.

## Pantallas

| Archivos | Ruta | Rol | Qué se ve | Cifras de la demo (tarjetas \`[...]\` y resúmenes de gráficas) | Componentes (sin cromo) |
|---|---|---|---|---|---|
${filas.join('\n')}

## Videos

${(m.videos ?? []).map((v) => `- \`${v.archivo}\`: ${v.desc}`).join('\n') || '- (ninguno)'}

## Tokens

\`tokens/tokens.json\`: grupos \`semanticos\` (background, card, muted, accent, foreground, muted-foreground, border, primary, link,
destructive…), \`marca\` (brand-gold…), \`tonos\` (tono-azul/dorado/verde/violeta/rosa y sus -fg), \`estados\` (presente, ausente,
retardo, justificado, pendiente y sus -bg), \`graficaTexto\` (chart-1..5), \`graficaRelleno\` (--g-*: los colores con que se pintan
de verdad las gráficas, ver \`colorGrafica\` en \`web/src/lib/graficas.js\`), \`sidebar\`, \`radios\`, \`sombras\`, \`fuentes\` y \`todos\`
(cada variable de \`:root\` con su valor declarado, el color computado y su sRGB).

${notas}

## Fallas y omisiones

${fallas.length ? fallas.map((f) => `- **${f.donde}**: ${f.error}`).join('\n') : '- Ninguna falla en la última corrida del script.'}
${OMISIONES}
`;
    await fs.writeFile(path.join(OUT, 'INVENTORY.md'), md);
    log('INVENTORY.md escrito');
}

// ------------------------------------------------------------------------------------------------ main
async function main() {
    for (const d of ['desktop', 'mobile', 'dom', 'crops', 'video', 'tokens']) await fs.mkdir(path.join(OUT, d), { recursive: true });
    // El manifiesto se acumula entre corridas parciales (--solo / --fases).
    const archivoManifiesto = path.join(OUT, 'manifest.json');
    if (existsSync(archivoManifiesto)) {
        const previo = JSON.parse(await fs.readFile(archivoManifiesto, 'utf8'));
        manifiesto.previo = { pantallas: previo.pantallas ?? [], videos: previo.videos ?? [], fallas: previo.fallas ?? [] };
    }
    const browser = await chromium.launch({ executablePath: process.env.CAPTURE_CHROME || undefined });
    log(`base ${BASE} · fases ${FASES.join(',')} · ${COMPONENTES.length} componentes a recortar`);
    try {
        if (FASES.includes('estaticas')) { faseActual = 'estaticas'; await faseEstaticas(browser); }
        if (FASES.includes('vivo')) { faseActual = 'vivo'; await faseVivo(browser); }
        if (FASES.includes('manual')) { faseActual = 'manual'; await faseManual(browser); }
        if (FASES.includes('vivo') || FASES.includes('manual')) {
            try {
                resetDemo();
            } catch (e) {
                falla('reset final', e);
            }
        }
        if (FASES.includes('videos')) { faseActual = 'videos'; await faseVideos(browser); }
        if (FASES.includes('tokens')) { faseActual = 'tokens'; await faseTokens(browser); }
    } finally {
        await browser.close();
    }
    // Fusión con corridas previas: lo nuevo reemplaza por (nn, slug, ruta).
    if (manifiesto.previo) {
        const clave = (p) => `${p.nn}|${p.slug}`;
        const nuevas = new Set(manifiesto.pantallas.map(clave));
        const fusion = [...manifiesto.previo.pantallas.filter((p) => !nuevas.has(clave(p))), ...manifiesto.pantallas];
        // Las pantallas vivas en escritorio y móvil comparten nn/slug: se juntan sus archivos.
        const porClave = new Map();
        for (const p of fusion) {
            const k = clave(p);
            if (porClave.has(k) && manifiesto.pantallas.includes(p)) {
                const a = porClave.get(k);
                if (manifiesto.pantallas.includes(a)) { a.archivos = [...new Set([...a.archivos, ...p.archivos])]; continue; }
            }
            porClave.set(k, p);
        }
        manifiesto.pantallas = [...porClave.values()];
        const vids = new Set(manifiesto.videos.map((v) => v.archivo));
        manifiesto.videos = [...manifiesto.previo.videos.filter((v) => !vids.has(v.archivo)), ...manifiesto.videos];
        // Se conservan las fallas previas de las fases que no se repitieron (y, con --solo, las de otras pantallas).
        const faseDe = (f) => f.fase || 'estaticas';
        const repetida = (f) => FASES.includes(faseDe(f)) && (!SOLO || faseDe(f) !== 'estaticas' || [...SOLO].some((slug) => f.donde.includes(slug)));
        manifiesto.fallas = [...manifiesto.previo.fallas.filter((f) => !repetida(f)), ...manifiesto.fallas];
        delete manifiesto.previo;
    } else {
        const porClave = new Map();
        for (const p of manifiesto.pantallas) {
            const k = `${p.nn}|${p.slug}`;
            if (porClave.has(k)) porClave.get(k).archivos.push(...p.archivos);
            else porClave.set(k, p);
        }
        manifiesto.pantallas = [...porClave.values()];
    }
    manifiesto.pantallas.sort((a, b) => a.nn.localeCompare(b.nn) || a.slug.localeCompare(b.slug));
    await fs.writeFile(archivoManifiesto, JSON.stringify(manifiesto, null, 2));
    log(`listo: ${manifiesto.pantallas.length} pantallas, ${manifiesto.videos.length} videos, ${manifiesto.fallas.length} fallas`);
    if (FASES.includes('inventario')) await faseInventario();
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
