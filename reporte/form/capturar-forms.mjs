// Capturas de los formularios reales de SUSAN para el reporte de avances.
// Uso:  node capturar-forms.mjs [escenario ...]      (sin argumentos corre todos, en orden)
// Requiere el stack local en http://localhost:3100 (docs/DEMO.md) y Playwright global con Chromium de /opt/pw-browsers.
// Los PNG se guardan primero en form/_raw/<slug>.png y, al final de cada corrida, se renumeran como figuras/forms/fNN-<slug>.png
// según el orden de los escenarios. Oculta solo las insignias de desarrollo (Next dev y la tarjeta «Reloj de demostración»).
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, '..');
const RAW = path.join(AQUI, '_raw');
const SALIDA = path.join(RAIZ, 'figuras', 'forms');
const MANIFIESTO = path.join(RAW, 'manifiesto.json');
const BASE = process.env.BASE_URL || 'http://localhost:3100';
const CLAVE = 'demo1234'; // contraseña de desarrollo documentada en docs/DEMO.md y README.md
fs.mkdirSync(RAW, { recursive: true });
fs.mkdirSync(SALIDA, { recursive: true });

const manifiesto = fs.existsSync(MANIFIESTO) ? JSON.parse(fs.readFileSync(MANIFIESTO, 'utf8')) : {};
const guardarManifiesto = () => fs.writeFileSync(MANIFIESTO, JSON.stringify(manifiesto, null, 2));

const OCULTAR_DEV = `nextjs-portal, [data-nextjs-dev-tools-button], [data-nextjs-toast], [aria-label="Reloj de demostración"] { display: none !important; }`;

const ESCRITORIO = { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 };
const MOVIL = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

let browser;
async function contexto(opts = {}, storageState, navegador = browser) {
    const ctx = await navegador.newContext({
        ...ESCRITORIO, ...opts, storageState,
        locale: 'es-MX', timezoneId: 'America/Mexico_City', reducedMotion: 'reduce', serviceWorkers: 'block',
    });
    await ctx.addInitScript((css) => {
        const poner = () => { const s = document.createElement('style'); s.textContent = css; (document.head || document.documentElement).appendChild(s); };
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poner); else poner();
    }, OCULTAR_DEV);
    ctx.setDefaultTimeout(45000);
    return ctx;
}

// Inicia sesión por la pantalla real /login y guarda las cookies para reutilizarlas.
async function sesion(correo) {
    const archivo = path.join(RAW, `estado-${correo.split('@')[0]}.json`);
    if (fs.existsSync(archivo)) return archivo;
    const ctx = await contexto();
    const p = await ctx.newPage();
    await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
    await reposar(p);
    await esperar(2000); // hasta hidratar: antes de eso el formulario enviaría por GET
    await p.locator('input[name="correo"]').fill(correo);
    await p.locator('input[name="contrasena"]').fill(CLAVE);
    await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90000 }), p.getByRole('button', { name: 'Iniciar sesión' }).click()]);
    await ctx.storageState({ path: archivo });
    await ctx.close();
    return archivo;
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function reposar(p) {
    await p.evaluate(() => document.fonts?.ready).catch(() => {});
    await p.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
    await esperar(350);
}

let ordenEscenario = 0;
let escenarioActual = '';
async function arriba(p) {
    // Los paneles de la app desplazan por dentro: se regresan a su inicio para que la captura abra con el encabezado de la pantalla.
    await p.evaluate(() => {
        window.scrollTo(0, 0);
        document.querySelectorAll('*').forEach((el) => { if (el.scrollTop > 0 && el.scrollHeight > el.clientHeight && !el.closest('[role="dialog"]')) el.scrollTop = 0; });
    });
    await esperar(150);
}

// meta.elemento: Locator cuyo recorte se fotografía (formularios más altos que la ventana de 1440x900; se renderizan igual a 2x).
async function foto(p, slug, { elemento, ...meta }) {
    if (!meta.mantenerScroll && !elemento) await arriba(p);
    await reposar(p);
    const archivo = path.join(RAW, `${slug}.png`);
    if (elemento) await elemento.screenshot({ path: archivo, animations: 'disabled' });
    else await p.screenshot({ path: archivo, fullPage: false, animations: 'disabled' });
    manifiesto[slug] = { escenario: escenarioActual, orden: ordenEscenario, ...meta, recorte: Boolean(elemento), ruta: meta.ruta ?? new URL(p.url()).pathname + new URL(p.url()).search, ts: manifiesto[slug]?.ts ?? Date.now() };
    guardarManifiesto();
    console.log('  foto', slug);
}

async function ir(p, ruta, espera) {
    await p.goto(`${BASE}${ruta}`, { waitUntil: 'domcontentloaded' });
    if (espera) await espera.waitFor({ state: 'visible', timeout: 90000 });
    await reposar(p);
}

const ESC = {};
function escenario(nombre, fn) { ESC[nombre] = fn; }
// Orden de ejecución (respeta dependencias: «consola-tecnico» va antes de que existan registros ZZ; «revision» antes de que se cree un justificante)
// y orden de las figuras en el reporte (por familia de formulario).
const EJECUCION = ['login', 'consola-tecnico', 'auth', 'filtros', 'revision', 'alumno-alta', 'catalogos', 'grupo-alta', 'grupo-detalle', 'alumno-ficha', 'usuarios', 'moviles', 'pase-manual', 'cuenta-y-registro', 'justificante'];
const ESCENARIOS = ['login', 'auth', 'alumno-alta', 'alumno-ficha', 'catalogos', 'usuarios', 'grupo-alta', 'grupo-detalle', 'justificante', 'cuenta-y-registro', 'revision', 'pase-manual', 'consola-tecnico', 'filtros', 'moviles'];

// ------------------------------------------------------------------------------------------------------------------------------
escenario('login', async () => {
    const ctx = await contexto();
    const p = await ctx.newPage();
    const ruta = '/login';
    await ir(p, ruta, p.locator('input[name="correo"]'));
    await foto(p, 'login-vacio', { form: 'Inicio de sesión (LoginForm)', estado: 'Vacío', ruta });
    // Errores al salir del campo: correo sin dominio y contraseña vacía.
    await p.locator('input[name="correo"]').fill('docente1@');
    await p.locator('input[name="contrasena"]').focus();
    await p.locator('input[name="contrasena"]').blur();
    await p.locator('input[name="correo"]').focus();
    await p.locator('input[name="contrasena"]').focus();
    await p.keyboard.press('Tab');
    await foto(p, 'login-errores-blur', { form: 'Inicio de sesión (LoginForm)', estado: 'Errores de validación al salir de los campos', ruta });
    // Envío incompleto.
    await p.locator('input[name="correo"]').fill('');
    await p.getByRole('button', { name: 'Iniciar sesión' }).click();
    await foto(p, 'login-errores-envio', { form: 'Inicio de sesión (LoginForm)', estado: 'Envío incompleto: errores en ambos campos y foco en el primero', ruta });
    // Credenciales incorrectas (error del servidor).
    await p.locator('input[name="correo"]').fill('docente1@susan.local');
    await p.locator('input[name="contrasena"]').fill('incorrecta123');
    await p.getByRole('button', { name: 'Iniciar sesión' }).click();
    await p.getByText('Correo o contraseña incorrectos.').waitFor();
    await foto(p, 'login-credenciales-incorrectas', { form: 'Inicio de sesión (LoginForm)', estado: 'Error del servidor: credenciales incorrectas (se conserva lo escrito)', ruta });
    // Válido y listo para enviar.
    await p.locator('input[name="contrasena"]').fill(CLAVE);
    await p.getByRole('button', { name: /Mostrar/ }).first().click().catch(() => {});
    await foto(p, 'login-lleno-valido', { form: 'Inicio de sesión (LoginForm)', estado: 'Lleno y válido, contraseña visible (listo para enviar)', ruta });
    await ctx.close();
});

// ------------------------------------------------------------------------------------------------------------------------------
// Datos de prueba que crea este script (prefijo «ZZ Prueba»; ver resumen.md para la limpieza).
// ZZ_SUFIJO: la corrida de 2026-10-30 usó el sufijo 1 y dejó ese alumno y su cuenta como residuo (la bitácora es de solo anexar); para repetir la corrida usa ZZ_SUFIJO=2.
const SUF = process.env.ZZ_SUFIJO ?? '1';
const ZZ = { matricula: `ZZPRUEBA${SUF}`, nombres: 'ZZ Prueba', paterno: 'Reporte', materno: 'Demo', correo: `zz.prueba.reporte${SUF === '1' ? '' : SUF}@susan.test` };

