// Límites de la subida de archivos. El origen puede pesar hasta 15 MB porque se re-codifica antes de enviarse:
// el proxy de Next trunca en silencio los cuerpos de más de 10 MB y el tope de la ruta es 9 MiB en total.
export const MAX_ORIGEN_BYTES = 15 * 1024 * 1024;
const LADO_LARGO = 1280;
const LADO_CORTO = 960;
const CALIDAD_JPEG = 0.9;

const nombreDe = (archivo) => archivo?.name || 'la foto';

/** Motivo por el que un archivo no sirve (o null). Solo JPEG: es lo que aceptan la ruta y el servicio. */
export function validarArchivoFoto(archivo) {
    const esJpeg = archivo.type ? archivo.type === 'image/jpeg' : /\.jpe?g$/i.test(archivo.name ?? '');
    if (!esJpeg) return `«${nombreDe(archivo)}» no es JPG.`;
    if (archivo.size > MAX_ORIGEN_BYTES) return `«${nombreDe(archivo)}» pesa más de 15 MB.`;
    return null;
}

/** Tamaño de salida: cabe en 1280x960 (960x1280 si es vertical) y nunca se amplía. */
export function dimensionesNormalizadas(ancho, alto) {
    const [maxAncho, maxAlto] = alto > ancho ? [LADO_CORTO, LADO_LARGO] : [LADO_LARGO, LADO_CORTO];
    const escala = Math.min(1, maxAncho / ancho, maxAlto / alto);
    return { ancho: Math.max(1, Math.round(ancho * escala)), alto: Math.max(1, Math.round(alto * escala)) };
}

// Decodifica respetando la orientación EXIF; si createImageBitmap no existe o falla se recurre a <img>,
// que en los navegadores actuales también la aplica.
async function decodificar(archivo) {
    if (typeof createImageBitmap === 'function') {
        try {
            const bitmap = await createImageBitmap(archivo, { imageOrientation: 'from-image' });
            return { fuente: bitmap, ancho: bitmap.width, alto: bitmap.height, liberar: () => bitmap.close?.() };
        } catch {
            // Se prueba con <img>.
        }
    }
    const url = URL.createObjectURL(archivo);
    try {
        const img = new Image();
        img.src = url;
        await img.decode();
        return { fuente: img, ancho: img.naturalWidth, alto: img.naturalHeight, liberar: () => {} };
    } finally {
        URL.revokeObjectURL(url);
    }
}

/**
 * Re-codifica la foto a JPEG (calidad 0.9, <= 1280x960). Re-escribirla en el navegador además elimina el EXIF
 * (GPS incluido) antes de salir del equipo. Si algo falla lanza: el llamador RECHAZA la foto y nunca sube el original.
 */
export async function normalizarFoto(archivo) {
    const origen = await decodificar(archivo);
    try {
        if (!origen.ancho || !origen.alto) throw new Error('Imagen sin dimensiones.');
        const { ancho, alto } = dimensionesNormalizadas(origen.ancho, origen.alto);
        const lienzo = document.createElement('canvas');
        lienzo.width = ancho;
        lienzo.height = alto;
        const ctx = lienzo.getContext('2d');
        if (!ctx) throw new Error('Sin contexto de dibujo.');
        ctx.drawImage(origen.fuente, 0, 0, ancho, alto);
        const blob = await new Promise((resolve, reject) => {
            lienzo.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo generar la imagen.'))), 'image/jpeg', CALIDAD_JPEG);
        });
        return blob;
    } finally {
        origen.liberar();
    }
}

/** Ranuras de la rejilla en modo archivo: una por toma, numeradas por posición (sin ranuras vacías). */
export function ranurasLista(tomasOrdenadas, titulos = {}) {
    return tomasOrdenadas.map((t, i) => ({
        clave: `toma-${t.id}`,
        numero: i + 1,
        titulo: titulos[t.id] ?? (t.nombre || `Foto ${i + 1}`),
        toma: t,
        destacada: false,
        accion: 'quitar',
    }));
}

export const textoCupo = (caben, maximo) =>
    caben === 1 ? `Solo cabe 1 foto más (máximo ${maximo}).` : `Solo caben ${caben} fotos más (máximo ${maximo}).`;
