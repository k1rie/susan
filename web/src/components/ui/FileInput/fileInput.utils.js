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