escenario('alumno-alta', async () => {
    const ctx = await contexto({}, await sesion('admin@susan.local'));
    const p = await ctx.newPage();
    const ruta = '/admin/alumnos/nuevo';
    const F = 'Alta de alumno (asistente de 3 pasos, AltaAlumno)';
    const matricula = p.locator('input[name="matricula"]');
    const correo = p.locator('input[name="correo_institucional"]');
    const llenarIdentidad = async () => {
        await ir(p, ruta, matricula);
        await matricula.fill(ZZ.matricula.toLowerCase());
        await p.locator('input[name="nombres"]').fill(ZZ.nombres);
        await p.locator('input[name="apellido_paterno"]').fill(ZZ.paterno);
        await p.locator('input[name="apellido_materno"]').fill(ZZ.materno);
        await p.locator('input[name="nombres"]').focus();
        await p.getByText('Matrícula disponible').first().waitFor({ timeout: 15000 });
    };
    // Cada tramo parte de una página recién cargada: el resumen «Revisa este paso» de un intento fallido no se apaga hasta que un paso valida.
    await ir(p, ruta, matricula);
    await foto(p, 'alumno-alta-1-identidad-vacio', { form: F, estado: 'Paso 1 Identidad, vacío', ruta });
    await p.getByRole('button', { name: 'Siguiente' }).click();
    await foto(p, 'alumno-alta-1-identidad-errores', { form: F, estado: 'Paso 1 Identidad, «Siguiente» con campos vacíos (errores y resumen «Revisa este paso»)', ruta });

    await ir(p, ruta, matricula);
    await matricula.fill('e260001');
    await p.locator('input[name="nombres"]').focus();
    await p.getByText('Esta matrícula ya está registrada.').first().waitFor({ timeout: 15000 });
    await foto(p, 'alumno-alta-1-matricula-duplicada', { form: F, estado: 'Paso 1 Identidad, matrícula repetida detectada antes de crear (con enlace a la ficha del alumno existente)', ruta });

    await llenarIdentidad();
    await foto(p, 'alumno-alta-1-identidad-valido', { form: F, estado: 'Paso 1 Identidad, lleno y válido (matrícula normalizada a mayúsculas, «Matrícula disponible»)', ruta });
    await p.getByRole('button', { name: 'Siguiente' }).click();
    await correo.waitFor();
    await foto(p, 'alumno-alta-2-contacto-vacio', { form: F, estado: 'Paso 2 Contacto y acceso, vacío', ruta });
    await correo.fill('zz.prueba.reporte@');
    await p.getByRole('button', { name: 'Siguiente' }).click();
    await foto(p, 'alumno-alta-2-contacto-error', { form: F, estado: 'Paso 2 Contacto y acceso, «Siguiente» con un correo inválido', ruta });

    await llenarIdentidad();
    await p.getByRole('button', { name: 'Siguiente' }).click();
    await correo.waitFor();
    await correo.fill(ZZ.correo.toUpperCase());
    await p.getByRole('switch').click();
    await correo.focus();
    await correo.blur();
    await foto(p, 'alumno-alta-2-contacto-valido', { form: F, estado: 'Paso 2 Contacto y acceso, correo válido (normalizado a minúsculas) y «Crear su cuenta al terminar» activado', ruta });
    await p.getByRole('switch').click(); // la cuenta no se crea en la demostración: menos registros de prueba
    await p.getByRole('button', { name: 'Siguiente' }).click();
    await p.getByRole('heading', { name: 'Revisión' }).waitFor();
    await foto(p, 'alumno-alta-3-revision', { form: F, estado: 'Paso 3 Revisión con «Editar» por sección (la cuenta de acceso queda para después)', ruta });
    await p.getByRole('button', { name: 'Crear alumno', exact: true }).click();
    await p.getByText('Alumno creado').first().waitFor({ timeout: 30000 });
    await foto(p, 'alumno-alta-4-exito', { form: F, estado: 'Éxito: «Alumno creado» con siguientes pasos (consentimiento, plantilla facial, grupo, cuenta)', ruta });
    await ctx.close();
});

// ------------------------------------------------------------------------------------------------------------------------------
// Catálogos de un paso en panel lateral (PanelCatalogo + useAltaCatalogo): aula, materia y docente.
async function altaCatalogo(p, { ruta, abrir, slug, form, vacioTxt, rellenar, crear, esperaExito, exitoTxt }) {
    await ir(p, ruta, p.getByRole('button', { name: abrir }));
    await p.getByRole('button', { name: abrir }).click();
    const d = p.getByRole('dialog');
    await d.waitFor();
    await esperar(500);
    await foto(p, `${slug}-vacio`, { form, estado: vacioTxt, ruta });
    await d.getByRole('button', { name: crear, exact: true }).click();
    await esperar(300);
    await foto(p, `${slug}-errores`, { form, estado: 'Envío vacío: errores junto a cada campo, foco en el primero y motivo en el pie («Revisa los campos marcados»)', ruta });
    await rellenar(d);
    await esperar(300);
    await foto(p, `${slug}-valido`, { form, estado: 'Lleno y válido (valores normalizados al salir del campo, «Válido» donde aplica)', ruta });
    await d.getByRole('button', { name: crear, exact: true }).click();
    await p.getByText(esperaExito).first().waitFor({ timeout: 30000 });
    await esperar(400);
    await foto(p, `${slug}-exito`, { form, estado: exitoTxt, ruta });
}

escenario('catalogos', async () => {
    const ctx = await contexto({}, await sesion('admin@susan.local'));
    const p = await ctx.newPage();
    await altaCatalogo(p, {
        ruta: '/admin/aulas', abrir: 'Nueva aula', slug: 'aula', form: 'Alta de aula (AulaForm en PanelLateral)', vacioTxt: 'Panel lateral «Nueva aula», vacío',
        crear: 'Crear aula', esperaExito: 'Aula ZZ-P1 creada', exitoTxt: 'Éxito: «Aula ZZ-P1 creada» con siguiente paso y salidas',
        rellenar: async (d) => {
            await d.locator('input[name="clave"]').fill('zz-p1');
            await d.locator('input[name="edificio"]').fill('Edificio ZZ');
            await d.locator('input[name="capacidad"]').fill('25');
            await d.locator('input[name="capacidad"]').blur();
        },
    });
    await altaCatalogo(p, {
        ruta: '/admin/materias', abrir: 'Nueva materia', slug: 'materia', form: 'Alta de materia (MateriaForm en PanelLateral)', vacioTxt: 'Panel lateral «Nueva materia», vacío',
        crear: 'Crear materia', esperaExito: 'Materia ZZP101 creada', exitoTxt: 'Éxito: «Materia ZZP101 creada» con siguientes pasos',
        rellenar: async (d) => {
            await d.locator('input[name="clave"]').fill('zzp101');
            await d.locator('input[name="nombre"]').fill('ZZ Prueba de materia');
            await d.locator('input[name="creditos"]').fill('4');
            await d.locator('input[name="horas_semana"]').fill('3');
            await d.locator('input[name="horas_semana"]').blur();
        },
    });
    await altaCatalogo(p, {
        ruta: '/admin/docentes', abrir: 'Nuevo docente', slug: 'docente', form: 'Alta de docente (DocenteForm en PanelLateral)', vacioTxt: 'Panel lateral «Nuevo docente», vacío',
        crear: 'Crear docente', esperaExito: 'creado', exitoTxt: 'Éxito del alta de docente con siguientes pasos (crear cuenta de acceso)',
        rellenar: async (d) => {
            await d.locator('input[name="num_empleado"]').fill('zzd01');
            await d.locator('input[name="correo_institucional"]').fill('ZZ.Prueba.Docente@susan.test');
            await d.locator('input[name="apellido_paterno"]').fill('Prueba');
            await d.locator('input[name="nombres"]').fill('ZZ Docente');
            await d.locator('input[name="nombres"]').blur();
        },
    });
    await ctx.close();
});

// ------------------------------------------------------------------------------------------------------------------------------
// Alta de grupo (AsistenteGrupo): usa la materia ZZP101 y el aula ZZ-P1 que crea el escenario «catalogos» (hay que correrlo antes).
async function elegirEnCombo(p, nombre, texto) {
    const c = p.getByRole('combobox', { name: nombre });
    await c.click();
    await c.fill(texto);
    await p.getByRole('option').first().waitFor();
    await p.getByRole('option').first().click();
}

