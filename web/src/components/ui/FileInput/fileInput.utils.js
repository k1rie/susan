// Formato legible de tamaños para mensajes de validación.
export function formatearBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    const mb = bytes / (1024 * 1024);
    return `${Number.isInteger(mb) ? mb : mb.toFixed(1)} MB`;
}

// accept admite MIME exactos, comodines ("image/*") y extensiones (".pdf").
export function tipoPermitido(file, accept) {
    if (!accept) return true;
    const nombre = (file.name || '').toLowerCase();
    const tipo = (file.type || '').toLowerCase();
    return accept
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
        .some((a) => {
            if (a.startsWith('.')) return nombre.endsWith(a);
            if (a.endsWith('/*')) return tipo.startsWith(a.slice(0, -1));
            return tipo === a;
        });
}

// Devuelve el motivo del rechazo o null si el archivo es válido.
export function validarArchivo(file, { accept, maxBytes } = {}) {
    if (!tipoPermitido(file, accept)) return 'Tipo de archivo no permitido.';
    if (maxBytes != null && file.size > maxBytes) return `El archivo supera ${formatearBytes(maxBytes)}.`;
    return null;
}

// Nombre corto de cada tipo aceptado para escribir las reglas en texto ("PDF, JPG o PNG"). '' = no mencionar.
const NOMBRE_DE_TIPO = {
    '.pdf': 'PDF',
    'application/pdf': 'PDF',
    '.jpg': 'JPG',
    '.jpeg': 'JPG',
    'image/jpeg': 'JPG',
    '.png': 'PNG',
    'image/png': 'PNG',
    '.webp': 'WEBP',
    'image/webp': 'WEBP',
    '.csv': 'CSV',
    'text/csv': 'CSV',
    // Muchos sistemas entregan el CSV como text/plain: se acepta, pero no se anuncia como otro formato.
    'text/plain': '',
    'image/*': 'imagen',
};

function nombreDeTipo(token) {
    if (token in NOMBRE_DE_TIPO) return NOMBRE_DE_TIPO[token];
    if (token.startsWith('.')) return token.slice(1).toUpperCase();
    const subtipo = token.split('/')[1];
    return subtipo && subtipo !== '*' ? subtipo.toUpperCase() : '';
}

/** Lista legible: ['PDF'] -> "PDF"; ['PDF', 'JPG'] -> "PDF o JPG"; ['PDF', 'JPG', 'PNG'] -> "PDF, JPG o PNG". */
export function unirTipos(nombres) {
    if (nombres.length <= 1) return nombres.join('');
    return `${nombres.slice(0, -1).join(', ')} o ${nombres[nombres.length - 1]}`;
}

/**
 * Reglas visibles ANTES de elegir, a partir de las mismas props que validan: "PDF, JPG o PNG. Máximo 5 MB."
 * Con `maxFiles` (modo múltiple) agrega "Hasta 5 archivos.". Devuelve '' si no hay ninguna regla.
 */
export function describirReglas({ accept, maxBytes, maxFiles } = {}) {
    const tipos = [];
    for (const token of String(accept ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {
        const nombre = nombreDeTipo(token);
        if (nombre && !tipos.includes(nombre)) tipos.push(nombre);
    }
    const partes = [];
    if (tipos.length) partes.push(`${unirTipos(tipos)}.`);
    if (maxBytes != null) partes.push(`Máximo ${formatearBytes(maxBytes)}.`);
    if (maxFiles != null) partes.push(`Hasta ${maxFiles} archivos.`);
    return partes.join(' ');
}

/** true si el archivo es una imagen (por su tipo MIME). */
export const esImagen = (file) => String(file?.type ?? '').toLowerCase().startsWith('image/');

/** Clave estable de un archivo para React y para descartar repetidos (el navegador no da un id). */
export const claveArchivo = (file) => `${file.name}|${file.size}|${file.lastModified ?? 0}`;

/**
 * Valida lo que la persona eligió o soltó. Función pura:
 *   candidatos -> File[] nuevos         actuales -> File[] ya elegidos (solo en `multiple`)
 * Devuelve { aceptados, errores }. En modo sencillo solo se considera el primer archivo y el mensaje de error es el
 * del propio motivo ("Tipo de archivo no permitido."); en múltiple cada error lleva el nombre del archivo.
 */
export function procesarSeleccion(candidatos, { accept, maxBytes, multiple = false, maxFiles, actuales = [] } = {}) {
    const lista = multiple ? candidatos : candidatos.slice(0, 1);
    const cupo = multiple ? (maxFiles ?? Infinity) - actuales.length : 1;
    const conocidos = new Set(actuales.map(claveArchivo));
    const aceptados = [];
    const errores = [];
    let excedidos = 0;
    for (const file of lista) {
        const motivo = validarArchivo(file, { accept, maxBytes });
        if (motivo) {
            errores.push(multiple ? `${file.name}: ${motivo}` : motivo);
            continue;
        }
        const clave = claveArchivo(file);
        if (conocidos.has(clave)) continue; // el mismo archivo dos veces no se agrega
        if (aceptados.length >= cupo) {
            excedidos += 1;
            continue;
        }
        conocidos.add(clave);
        aceptados.push(file);
    }
    if (excedidos > 0) errores.push(`Solo se admiten ${maxFiles} archivos: sobraron ${excedidos}.`);
    return { aceptados, errores };
}
