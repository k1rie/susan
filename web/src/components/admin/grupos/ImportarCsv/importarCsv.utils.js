// Parser del CSV de importación de inscripciones (columnas de api_importar_inscripciones).
// Columnas: matricula (obligatoria), apellido_paterno, apellido_materno, nombres, correo.
// Alumno existente: basta la matrícula. Alumno nuevo: el servidor exige apellido_paterno, nombres y correo.
export const MAX_FILAS = 500;
export const COLUMNAS = ['matricula', 'apellido_paterno', 'apellido_materno', 'nombres', 'correo'];
const ALIAS = { correo_institucional: 'correo', email: 'correo', apellidopaterno: 'apellido_paterno', apellidomaterno: 'apellido_materno' };
const CORREO_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const normalizarEncabezado = (h) => {
    const k = h.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '_');
    return ALIAS[k] || k;
};

/** Divide el texto en filas de celdas respetando comillas dobles; separador , o ; (el más frecuente en la 1ª línea). */
export function dividirCsv(texto) {
    const t = String(texto ?? '').replace(/^﻿/, '');
    const primera = t.split(/\r?\n/, 1)[0] || '';
    const sep = (primera.match(/;/g) || []).length > (primera.match(/,/g) || []).length ? ';' : ',';
    const filas = [];
    let fila = [];
    let celda = '';
    let comillas = false;
    for (let i = 0; i < t.length; i++) {
        const c = t[i];
        if (comillas) {
            if (c === '"' && t[i + 1] === '"') {
                celda += '"';
                i++;
            } else if (c === '"') comillas = false;
            else celda += c;
        } else if (c === '"') comillas = true;
        else if (c === sep) {
            fila.push(celda);
            celda = '';
        } else if (c === '\n' || c === '\r') {
            if (c === '\r' && t[i + 1] === '\n') i++;
            fila.push(celda);
            filas.push(fila);
            fila = [];
            celda = '';
        } else celda += c;
    }
    if (celda !== '' || fila.length) {
        fila.push(celda);
        filas.push(fila);
    }
    return filas.filter((f) => f.some((c) => c.trim() !== ''));
}

/**
 * @returns {{ filas: object[], errores: {linea:number, matricula:string, mensaje:string}[], erroresGlobales: string[] }}
 * `filas` son las enviables (con `linea` del archivo); `errores` las descartadas por validación local.
 */
export function parsearCsvInscripciones(texto) {
    const crudas = dividirCsv(texto);
    const resultado = { filas: [], errores: [], erroresGlobales: [] };
    if (crudas.length === 0) {
        resultado.erroresGlobales.push('El archivo está vacío.');
        return resultado;
    }
    const encabezados = crudas[0].map(normalizarEncabezado);
    const idx = Object.fromEntries(COLUMNAS.map((c) => [c, encabezados.indexOf(c)]));
    if (idx.matricula < 0) {
        resultado.erroresGlobales.push('Falta la columna "matricula" en la primera fila.');
        return resultado;
    }
    const vistas = new Set();
    crudas.slice(1).forEach((celdas, i) => {
        const linea = i + 2;
        const get = (c) => (idx[c] >= 0 ? (celdas[idx[c]] ?? '').trim() : '');
        const fila = {
            matricula: get('matricula').toUpperCase(),
            apellido_paterno: get('apellido_paterno') || undefined,
            apellido_materno: get('apellido_materno') || undefined,
            nombres: get('nombres') || undefined,
            correo: get('correo').toLowerCase() || undefined,
        };
        const rechazar = (mensaje) => resultado.errores.push({ linea, matricula: fila.matricula, mensaje });
        if (!fila.matricula) return rechazar('Falta la matrícula.');
        if (fila.correo && !CORREO_RE.test(fila.correo)) return rechazar('El correo no es válido.');
        if (vistas.has(fila.matricula)) return rechazar('Matrícula repetida en el archivo.');
        vistas.add(fila.matricula);
        resultado.filas.push({ ...fila, linea });
    });
    if (resultado.filas.length === 0 && resultado.errores.length === 0) resultado.erroresGlobales.push('El archivo no tiene filas de datos.');
    if (resultado.filas.length > MAX_FILAS) {
        resultado.erroresGlobales.push(`Máximo ${MAX_FILAS} filas por importación; el archivo trae ${resultado.filas.length}.`);
    }
    return resultado;
}

/** Quita `linea` (solo de interfaz) antes de enviar al servidor. */
export const filasParaApi = (filas) => filas.map(({ linea, ...resto }) => Object.fromEntries(Object.entries(resto).filter(([, v]) => v !== undefined)));

// ---------------------------------------------------------------------------------------------------------------------------
// Apoyo del flujo en pasos (plantilla, revisión por causas, reporte descargable). El parser de arriba no cambia.
// ---------------------------------------------------------------------------------------------------------------------------