escenario('grupo-alta', async () => {
    const ctx = await contexto({}, await sesion('admin@susan.local'));
    const p = await ctx.newPage();
    const ruta = '/admin/grupos/nuevo';
    const F = 'Alta de grupo (asistente de 3 pasos, AsistenteGrupo)';
    const materia = p.getByRole('combobox', { name: 'Materia' });
    const aula = p.getByRole('combobox', { name: 'Aula' });
    const llenarDatos = async () => {
        await ir(p, ruta, materia);
        await elegirEnCombo(p, 'Materia', 'ZZ');
        await elegirEnCombo(p, 'Docente', 'Ortega');
        await p.locator('input[name="clave_grupo"]').fill('zz1');
        await p.locator('input[name="periodo"]').focus();
        await p.locator('input[name="periodo"]').blur();
    };
    await ir(p, ruta, materia);
    await foto(p, 'grupo-alta-1-datos-vacio', { form: F, estado: 'Paso 1 Materia y docente, vacío (periodo sugerido según el reloj del plantel)', ruta });
    await p.getByRole('button', { name: 'Siguiente' }).click();
    await foto(p, 'grupo-alta-1-datos-errores', { form: F, estado: 'Paso 1, «Siguiente» con campos vacíos (errores y resumen «Revisa este paso»)', ruta });

    await llenarDatos();
    await foto(p, 'grupo-alta-1-datos-valido', { form: F, estado: 'Paso 1, lleno y válido (selectores con búsqueda, clave en mayúsculas, resumen vivo a la derecha)', ruta });
    await p.getByRole('button', { name: 'Siguiente' }).click();
    await aula.waitFor();
    await foto(p, 'grupo-alta-2-aula-vacio', { form: F, estado: 'Paso 2 Aula y horario, vacío (horario opcional con atajos de días)', ruta });
    await p.getByRole('button', { name: 'Siguiente' }).click();
    await foto(p, 'grupo-alta-2-aula-errores', { form: F, estado: 'Paso 2, «Siguiente» sin aula (error junto al campo y resumen)', ruta });

    await llenarDatos();
    await p.getByRole('button', { name: 'Siguiente' }).click();
    await aula.waitFor();
    await elegirEnCombo(p, 'Aula', 'ZZ');
    await p.getByRole('button', { name: 'Lun, Mié y Vie' }).click();
    await p.locator('input[type="time"]').first().fill('07:00');
    await p.locator('input[type="time"]').first().blur();
    await p.getByRole('heading', { name: 'Vista semanal' }).scrollIntoViewIfNeeded();
    await foto(p, 'grupo-alta-2-aula-franja', { form: F, estado: 'Paso 2, aula elegida y franja Lun-Mié-Vie 07:00-08:00 (duración, comparación con las horas de la materia y vista semanal)', ruta, mantenerScroll: true });
    await p.getByRole('button', { name: 'Siguiente' }).click();
    await p.getByRole('heading', { name: 'Revisión' }).waitFor();
    await foto(p, 'grupo-alta-3-revision', { form: F, estado: 'Paso 3 Revisión con «Editar» por sección (materia/docente, aula y horario)', ruta });
    await p.getByRole('button', { name: 'Crear grupo', exact: true }).click();
    await p.getByText('Grupo ZZ1 creado').first().waitFor({ timeout: 30000 });
    await foto(p, 'grupo-alta-4-exito', { form: F, estado: 'Éxito: «Grupo ZZ1 creado» con siguientes pasos (generar sesiones, inscribir alumnos, cámara del aula)', ruta });
    await ctx.close();
});

// ------------------------------------------------------------------------------------------------------------------------------
// Pantallas de un grupo (pestañas Datos, Horario, Aula y cámaras, Inscripciones). Usa el grupo ZZ1 que crea «grupo-alta».
function idGrupoZZ() {
    const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: '54329', PGUSER: 'postgres' };
    return execSync(`/usr/lib/postgresql/16/bin/psql -X -d susan -At -c "select id_grupo from grupo where clave_grupo='ZZ1' order by id_grupo desc limit 1"`, { env }).toString().trim();
}

escenario('grupo-detalle', async () => {
    const ctx = await contexto({}, await sesion('admin@susan.local'));
    const p = await ctx.newPage();
    const id = idGrupoZZ();
    const base = `/admin/grupos/${id}`;
    const pestana = async (nombre) => { await p.getByRole('tab', { name: nombre }).click(); await esperar(700); };

    // Pestaña Datos
    let F = 'Datos del grupo (GrupoForm, pestaña Datos)';
    await ir(p, base, p.getByRole('tab', { name: 'Datos' }));
    await p.getByRole('combobox', { name: 'Docente' }).waitFor();
    await esperar(600);
    await p.getByRole('button', { name: 'Guardar cambios' }).scrollIntoViewIfNeeded();
    await foto(p, 'grupo-datos-sin-cambios', { form: F, estado: 'Edición sin cambios: «Guardar cambios» apagado y el motivo escrito («Aún no hay cambios que guardar»)', ruta: base, mantenerScroll: true });
    await p.locator('input[name="clave_grupo"]').fill('zz 1!');
    await p.locator('input[name="periodo"]').fill('2026-3');
    await p.locator('input[name="periodo"]').blur();
    await p.getByRole('button', { name: 'Guardar cambios' }).scrollIntoViewIfNeeded();
    await foto(p, 'grupo-datos-errores', { form: F, estado: 'Edición con cambios inválidos: errores al salir de los campos y «2 cambios sin guardar» (no se guarda)', ruta: base, mantenerScroll: true });

    // Pestaña Horario (editor + generar sesiones)
    F = 'Horario semanal (HorarioEditor / HorarioSemanal, pestaña Horario)';
    await ir(p, base, p.getByRole('tab', { name: 'Horario' }));
    await pestana('Horario');
    await p.getByRole('button', { name: 'Guardar horario' }).scrollIntoViewIfNeeded();
    await foto(p, 'grupo-horario-editor', { form: F, estado: 'Horario guardado: franja Lun-Mié-Vie 07:00-08:00, total semanal y vista semanal', ruta: `${base}?tab=horario`, mantenerScroll: true });
    await p.locator('input[type="time"]').nth(1).fill('06:00');
    await p.locator('input[type="time"]').nth(1).blur();
    await esperar(300);
    await foto(p, 'grupo-horario-errores', { form: F, estado: 'Hora de fin anterior a la de inicio: error en línea y «Cambios sin guardar» (no se guarda)', ruta: `${base}?tab=horario` });
    F = 'Generar sesiones (GenerarSesiones, pestaña Horario)';
    await ir(p, base, p.getByRole('tab', { name: 'Horario' }));
    await pestana('Horario');
    await p.getByRole('heading', { name: 'Generar sesiones' }).scrollIntoViewIfNeeded();
    await p.getByLabel('Fecha a omitir').fill('2026-09-16');
    await p.getByRole('button', { name: 'Agregar fecha' }).click();
    await p.getByRole('button', { name: /^Generar \d+ sesiones$/ }).scrollIntoViewIfNeeded();
    await foto(p, 'grupo-generar-sesiones', { form: F, estado: 'Rango de fechas con atajos, fecha a omitir agregada y vista previa («Generar N sesiones»); no se envía', ruta: `${base}?tab=horario`, mantenerScroll: true });

    // Pestaña Aula y cámaras
    F = 'Capacidad del aula (CapacidadForm, pestaña Aula y cámaras)';
    await ir(p, base, p.getByRole('tab', { name: 'Aula y cámaras' }));
    await pestana('Aula y cámaras');
    await p.getByRole('textbox', { name: 'Capacidad del aula' }).fill('10');
    await p.getByRole('textbox', { name: 'Capacidad del aula' }).blur();
    await foto(p, 'grupo-capacidad-cambio', { form: F, estado: 'Capacidad editada (25 → 10): «Cambios sin guardar» y botón de guardar habilitado; no se envía', ruta: `${base}?tab=aula` });

    // Cámara (panel lateral)
    F = 'Alta de cámara (CamaraForm en PanelLateral)';
    await ir(p, base, p.getByRole('tab', { name: 'Aula y cámaras' }));
    await pestana('Aula y cámaras');
    await p.getByRole('button', { name: 'Agregar cámara de frente' }).click();
    const d = p.getByRole('dialog');
    await d.waitFor();
    await esperar(500);
    await foto(p, 'camara-vacio', { form: F, estado: 'Panel lateral «Agregar cámara», vacío (tipo Cámara IP, estatus Activa)', ruta: `${base}?tab=aula` });
    await d.getByRole('button', { name: /^(Agregar|Crear|Guardar)/ }).last().click();
    await esperar(300);
    await foto(p, 'camara-errores', { form: F, estado: 'Envío sin dirección IP: error junto al campo', ruta: `${base}?tab=aula` });
    await d.locator('input[name="direccion_ip"]').fill('999.1.1.1');
    await d.locator('input[name="direccion_ip"]').blur();
    await foto(p, 'camara-ip-invalida', { form: F, estado: 'Dirección IP con formato inválido (999.1.1.1)', ruta: `${base}?tab=aula` });
    await d.locator('input[name="direccion_ip"]').fill('10.20.12.99');
    await d.locator('input[name="direccion_ip"]').blur();
    await foto(p, 'camara-valido', { form: F, estado: 'Dirección IP válida (10.20.12.99), lista para guardar', ruta: `${base}?tab=aula` });
    await d.getByRole('button', { name: 'Agregar cámara' }).click();
    await esperar(2000);
    await p.getByRole('button', { name: /Probar conexión/ }).first().scrollIntoViewIfNeeded().catch(() => {});
    await foto(p, 'camara-guardada', { form: F, estado: 'Tras guardar: aviso «Cámara de frente guardada» y la cámara aparece en su posición', ruta: `${base}?tab=aula`, mantenerScroll: true });

    // Pestaña Inscripciones
    F = 'Inscribir alumnos (InscribirAlumno, pestaña Inscripciones)';
    await ir(p, base, p.getByRole('tab', { name: 'Inscripciones' }));
    await pestana('Inscripciones');
    const buscar = p.getByRole('combobox', { name: 'Buscar alumno' });
    await buscar.click();
    await buscar.fill('Ruiz');
    await p.getByRole('option').first().waitFor();
    await foto(p, 'inscribir-busqueda', { form: F, estado: 'Búsqueda remota de alumnos con opciones de dos líneas (nombre; matrícula y avisos)', ruta: `${base}?tab=inscripciones` });
    await p.getByRole('option').first().click();
    await buscar.fill('Diaz');
    await p.getByRole('option').filter({ hasText: 'Díaz' }).first().waitFor();
    await p.getByRole('option').filter({ hasText: 'Díaz' }).first().click();
    await p.keyboard.press('Escape');
    await esperar(300);
    await foto(p, 'inscribir-lista', { form: F, estado: 'Dos alumnos elegidos en la lista y botón «Inscribir 2 alumnos» (no se envía)', ruta: `${base}?tab=inscripciones` });

    // Importar desde CSV (modal de 4 pasos)
    F = 'Importar inscripciones desde CSV (ImportarCsv, modal de 4 pasos)';
    const csv = path.join(RAW, 'inscripciones-demo.csv');
    fs.writeFileSync(csv, ['matricula,apellido_paterno,apellido_materno,nombres,correo', 'E260001,,,,', 'E260002,,,,', 'E260003,,,,', 'ZZIMP001,Prueba,Importada,ZZ Alumno,zz.importado@susan.test', 'E260004,,,,correo-malo', ',Prueba,Sin,Matricula,a@b.co', ''].join('\n'));
    await p.getByRole('button', { name: 'Importar desde CSV' }).click();
    const m = p.getByRole('dialog');
    await m.waitFor();
    await esperar(500);
    await foto(p, 'importar-csv-1-archivo-vacio', { form: F, estado: 'Paso 1 Archivo, vacío (plantilla descargable y zona de arrastre)', ruta: `${base}?tab=inscripciones` });
    await m.locator('input[type="file"]').setInputFiles(csv);
    await esperar(800);
    await foto(p, 'importar-csv-1-archivo-cargado', { form: F, estado: 'Paso 1 Archivo, CSV de demostración cargado', ruta: `${base}?tab=inscripciones` });
    await m.getByRole('button', { name: 'Siguiente' }).click();
    await esperar(800);
    await foto(p, 'importar-csv-2-revision', { form: F, estado: 'Paso 2 Revisión: contadores, errores agrupados por causa y vista previa (el servidor aún no recibe nada)', ruta: `${base}?tab=inscripciones` });
    await m.getByRole('button', { name: 'Siguiente' }).click();
    await esperar(800);
    await foto(p, 'importar-csv-3-confirmar', { form: F, estado: 'Paso 3 Confirmar: qué pasará y cupo; no se confirma la importación', ruta: `${base}?tab=inscripciones` });
    await ctx.close();
});

