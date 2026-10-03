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