export const NOMBRE_PLANTILLA = 'plantilla-inscripciones.csv';
export const NOMBRE_REPORTE = 'filas-con-error.csv';

/** Texto de la plantilla descargable: encabezado + un alumno nuevo con todos sus datos y uno que solo lleva la matrícula (ya existente). */
export function plantillaCsv() {
    return `${COLUMNAS.join(',')}\nEJEMPLO1,Ramírez,Soto,Ana María,ejemplo1@unach.test\nEJEMPLO2,,,,\n`;
}

// Una celda que empieza por = + - @ puede ejecutarse como fórmula al abrir el CSV en una hoja de cálculo: se neutraliza con una comilla.
const celdaCsv = (valor) => {
    let texto = String(valor ?? '');
    if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
    return /[",\n\r]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
};

/** Filas -> texto CSV con BOM (para que Excel respete los acentos). */
export const aCsv = (encabezados, filas) => `\uFEFF${[encabezados, ...filas].map((f) => f.map(celdaCsv).join(',')).join('\n')}\n`;

/** [5, 9, 12, 13, 14] -> «5, 9 y 12 a 14». Las rachas de 3 o más se resumen; más de 8 tramos se recortan («2, 4, 6, 8, 10, 12 y 4 más»). */
export function rangoDeFilas(lineas) {
    const orden = [...new Set(lineas)].sort((a, b) => a - b);
    const tramos = [];
    for (let i = 0; i < orden.length; ) {
        let j = i;
        while (j + 1 < orden.length && orden[j + 1] === orden[j] + 1) j += 1;
        if (j - i >= 2) tramos.push(`${orden[i]} a ${orden[j]}`);
        else for (let k = i; k <= j; k += 1) tramos.push(String(orden[k]));
        i = j + 1;
    }
    if (tramos.length > 8) return `${tramos.slice(0, 6).join(', ')} y ${tramos.length - 6} más`;
    if (tramos.length <= 1) return tramos.join('');
    return `${tramos.slice(0, -1).join(', ')} y ${tramos[tramos.length - 1]}`;
}

/** Agrupa por causa: [{ mensaje, lineas, cantidad, filas: «5, 9 y 12 a 14» }], las causas más frecuentes primero. */
export function agruparPorCausa(items) {
    const grupos = new Map();
    for (const it of items) {
        if (!grupos.has(it.mensaje)) grupos.set(it.mensaje, []);
        grupos.get(it.mensaje).push(it.linea);
    }
    return [...grupos.entries()]
        .map(([mensaje, lineas]) => ({ mensaje, lineas, cantidad: lineas.length, filas: rangoDeFilas(lineas) }))
        .sort((a, b) => b.cantidad - a.cantidad || a.mensaje.localeCompare(b.mensaje, 'es'));
}

const traeDatos = (f) => Boolean(f.apellido_paterno || f.apellido_materno || f.nombres || f.correo);

/**
 * Lo que la revisión le dice a la persona antes de escribir en la base.
 * `matriculasInscritas`: matrículas ya inscritas (activas) en el grupo; esas filas no se envían.
 * `soloMatricula`: filas que solo traen la matrícula; sirven si el alumno ya existe, y si no el servidor las rechaza (aviso, no error).
 */
export function revisarAnalisis(analisis, matriculasInscritas = []) {
    const inscritas = new Set(matriculasInscritas.map((m) => String(m).toUpperCase()));
    const filas = analisis?.filas ?? [];
    const yaInscritas = filas.filter((f) => inscritas.has(f.matricula));
    const paraEnviar = filas.filter((f) => !inscritas.has(f.matricula));
    const soloMatricula = paraEnviar.filter((f) => !traeDatos(f));
    return {
        paraEnviar,
        yaInscritas,
        soloMatricula,
        descartadas: analisis?.errores ?? [],
        gruposDescartadas: agruparPorCausa(analisis?.errores ?? []),
        avisoSoloMatricula: soloMatricula.length > 0 ? agruparPorCausa(soloMatricula.map((f) => ({ mensaje: 'Solo trae la matrícula', linea: f.linea })))[0] : null,
    };
}

/** Reporte descargable de lo que NO entró: lo descartado al leer el archivo y lo que el servidor rechazó fila por fila. */
export function reporteDeFallidos({ descartadas = [], filasServidor = [] }) {
    const filas = [
        ...descartadas.map((e) => [e.linea, e.matricula ?? '', 'Descartada al leer el archivo', e.mensaje]),
        ...filasServidor.filter((f) => f.resultado === 'error').map((f) => [f.linea, f.matricula ?? '', f.codigo ?? 'Error', f.mensaje ?? '']),
    ].sort((a, b) => a[0] - b[0]);
    return { cantidad: filas.length, texto: aCsv(['linea', 'matricula', 'causa', 'detalle'], filas) };
}