// ------------------------------------------------------------------------------------------------------------------------------
function psql(sql) {
    const env = { ...process.env, PGHOST: '127.0.0.1', PGPORT: '54329', PGUSER: 'postgres' };
    return execSync(`/usr/lib/postgresql/16/bin/psql -X -d susan -At -c "${sql}"`, { env }).toString().trim();
}
const idAlumnoZZ = () => psql(`select id_alumno from alumno where matricula='ZZPRUEBA${SUF}'`);

// PDF mínimo para el documento del consentimiento y PNG para la miniatura del justificante (generados aquí, sin datos reales).
function archivosDemo() {
    const pdf = path.join(RAW, 'consentimiento-demo.pdf');
    fs.writeFileSync(pdf, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');
    const png = path.join(RAW, 'comprobante-demo.png');
    if (!fs.existsSync(png)) execSync(`convert -size 640x420 xc:'#f4f1ec' -fill '#1e1919' -pointsize 30 -annotate +40+120 'Constancia medica (demostracion)' -pointsize 22 -annotate +40+190 'Documento de prueba para el reporte' ${png}`);
    return { pdf, png };
}

escenario('alumno-ficha', async () => {
    const ctx = await contexto({}, await sesion('admin@susan.local'));
    const p = await ctx.newPage();
    const id = idAlumnoZZ();
    const ruta = `/admin/alumnos/${id}`;
    const { pdf } = archivosDemo();
    let F = 'Datos del alumno (AlumnoForm en la ficha)';
    await ir(p, ruta, p.getByRole('region', { name: 'Datos del alumno' }));
    await esperar(600);
    const regionDatos = p.getByRole('region', { name: 'Datos del alumno' });
    await foto(p, 'ficha-datos-sin-cambios', { form: F, estado: 'Ficha sin cambios: secciones Identidad, Contacto y Estado; guardar apagado con su motivo (recorte de la tarjeta)', ruta, elemento: regionDatos });
    await p.locator('input[name="apellido_paterno"]').fill('');
    await p.locator('input[name="correo_institucional"]').fill('zz.prueba@');
    await p.locator('input[name="correo_institucional"]').blur();
    await p.locator('input[name="apellido_paterno"]').focus();
    await p.locator('input[name="apellido_paterno"]').blur();
    await foto(p, 'ficha-datos-errores', { form: F, estado: 'Edición con errores (apellido vacío y correo incompleto) y «2 cambios sin guardar»; no se guarda (recorte de la tarjeta)', ruta, elemento: regionDatos });
    await ir(p, ruta, p.getByRole('region', { name: 'Datos del alumno' }));
    await p.getByRole('radio', { name: 'Baja temporal' }).click();
    await foto(p, 'ficha-estatus-baja', { form: F, estado: 'Cambio de estatus a «Baja temporal»: aviso con el efecto sobre sus inscripciones y «1 cambio sin guardar»; no se guarda (recorte de la tarjeta)', ruta, elemento: regionDatos });

    F = 'Consentimiento informado (FormularioConsentimiento en la ficha)';
    await ir(p, ruta, p.getByRole('region', { name: 'Consentimiento informado' }));
    await p.getByRole('form', { name: 'Registrar consentimiento' }).waitFor();
    await foto(p, 'consentimiento-vacio', { form: F, estado: 'Formulario vacío: fecha de firma, vigencia y documento PDF (zona de arrastre con reglas visibles; recorte del formulario)', ruta, elemento: p.getByRole('form', { name: 'Registrar consentimiento' }) });
    await p.getByRole('button', { name: 'Registrar consentimiento' }).click();
    await esperar(300);
    await foto(p, 'consentimiento-errores', { form: F, estado: 'Envío vacío: errores en fecha de firma, vigencia y documento (recorte del formulario)', ruta, elemento: p.getByRole('form', { name: 'Registrar consentimiento' }) });
    await p.getByRole('button', { name: 'Hoy' }).click();
    await esperar(300);
    await p.getByRole('form', { name: 'Registrar consentimiento' }).locator('input[type="file"]').setInputFiles(pdf);
    await esperar(600);
    await foto(p, 'consentimiento-valido', { form: F, estado: 'Firma con «Hoy» (reloj del plantel), vigencia sugerida de 1 año y PDF cargado; no se envía (recorte del formulario)', ruta, elemento: p.getByRole('form', { name: 'Registrar consentimiento' }) });

    F = 'Cuenta de acceso (CuentaAccesoPanel en la ficha)';
    await ir(p, ruta, p.getByRole('region', { name: 'Cuenta de acceso' }));
    await foto(p, 'ficha-cuenta-acceso', { form: F, estado: 'Alumno sin cuenta: se explica qué se creará y se ofrece «Crear cuenta de acceso» (recorte de la tarjeta)', ruta, elemento: p.getByRole('region', { name: 'Cuenta de acceso' }) });
    await ctx.close();
});

escenario('usuarios', async () => {
    const ctx = await contexto({}, await sesion('admin@susan.local'));
    const p = await ctx.newPage();
    const ruta = '/admin/usuarios';
    const F = 'Nueva cuenta de usuario (CrearUsuarioDialog en PanelLateral)';
    await ir(p, ruta, p.getByRole('button', { name: 'Nueva cuenta' }));
    await p.getByRole('button', { name: 'Nueva cuenta' }).click();
    const d = p.getByRole('dialog');
    await d.waitFor();
    await esperar(600);
    await foto(p, 'usuario-vacio', { form: F, estado: 'Panel lateral «Nueva cuenta de usuario», vacío (tarjetas de rol con su descripción)', ruta });
    await d.getByRole('button', { name: /^Crear/ }).last().click();
    await esperar(300);
    await foto(p, 'usuario-errores', { form: F, estado: 'Envío vacío: errores del vínculo y del correo', ruta });
    const vinculo = d.getByRole('combobox').first();
    await vinculo.click();
    await vinculo.fill('Ortega');
    await p.getByRole('option').filter({ hasText: 'Ortega' }).first().waitFor();
    await p.getByRole('option').filter({ hasText: 'Ortega' }).first().click();
    await esperar(400);
    await foto(p, 'usuario-valido', { form: F, estado: 'Docente elegido con búsqueda remota; el correo se prellena con el institucional del vínculo (editable); no se envía', ruta });
    await d.getByRole('button', { name: 'Cancelar' }).click().catch(() => {});
    await p.keyboard.press('Escape');
    await ir(p, ruta, p.getByRole('button', { name: 'Nueva cuenta' }));
    const F2 = 'Cambiar rol de una cuenta (AccionesUsuario, Modal full-mobile)';
    await p.getByRole('button', { name: 'Acciones de docente3@susan.local' }).click();
    await p.getByRole('menuitem', { name: 'Cambiar rol' }).click();
    const m = p.getByRole('dialog');
    await m.waitFor();
    await esperar(500);
    await foto(p, 'usuario-cambiar-rol-menu', { form: F2, estado: 'Modal «Cambiar rol» abierto desde el menú «⋯» de la fila; guardar apagado hasta elegir otro rol', ruta });
    await m.getByRole('radio', { name: /Técnico/ }).check({ force: true });
    await esperar(400);
    await foto(p, 'usuario-cambiar-rol-elegido', { form: F2, estado: 'Rol nuevo elegido (Técnico): se habilita guardar y se avisa qué pasa con el vínculo actual; no se envía', ruta });
    await ctx.close();
});

// ------------------------------------------------------------------------------------------------------------------------------
escenario('consola-tecnico', async () => {
    const ctx = await contexto({}, await sesion('tecnico@susan.local'));
    const p = await ctx.newPage();
    const ruta = '/tecnico';
    const pestana = async (n) => { await p.getByRole('tab', { name: n }).click(); await esperar(900); };
    let F = 'Consola técnica: cámaras (CamarasEstado, SegmentedControl + ConfirmDialog)';
    await ir(p, ruta, p.getByRole('tab', { name: 'Cámaras' }));
    await esperar(800);
    await foto(p, 'tecnico-camaras', { form: F, estado: 'Pestaña Cámaras: resumen y una tarjeta por cámara con su estatus como control segmentado (texto + color)', ruta });
    await p.getByRole('radiogroup', { name: /A-12 frente/ }).getByRole('radio', { name: 'Inactiva' }).click();
    await p.getByRole('dialog').waitFor();
    await esperar(400);
    await foto(p, 'tecnico-camaras-confirmar', { form: F, estado: 'Cambiar el estatus pide confirmación con el nombre de la cámara y la consecuencia; se cancela (no se aplica)', ruta });
    await p.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

    F = 'Consola técnica: parámetros del sistema (ParametrosEditor / ParametroFila)';
    await ir(p, ruta, p.getByRole('tab', { name: 'Parámetros' }));
    await pestana('Parámetros');
    await foto(p, 'tecnico-parametros', { form: F, estado: 'Pestaña Parámetros: 12 parámetros en 4 secciones, con unidad, rango válido, valor de fábrica y marca «Crítico»', ruta });
    const umbral = p.getByRole('textbox', { name: 'Umbral de similitud' });
    await umbral.fill('1.5');
    await umbral.blur();
    await esperar(300);
    await foto(p, 'tecnico-parametro-error', { form: F, estado: 'Valor fuera de rango (1.5 en un parámetro de 0.500 a 0.999): error en línea y «Sin guardar»; no se envía', ruta });
    await umbral.fill('0.900');
    await umbral.blur();
    await p.getByRole('button', { name: 'Guardar', exact: true }).first().click();
    await p.getByRole('dialog').waitFor();
    await esperar(400);
    await foto(p, 'tecnico-parametro-confirmar', { form: F, estado: 'Cambio válido (0.850 a 0.900): confirmación con el aviso del parámetro crítico; se cancela (no se guarda)', ruta });
    await p.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();

    F = 'Consola técnica: índice facial (IndiceFacialPanel + ConfirmDialog)';
    await ir(p, ruta, p.getByRole('tab', { name: 'Índice facial' }));
    await pestana('Índice facial');
    await foto(p, 'tecnico-indice', { form: F, estado: 'Pestaña Índice facial: versión en uso, plantillas indexadas y «Reconstruir índice»', ruta });
    await p.getByRole('button', { name: 'Reconstruir índice' }).click();
    await p.getByRole('dialog').waitFor();
    await esperar(400);
    await foto(p, 'tecnico-indice-reconstruir', { form: F, estado: 'Diálogo de reconstrucción con casilla «Reconstrucción completa»; se cancela (no se ejecuta)', ruta });
    await p.getByRole('dialog').getByRole('button', { name: 'Cancelar' }).click();
    await ctx.close();
});

// ------------------------------------------------------------------------------------------------------------------------------
// «Registrar manualmente» del pase de lista. Abrir la sesión 19 solo cambia sesion_clase.estatus; al terminar se restaura a 'programada'.
escenario('pase-manual', async () => {
    const antes = psql("select estatus||'/'||modo_registro from sesion_clase where id_sesion=19");
    const ctx = await contexto({}, await sesion('docente1@susan.local'));
    const p = await ctx.newPage();
    const ruta = '/docente/sesiones/19?pasar-lista=1';
    try {
        await ir(p, ruta);
        const abrir = p.getByRole('button', { name: /Abrir sesión y pasar lista/ });
        if (await abrir.count()) await abrir.first().click();
        await p.getByRole('button', { name: 'Registrar manualmente' }).first().waitFor({ timeout: 60000 });
        await esperar(1500);
        await foto(p, 'pase-lista-panel', { form: 'Pasar lista (PasosPaseLista + panel de la sesión)', estado: 'Sesión 3A abierta con la franja de 3 pasos, la vista de cámara y los botones «Revisar y cerrar» / «Registrar manualmente»', ruta });
        await p.getByRole('button', { name: 'Registrar manualmente' }).first().click();
        const d = p.getByRole('dialog');
        await d.waitFor();
        await esperar(700);
        const F = 'Registrar manualmente (RegistroManualDialog)';
        await foto(p, 'registro-manual-vacio', { form: F, estado: 'Diálogo vacío: alumno (selector con búsqueda) y estado con la sugerencia según la hora', ruta });
        await d.getByRole('button', { name: /^Registrar$|Guardar$/ }).last().click().catch(() => {});
        await esperar(300);
        await foto(p, 'registro-manual-errores', { form: F, estado: 'Envío sin elegir alumno: error junto al selector', ruta });
        const c = d.getByRole('combobox').first();
        await c.click();
        await c.fill('Díaz');
        await p.getByRole('option').filter({ hasText: 'Díaz' }).first().waitFor();
        await p.getByRole('option').filter({ hasText: 'Díaz' }).first().click();
        await esperar(400);
        await foto(p, 'registro-manual-valido', { form: F, estado: 'Alumno elegido y estado Presente sugerido; listo para registrar (no se envía)', ruta });
    } finally {
        await ctx.close();
        psql(`update sesion_clase set estatus='programada', modo_registro='automatico' where id_sesion=19 and estatus='abierta'`);
        console.log('  sesión 19: antes', antes, '-> ahora', psql("select estatus||'/'||modo_registro from sesion_clase where id_sesion=19"));
    }
});

// ------------------------------------------------------------------------------------------------------------------------------
escenario('justificante', async () => {
    const { png } = archivosDemo();
    const ctx = await contexto({}, await sesion('e260002@susan.local'));
    const p = await ctx.newPage();
    const ruta = '/alumno';
    const F = 'Registrar justificante (RegistrarJustificanteForm, alumno)';
    const region = p.getByRole('region', { name: 'Registrar justificante' });
    await ir(p, ruta, region);
    await esperar(800);
    await foto(p, 'justificante-vacio', { form: F, estado: 'Vacío: 3 bloques numerados (falta, motivo, documento) y la barra dice qué falta; con 2 faltas se ven como tarjetas', ruta, elemento: region });
    await region.getByRole('button', { name: 'Enviar justificante' }).click();
    await esperar(400);
    await foto(p, 'justificante-errores', { form: F, estado: 'Envío incompleto: errores en los tres bloques y el foco en el primero (el botón no se apaga)', ruta, elemento: region });
    await region.locator('label:has(input[type="radio"])').first().click();
    await region.getByRole('button', { name: 'Cita médica' }).click();
    const motivo = region.getByRole('textbox', { name: /Motivo/ });
    await motivo.pressSequentially('ZZ Prueba de reporte, consulta con constancia.');
    await region.locator('input[type="file"]').first().setInputFiles(png);
    await esperar(900);
    await foto(p, 'justificante-valido', { form: F, estado: 'Lleno y válido: falta elegida, motivo con contador y miniatura del documento; la barra dice «Todo listo para enviar»', ruta, elemento: region });
    await region.getByRole('button', { name: 'Enviar justificante' }).click();
    await p.getByText('Justificante enviado').first().waitFor({ timeout: 60000 });
    await esperar(600);
    await foto(p, 'justificante-exito', { form: F, estado: 'Éxito dentro de la tarjeta: «Justificante enviado» (Pendiente) con siguientes pasos', ruta, elemento: region });
    await ctx.close();
    // Alumna con más de 4 faltas: la elección pasa a un selector con búsqueda.
    const ctx2 = await contexto({}, await sesion('e260016@susan.local'));
    const q = await ctx2.newPage();
    const region2 = q.getByRole('region', { name: 'Registrar justificante' });
    await ir(q, ruta, region2);
    await q.getByRole('combobox', { name: /Falta o retardo/ }).click();
    await esperar(500);
    await region2.scrollIntoViewIfNeeded();
    await foto(q, 'justificante-selector-faltas', { form: F, estado: 'Con más de 4 faltas la elección es un selector con búsqueda (opciones con fecha, materia y estado en texto)', ruta, mantenerScroll: true });
    await ctx2.close();
});

// ------------------------------------------------------------------------------------------------------------------------------
// Cuenta de acceso del alumno ZZ (creada desde su ficha), activación de la cuenta (Onboarding) y registro facial propio (MiRegistro).
// Chromium se lanza aparte con cámara falsa (patrón de prueba de Chromium): no contiene un rostro, así que la toma no se completa.
escenario('cuenta-y-registro', async () => {
    const ctxA = await contexto({}, await sesion('admin@susan.local'));
    const a = await ctxA.newPage();
    const ficha = `/admin/alumnos/${idAlumnoZZ()}`;
    await ir(a, ficha, a.getByRole('region', { name: 'Cuenta de acceso' }));
    await a.getByRole('button', { name: 'Crear cuenta de acceso' }).click();
    const d = a.getByRole('dialog');
    await d.waitFor();
    await esperar(600);
    const clave = await d.locator('input[readonly]').first().inputValue();
    // La contraseña temporal (de una cuenta de prueba que se elimina) se enmascara en la captura.
    await a.addStyleTag({ content: 'input[readonly] { -webkit-text-security: disc; }' });
    await a.locator('input[readonly]').first().evaluate((el) => el.blur());
    await foto(a, 'cuenta-clave-temporal', { form: 'Cuenta de acceso del alumno: contraseña temporal (PasswordTemporalModal)', estado: 'Tras crear la cuenta: la contraseña temporal se muestra una sola vez, con «Copiar» (cuenta de prueba que se elimina al terminar; la clave se enmascara en la captura)', ruta: ficha });
    await d.getByRole('button', { name: /Ya la copié/ }).click();
    await esperar(800);
    await foto(a, 'ficha-cuenta-creada', { form: 'Cuenta de acceso (CuentaAccesoPanel en la ficha)', estado: 'Después de crear la cuenta: la tarjeta pasa a «Cuenta activa» con su correo', ruta: ficha, elemento: a.getByRole('region', { name: 'Cuenta de acceso' }) });
    await ctxA.close();

    const nav2 = await chromium.launch({ args: ['--no-sandbox', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
    try {
        const ctx = await contexto({ permissions: ['camera'] }, undefined, nav2);
        const p = await ctx.newPage();
        await p.goto(`${BASE}/login`, { waitUntil: 'domcontentloaded' });
        await reposar(p);
        await esperar(2000);
        await p.locator('input[name="correo"]').fill(ZZ.correo);
        await p.locator('input[name="contrasena"]').fill(clave);
        await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 90000 }), p.getByRole('button', { name: 'Iniciar sesión' }).click()]);

        // Activación de la cuenta: contraseña -> estilo -> guía -> privacidad.
        const F = 'Activar cuenta (Onboarding, asistente de 4 pasos)';
        const ruta = '/activar-cuenta';
        const nueva = p.locator('input[name="nueva"]');
        await ir(p, ruta, nueva);
        await foto(p, 'activar-1-contrasena-vacio', { form: F, estado: 'Paso 1 Contraseña, vacío (requisitos con icono y texto)', ruta });
        await p.getByRole('button', { name: 'Activar mi cuenta' }).click();
        await esperar(300);
        await foto(p, 'activar-1-contrasena-error', { form: F, estado: 'Paso 1, envío vacío: error junto al campo', ruta });
        await nueva.fill('corta');
        await esperar(300);
        await foto(p, 'activar-1-contrasena-parcial', { form: F, estado: 'Paso 1, contraseña parcial: requisitos en vivo («1 de 3»)', ruta });
        await nueva.fill('Prueba-zz-2026');
        await p.getByRole('button', { name: /Mostrar/ }).first().click().catch(() => {});
        await esperar(300);
        await foto(p, 'activar-1-contrasena-valida', { form: F, estado: 'Paso 1, contraseña válida (3 de 3 requisitos) y visible con «Mostrar»', ruta });
        await p.getByRole('button', { name: 'Activar mi cuenta' }).click();
        await p.getByRole('heading', { name: 'Elige tu estilo' }).waitFor({ timeout: 60000 });
        await foto(p, 'activar-2-estilo', { form: F, estado: 'Paso 2 Estilo: color del avatar (se guarda por navegador)', ruta });
        await p.getByRole('button', { name: 'Continuar' }).click();
        await p.getByRole('heading', { name: /Así funciona SUSAN/ }).waitFor();
        await foto(p, 'activar-3-guia', { form: F, estado: 'Paso 3 Guía de SUSAN según el rol (alumno)', ruta });
        await p.getByRole('button', { name: 'Continuar' }).click();
        await p.getByRole('heading', { name: 'Tu privacidad' }).waitFor();
        await foto(p, 'activar-4-privacidad', { form: F, estado: 'Paso 4 Privacidad: el botón final está apagado y el motivo se escribe junto a él', ruta });
        await p.getByRole('checkbox').check();
        await esperar(300);
        await foto(p, 'activar-4-privacidad-aceptada', { form: F, estado: 'Paso 4, acuse marcado: se habilita «Empezar a usar SUSAN»', ruta });
        await p.getByRole('button', { name: 'Empezar a usar SUSAN' }).click();
        await p.waitForURL((u) => !u.pathname.startsWith('/activar-cuenta'), { timeout: 60000 });

        // Registro facial propio: aviso -> rostro -> listo.
        const F2 = 'Mi registro facial (MiRegistro: aviso de consentimiento y asistente de rostro)';
        const rr = '/alumno/registro';
        await ir(p, rr, p.getByRole('heading', { name: 'Mi registro facial' }));
        await esperar(800);
        await foto(p, 'registro-facial-1-aviso', { form: F2, estado: 'Paso 1 Aviso y consentimiento: texto del aviso por secciones y declaración de aceptación', ruta: rr });
        await p.getByRole('button', { name: 'Aceptar y continuar' }).click();
        await esperar(400);
        await p.getByText('Marca la declaración para continuar.').first().scrollIntoViewIfNeeded();
        await foto(p, 'registro-facial-1-aviso-error', { form: F2, estado: 'Aceptar sin marcar la declaración: error junto a la casilla', ruta: rr, mantenerScroll: true });
        await p.getByRole('checkbox').check();
        await p.getByRole('button', { name: 'Aceptar y continuar' }).scrollIntoViewIfNeeded();
        await foto(p, 'registro-facial-1-aviso-marcado', { form: F2, estado: 'Declaración marcada y botón «Aceptar y continuar» (registra el consentimiento propio)', ruta: rr, mantenerScroll: true });
        await p.getByRole('button', { name: 'Aceptar y continuar' }).click();
        await p.getByRole('button', { name: 'Registrar mi rostro' }).waitFor({ timeout: 60000 });
        await esperar(800);
        await foto(p, 'registro-facial-2-rostro', { form: F2, estado: 'Paso 2 Tu rostro: indicaciones y «Registrar mi rostro» (consentimiento ya registrado)', ruta: rr });
        await p.getByRole('button', { name: 'Registrar mi rostro' }).click();
        await p.getByRole('dialog').waitFor();
        await esperar(800);
        await foto(p, 'registro-facial-3-asistente-intro', { form: F2, estado: 'Asistente de cámara: portada con consejos y «Comenzar»', ruta: rr });
        await p.getByRole('button', { name: 'Comenzar' }).click();
        await esperar(4000);
        await foto(p, 'registro-facial-3-captura', { form: F2, estado: 'Toma guiada con la cámara (cámara falsa de Chromium: sin rostro, la toma no se completa)', ruta: rr });
        await ctx.close();
    } finally {
        await nav2.close();
    }
});

// ------------------------------------------------------------------------------------------------------------------------------
// Recuperar contraseña y cambiar contraseña (pantallas de acceso). Ninguna contraseña real se cambia: solo se muestran estados.
escenario('auth', async () => {
    const ctx = await contexto();
    const p = await ctx.newPage();
    let ruta = '/recuperar';
    let F = 'Recuperar contraseña (RecuperarForm)';
    const correo = p.locator('input[name="correo"]');
    await ir(p, ruta, correo);
    await esperar(1500);
    await foto(p, 'recuperar-vacio', { form: F, estado: 'Vacío', ruta });
    await correo.fill('abc');
    await p.getByRole('button', { name: 'Enviar instrucciones' }).click();
    await esperar(300);
    await foto(p, 'recuperar-error', { form: F, estado: 'Envío con un correo sin @: error concreto junto al campo', ruta });
    await correo.fill('zz.prueba.recuperar@susan.test');
    await p.getByRole('button', { name: 'Enviar instrucciones' }).click();
    await p.getByRole('heading', { name: 'Revisa tu correo' }).waitFor({ timeout: 30000 });
    await foto(p, 'recuperar-exito', { form: F, estado: 'Éxito: «Revisa tu correo» con mensaje neutro, «Reenviar enlace» con cuenta atrás de 60 s y «Usar otro correo»', ruta });
    await ctx.close();

    const ctx2 = await contexto({}, await sesion('admin@susan.local'));
    const q = await ctx2.newPage();
    ruta = '/cambiar-contrasena';
    F = 'Cambiar contraseña (CambiarContrasenaForm)';
    const nueva = q.locator('input[name="nueva"]');
    await ir(q, ruta, nueva);
    await foto(q, 'cambiar-clave-vacio', { form: F, estado: 'Vacío: un solo campo con requisitos en vivo (sin confirmación), «Mostrar» y aviso de Bloq Mayús', ruta });
    await nueva.fill('solo-letras');
    await esperar(300);
    await foto(q, 'cambiar-clave-parcial', { form: F, estado: 'Contraseña de solo letras: «2 de 3 requisitos» y falta el número (no se envía)', ruta });
    await nueva.fill('Segura-2026-ok');
    await esperar(300);
    await foto(q, 'cambiar-clave-valida', { form: F, estado: 'Cumple los 3 requisitos (no se envía: el administrador de demostración conserva su contraseña)', ruta });
    await ctx2.close();
});

// ------------------------------------------------------------------------------------------------------------------------------
// Revisión de justificantes (docente): decisión con ConfirmDialog y motivo obligatorio al rechazar. No se resuelve ningún caso.
escenario('revision', async () => {
    const ctx = await contexto({}, await sesion('docente1@susan.local'));
    const p = await ctx.newPage();
    const ruta = '/docente/revision?pestana=justificantes';
    const F = 'Resolver justificante (JustificanteCard + ConfirmDialog con motivo)';
    await ir(p, ruta, p.getByRole('tab', { name: /Justificantes/ }));
    await esperar(800);
    await p.getByRole('tab', { name: /Justificantes/ }).click();
    await p.getByRole('tabpanel').getByRole('button').first().click();
    await p.getByRole('region', { name: 'Decisión' }).waitFor();
    await esperar(800);
    await p.getByRole('region', { name: 'Decisión' }).scrollIntoViewIfNeeded();
    await foto(p, 'revision-justificante-caso', { form: F, estado: 'Caso abierto: motivo del justificante, lecturas bajo demanda y botones «Aprobar» / «Rechazar»', ruta, mantenerScroll: true });
    await p.getByRole('button', { name: 'Rechazar', exact: true }).click();
    const d = p.getByRole('dialog');
    await d.waitFor();
    await esperar(400);
    await foto(p, 'revision-rechazar-vacio', { form: F, estado: 'Diálogo «Rechazar justificante» con el comentario obligatorio, vacío', ruta });
    await d.getByRole('button', { name: 'Rechazar', exact: true }).click();
    await esperar(300);
    await foto(p, 'revision-rechazar-error', { form: F, estado: 'Confirmar sin comentario: «Escribe el motivo para continuar.» con borde rojo y foco en el campo (no se rechaza)', ruta });
    await d.getByRole('textbox').fill('El documento no es legible; sube una foto más clara.');
    await esperar(300);
    await foto(p, 'revision-rechazar-lleno', { form: F, estado: 'Comentario escrito: listo para confirmar (se cancela, no se rechaza)', ruta });
    await d.getByRole('button', { name: 'Cancelar' }).click();
    await ctx.close();
});

// ------------------------------------------------------------------------------------------------------------------------------
// Filtros: listado con BarraFiltros, reportes, analítica y bitácora.
escenario('filtros', async () => {
    const ctx = await contexto({}, await sesion('admin@susan.local'));
    const p = await ctx.newPage();
    let ruta = '/admin/alumnos';
    let F = 'Filtros del listado de alumnos (BarraFiltros)';
    await ir(p, ruta, p.getByRole('searchbox').first());
    await esperar(800);
    const caja = p.getByRole('searchbox').first();
    await caja.fill('Díaz');
    await esperar(900);
    const estatus = p.getByRole('combobox', { name: /Estatus/ });
    if (await estatus.count()) await estatus.selectOption({ index: 1 }).catch(() => {});
    await esperar(900);
    await foto(p, 'filtros-alumnos', { form: F, estado: 'Búsqueda con retraso («Díaz»), filtro de estatus con su chip activo, «Limpiar» y conteo de resultados', ruta });

    ruta = '/reportes';
    F = 'Filtros del reporte de asistencia (FiltrosReporte)';
    await ir(p, ruta, p.getByRole('form', { name: 'Filtros del reporte' }));
    await esperar(800);
    await foto(p, 'filtros-reporte', { form: F, estado: 'Periodo, grupo y alumno (el alumno se habilita al elegir grupo)', ruta });

    ruta = '/analitica';
    F = 'Selección de grupo para la analítica (SelectorGrupo)';
    await ir(p, ruta, p.getByRole('form', { name: 'Selección de grupo a analizar' }));
    await esperar(800);
    await foto(p, 'filtros-analitica', { form: F, estado: 'Periodo y grupo a analizar', ruta });

    ruta = '/admin/bitacora';
    F = 'Filtros de la bitácora (BitacoraTabla: Combobox, RangoFechas)';
    await ir(p, ruta, p.getByRole('combobox', { name: 'Acción' }));
    await esperar(800);
    await p.getByRole('textbox', { name: 'Desde' }).fill('2026-09-20');
    await p.getByRole('textbox', { name: 'Hasta' }).fill('2026-09-10');
    await p.getByRole('textbox', { name: 'Hasta' }).blur();
    await esperar(500);
    await foto(p, 'filtros-bitacora-rango-invertido', { form: F, estado: 'Rango de fechas invertido: se explica junto a las fechas y no se aplica (la lista conserva el último filtro válido)', ruta });
    await ctx.close();
});

// ------------------------------------------------------------------------------------------------------------------------------
// Capturas móviles (390x844 @3x).
escenario('moviles', async () => {
    let ctx = await contexto(MOVIL);
    let p = await ctx.newPage();
    let ruta = '/login';
    await ir(p, ruta, p.locator('input[name="correo"]'));
    await esperar(1500);
    await p.getByRole('button', { name: 'Iniciar sesión' }).click();
    await esperar(400);
    await foto(p, 'movil-login-errores', { form: 'Inicio de sesión (LoginForm), móvil', estado: 'Móvil 390x844: envío vacío con errores en ambos campos', ruta });
    await ctx.close();

    ctx = await contexto(MOVIL, await sesion('admin@susan.local'));
    p = await ctx.newPage();
    ruta = '/admin/alumnos/nuevo';
    await ir(p, ruta, p.locator('input[name="matricula"]'));
    await p.locator('input[name="matricula"]').fill('zzmovil01');
    await p.locator('input[name="nombres"]').fill('ZZ Movil');
    await p.locator('input[name="apellido_paterno"]').fill('Prueba');
    await p.locator('input[name="nombres"]').focus();
    await p.getByText('Matrícula disponible').first().waitFor({ timeout: 15000 });
    await foto(p, 'movil-alumno-alta-paso1', { form: 'Alta de alumno (asistente), móvil', estado: 'Móvil 390x844: paso 1 con el progreso compacto («Paso 1 de 3») y las acciones al pie', ruta });
    await p.getByRole('button', { name: 'Siguiente' }).click();
    await p.locator('input[name="correo_institucional"]').waitFor();
    await p.locator('input[name="correo_institucional"]').fill('zz.movil@susan.test');
    await p.getByRole('switch').click();
    await p.locator('input[name="correo_institucional"]').blur();
    await foto(p, 'movil-alumno-alta-paso2', { form: 'Alta de alumno (asistente), móvil', estado: 'Móvil 390x844: paso 2 Contacto y acceso con el interruptor de cuenta activado (no se crea ningún alumno)', ruta });
    await ir(p, '/admin/aulas', p.getByRole('button', { name: 'Nueva aula' }));
    await p.getByRole('button', { name: 'Nueva aula' }).click();
    const d = p.getByRole('dialog');
    await d.waitFor();
    await esperar(500);
    await d.getByRole('button', { name: 'Crear aula', exact: true }).click();
    await esperar(300);
    await foto(p, 'movil-aula-panel-errores', { form: 'Alta de aula (PanelLateral a pantalla completa), móvil', estado: 'Móvil 390x844: el panel lateral ocupa toda la pantalla; envío vacío con errores y el motivo en el pie', ruta: '/admin/aulas' });
    await ctx.close();

    ctx = await contexto(MOVIL, await sesion('e260002@susan.local'));
    p = await ctx.newPage();
    ruta = '/alumno';
    const region = p.getByRole('region', { name: 'Registrar justificante' });
    await ir(p, ruta, region);
    await region.evaluate((el) => el.scrollIntoView({ block: 'start' }));
    await esperar(400);
    await foto(p, 'movil-justificante', { form: 'Registrar justificante (RegistrarJustificanteForm), móvil', estado: 'Móvil 390x844: tarjetas de falta, motivo con ideas para empezar y zona de documento (con botón «Tomar foto» en pantallas táctiles)', ruta, mantenerScroll: true });
    await ctx.close();
});

// ------------------------------------------------------------------------------------------------------------------------------
const TITULO_ESCENARIO = {
    login: 'Acceso: inicio de sesión', auth: 'Acceso: recuperar y cambiar contraseña', 'alumno-alta': 'Alta de alumno (asistente de 3 pasos)',
    'alumno-ficha': 'Ficha del alumno: datos, consentimiento y cuenta', catalogos: 'Catálogos en panel lateral: aula, materia y docente',
    usuarios: 'Usuarios: nueva cuenta y cambio de rol', 'grupo-alta': 'Alta de grupo (asistente de 3 pasos)',
    'grupo-detalle': 'Grupo: datos, horario, generar sesiones, capacidad, cámara, inscripciones e importación CSV',
    justificante: 'Justificante guiado (alumno)', 'cuenta-y-registro': 'Cuenta de acceso, activación de cuenta (Onboarding) y registro facial del alumno',
    revision: 'Revisión de justificantes (docente)', 'pase-manual': 'Pase de lista: registro manual', 'consola-tecnico': 'Consola técnica',
    filtros: 'Filtros de listados, reportes, analítica y bitácora', moviles: 'Capturas móviles (390x844 a 3x)',
};
// Selección sugerida para el reporte (una o dos por formulario, priorizando errores, estado válido y éxito).
const SUGERIDAS = ['login-vacio', 'login-errores-envio', 'login-credenciales-incorrectas', 'recuperar-exito',
    'alumno-alta-1-identidad-vacio', 'alumno-alta-1-identidad-errores', 'alumno-alta-1-matricula-duplicada', 'alumno-alta-1-identidad-valido', 'alumno-alta-2-contacto-valido', 'alumno-alta-3-revision', 'alumno-alta-4-exito',
    'ficha-datos-errores', 'consentimiento-valido', 'aula-errores', 'aula-valido', 'aula-exito', 'materia-valido', 'docente-errores', 'usuario-valido', 'usuario-cambiar-rol-elegido',
    'grupo-alta-1-datos-errores', 'grupo-alta-1-datos-valido', 'grupo-alta-2-aula-franja', 'grupo-alta-3-revision', 'grupo-alta-4-exito', 'grupo-generar-sesiones', 'importar-csv-2-revision', 'inscribir-lista', 'camara-errores',
    'justificante-vacio', 'justificante-errores', 'justificante-valido', 'justificante-exito',
    'activar-1-contrasena-parcial', 'activar-4-privacidad', 'registro-facial-1-aviso-error', 'registro-facial-3-asistente-intro', 'registro-facial-3-captura',
    'revision-rechazar-error', 'registro-manual-valido', 'tecnico-parametro-error', 'tecnico-parametro-confirmar', 'tecnico-indice-reconstruir', 'filtros-alumnos',
    'movil-login-errores', 'movil-alumno-alta-paso2', 'movil-aula-panel-errores', 'movil-justificante'];

function renumerar() {
    // Las capturas ya numeradas se leen antes de borrarlas: así una corrida parcial (o con _raw limpiado) no pierde las demás.
    const previas = {};
    for (const f of fs.readdirSync(SALIDA)) { const m = /^f\d+-(.*)\.png$/.exec(f); if (m) previas[m[1]] = fs.readFileSync(path.join(SALIDA, f)); }
    const entradas = Object.entries(manifiesto).filter(([slug]) => fs.existsSync(path.join(RAW, `${slug}.png`)) || previas[slug]);
    const posicion = (n) => { const i = ESCENARIOS.indexOf(n); return i < 0 ? 999 : i; };
    entradas.sort((a, b) => posicion(a[1].escenario) - posicion(b[1].escenario) || a[1].ts - b[1].ts);
    for (const f of fs.readdirSync(SALIDA)) if (/^f\d+-.*\.png$/.test(f)) fs.unlinkSync(path.join(SALIDA, f));
    const filas = [];
    entradas.forEach(([slug, m], i) => {
        const nombre = `f${String(i + 1).padStart(2, '0')}-${slug}.png`;
        if (fs.existsSync(path.join(RAW, `${slug}.png`))) fs.copyFileSync(path.join(RAW, `${slug}.png`), path.join(SALIDA, nombre));
        else fs.writeFileSync(path.join(SALIDA, nombre), previas[slug]);
        filas.push({ slug, nombre, ...m });
    });
    fs.writeFileSync(path.join(SALIDA, 'indice.json'), JSON.stringify(filas.map(({ ts, orden, ...f }) => f), null, 2));
    const vista = (f) => (f.slug.startsWith('movil-') ? '390x844 @3x (móvil)' : `1440x900 @2x${f.recorte ? ', recorte de la tarjeta' : ''}`);
    const celda = (t) => String(t).replace(/\|/g, '/');
    const fila = (f) => `| ${f.nombre} | ${celda(f.form)} | ${celda(f.estado)} | \`${f.ruta}\` | ${vista(f)} |`;
    const cab = '| Archivo | Formulario | Estado | Ruta | Vista |\n|---|---|---|---|---|';
    const sug = SUGERIDAS.map((s) => filas.find((f) => f.slug === s)).filter(Boolean);
    let md = `# Índice de capturas de formularios (${filas.length} imágenes)\n\n`;
    md += 'Capturas reales de la aplicación en ejecución (Next 16.3.8 dev, `SUSAN_LOCAL=1`, reloj de demostración fijo en 2026-09-14 07:12 -06), tomadas con Playwright y Chromium por `form/capturar-forms.mjs`. ';
    md += 'Escritorio 1440x900 con factor de escala 2 (PNG de 2880x1800; las marcadas «recorte» fotografían solo la tarjeta del formulario cuando es más alta que la ventana) y móvil 390x844 a 3x. ';
    md += 'Con «reducir movimiento» activado para que las animaciones no dejen estados a medias. Solo se ocultaron con CSS las insignias de desarrollo (indicador de Next y la tarjeta «Reloj de demostración»). ';
    md += 'Los datos creados llevan el prefijo «ZZ» (ver `form/resumen.md`).\n\n';
    md += `## Selección sugerida para el reporte (${sug.length})\n\n${cab}\n${sug.map(fila).join('\n')}\n\n## Todas las capturas, por formulario\n\n`;
    for (const esc of ESCENARIOS) {
        const del = filas.filter((f) => f.escenario === esc);
        if (!del.length) continue;
        md += `### ${TITULO_ESCENARIO[esc] ?? esc}\n\n${cab}\n${del.map(fila).join('\n')}\n\n`;
    }
    fs.writeFileSync(path.join(SALIDA, 'INDICE.md'), md);
    return filas;
}

const pedidos = process.argv.slice(2);
browser = await chromium.launch({ executablePath: undefined, args: ['--no-sandbox'] });
try {
    for (const nombre of EJECUCION) {
        if (!ESC[nombre]) continue;
        if (pedidos.length && !pedidos.includes(nombre)) continue;
        escenarioActual = nombre;
        ordenEscenario = ESCENARIOS.indexOf(nombre);
        console.log('Escenario', nombre);
        try { await ESC[nombre](); } catch (e) { console.error('  FALLÓ', nombre, e.message.split('\n')[0]); }
    }
} finally {
    await browser.close();
}
const filas = renumerar();
console.log(`${filas.length} capturas en ${SALIDA}`);
