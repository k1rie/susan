// Textos y funciones puras del panel de plantilla facial (varias tomas por plantilla).

// El servicio devuelve motivo_codigo (estable) junto a motivo_rechazo (frase); la interfaz se indexa por código.
export const MOTIVOS_RECHAZO = {
    SIN_ROSTRO: 'No se detectó ningún rostro.',
    MULTIPLES_ROSTROS: 'Hay más de un rostro en la imagen.',
    ROSTRO_PEQUENO: 'El rostro es muy pequeño; acérquese a la cámara.',
    NO_FRONTAL: 'Mire de frente a la cámara.',
    POCA_LUZ: 'Falta iluminación.',
    EXCESO_LUZ: 'Exceso de luz o contraluz.',
    BORROSA: 'La imagen está borrosa; mantenga quieta la cámara.',
    IMAGEN_INVALIDA: 'No se pudo leer la imagen.',
    NO_COINCIDE: 'No parece la misma persona.',
    CONJUNTO_AMBIGUO: 'Las tomas no coinciden entre sí.',
    DUPLICADA: 'Es igual a otra foto del envío.',
};

// En la captura guiada el giro excesivo se le dice a quien se fotografía (tú), no al administrador.
const MOTIVOS_GUIADA = {
    NO_FRONTAL: 'Giraste demasiado; vuelve a mirar hacia la cámara.',
};

/**
 * Texto de un motivo. Se busca por código; si no es un código conocido se muestra tal cual la frase del
 * servicio (ya no se antepone «Calidad insuficiente», que dejaba frases duplicadas).
 */
export function textoMotivo(codigo, { guiada = false, frase = null } = {}) {
    if (guiada && MOTIVOS_GUIADA[codigo]) return MOTIVOS_GUIADA[codigo];
    return MOTIVOS_RECHAZO[codigo] ?? frase ?? codigo ?? '';
}

/**
 * Código estable de un resultado de calidad. Acepta el de conjunto (motivo_codigo) y el heredado, cuyo
 * motivo_rechazo era un código antes de que el servicio devolviera frases.
 */
export function codigoDeMotivo(resultado) {
    if (!resultado) return null;
    if (resultado.motivo_codigo) return resultado.motivo_codigo;
    const m = resultado.motivo_rechazo;
    return typeof m === 'string' && /^[A-Z_]+$/.test(m) ? m : null;
}

/** La foto sirve para registrar plantilla de una sola foto (camino heredado): un rostro y sin motivo de rechazo. */
export function esFotoAceptable(resultado) {
    return Boolean(resultado) && resultado.un_solo_rostro === true && (resultado.motivo_rechazo ?? null) === null;
}

/** Mensaje en español de un error del servicio al verificar o registrar. */
export function mensajeErrorPlantilla(err) {
    if (!err) return '';
    const d = err.details ?? {};
    switch (err.code) {
        case 'FOTO_RECHAZADA': {
            const codigo = d.motivo_codigo ?? d.motivo_rechazo ?? d.motivo;
            return codigo ? textoMotivo(codigo, { frase: d.motivo_rechazo ?? d.motivo }) : err.message;
        }
        case 'FOTOS_RECHAZADAS':
            return 'Algunas fotos no sirven: repite las tomas marcadas.';
        case 'FOTOS_INSUFICIENTES':
            return `Se necesitan al menos ${d.minimo ?? 3} fotos.`;
        case 'FOTOS_DUPLICADAS':
            return 'Hay fotos repetidas: usa tomas distintas.';
        case 'DEMASIADOS_ARCHIVOS':
            return 'Máximo 8 fotos.';
        case 'ARCHIVO_DEMASIADO_GRANDE':
            return 'Una foto pesa demasiado.';
        default:
            break;
    }
    if (esServicioNoDisponible(err)) return 'El servicio de reconocimiento no responde; reintente.';
    return err.message;
}

// El código antiguo RECONOCIMIENTO_NO_DISPONIBLE nunca coincidía con el de la ruta; solo funcionaba por el 503.
export const esServicioNoDisponible = (err) =>
    err?.code === 'SERVICIO_RECONOCIMIENTO_NO_DISPONIBLE' || err?.code === 'RECONOCIMIENTO_NO_DISPONIBLE' || err?.status === 503;

/** Estado del índice tras registrar: 'lista' | 'pendiente' (no se pudo reconstruir) | 'indexando'. */
export function estadoIndiceTrasRegistro(indice) {
    if (indice?.estado === 'activada' || indice?.estado === 'sin_cambios') return 'lista';
    if (indice?.estado === 'pendiente') return 'pendiente';
    return 'indexando';
}

export const SONDEO_INTERVALO_MS = 5000;
export const SONDEO_MAX_INTENTOS = 24;

// Espera antes de verificar: agrupa capturas seguidas en una sola petición (se envían todas las fotos cada vez).
export const VERIFICACION_DEBOUNCE_MS = 300;
export const MINIMO_FOTOS = 3;
export const MAXIMO_FOTOS = 8;

const minuscula = (s) => (s ? s.charAt(0).toLowerCase() + s.slice(1) : s);
const sinPunto = (s) => s.replace(/\.$/, '');

/**
 * Texto de estado de una toma (sin el número, que se calcula fuera). `numeroDe(id)` resuelve a qué toma
 * se parece una duplicada.
 */
export function textoEstadoToma(toma, numeroDe = () => null) {
    switch (toma.estado) {
        case 'verificando':
            return 'Verificando…';
        case 'aceptada':
            return 'Aceptada';
        case 'calidad':
            return textoMotivo(toma.motivoCodigo, { guiada: toma.origen === 'camara', frase: toma.motivo }) || 'La foto no cumple la calidad mínima.';
        case 'inconsistente':
            return toma.motivoCodigo === 'CONJUNTO_AMBIGUO' ? 'Las tomas no coinciden entre sí' : 'No parece la misma persona';
        case 'ilegible':
            return 'No se pudo leer la imagen';
        case 'duplicada': {
            const n = numeroDe(toma.duplicadaDeId);
            return n ? `Igual a la toma ${n}` : 'Igual a otra toma';
        }
        default:
            return '';
    }
}

/** Forma de resultado por foto que entiende CalidadFotoResumen, a partir de una toma. */
export function resultadoDeToma(toma) {
    return {
        estado: toma.estado,
        rostros: toma.rostros,
        un_solo_rostro: toma.rostros === 1,
        calidad: toma.calidad,
        motivo_codigo: toma.motivoCodigo,
        motivo_rechazo: toma.motivo,
        coseno_resto: toma.cosenoResto,
    };
}

/** Copia de las tomas con el resultado de /api/plantilla/verificar aplicado por el snapshot de ids de ESA petición. */
export function aplicarResultadoConjunto(tomas, ids, resultado) {
    const fotos = resultado?.fotos ?? [];
    return tomas.map((t) => {
        const k = ids.indexOf(t.id);
        const f = k < 0 ? null : (fotos.find((x) => x.indice === k) ?? fotos[k]);
        if (!f) return t;
        const duplicadaDe = f.duplicada_de ?? null;
        return {
            ...t,
            estado: f.estado,
            motivoCodigo: f.motivo_codigo ?? null,
            motivo: f.motivo_rechazo ?? null,
            cosenoResto: f.coseno_resto ?? null,
            calidad: f.calidad ?? null,
            rostros: f.rostros ?? null,
            duplicadaDeId: duplicadaDe === null ? null : (ids[duplicadaDe] ?? null),
        };
    });
}

/** Marca las tomas de un 422 FOTOS_RECHAZADAS o FOTOS_DUPLICADAS del registro (details.fotos / details.duplicadas). */
export function aplicarRechazoRegistro(tomas, ids, details) {
    if (!details) return tomas;
    if (Array.isArray(details.fotos)) return aplicarResultadoConjunto(tomas, ids, { fotos: details.fotos });
    if (Array.isArray(details.duplicadas)) {
        return tomas.map((t) => {
            const d = details.duplicadas.find((x) => ids[x.indice] === t.id);
            return d ? { ...t, estado: 'duplicada', motivoCodigo: 'DUPLICADA', duplicadaDeId: ids[d.de] ?? null } : t;
        });
    }
    return tomas;
}

/** Frase para el lector de pantalla con lo que cambió entre dos estados de las tomas. */
export function anuncioCambios(previas, nuevas, numeroDe) {
    const antes = new Map(previas.map((t) => [t.id, t.estado]));
    const frases = [];
    nuevas.forEach((t) => {
        if (antes.get(t.id) === t.estado || t.estado === 'verificando') return;
        const n = numeroDe(t.id);
        if (t.estado === 'aceptada') frases.push(`Toma ${n} aceptada.`);
        else frases.push(`Toma ${n} no aceptada: ${sinPunto(minuscula(textoEstadoToma(t, numeroDe)))}.`);
    });
    return frases.join(' ');
}

/** Contador visible: aceptadas, mínimo y qué falta para poder registrar. */
export function textoContador({ total, aceptadas, marcadas, minimo }) {
    if (total === 0) return `Captura al menos ${minimo} tomas.`;
    let texto = `Tomas aceptadas: ${aceptadas} de ${total} (mínimo ${minimo}).`;
    if (marcadas > 0) texto += ' Repite o quita las tomas marcadas.';
    else if (aceptadas < minimo) {
        const faltan = minimo - aceptadas;
        texto += faltan === 1 ? ' Falta 1 toma aceptada para registrar.' : ` Faltan ${faltan} tomas aceptadas para registrar.`;
    }
    return texto;
}

export const textoFotos = (n) => `${n} ${n === 1 ? 'foto' : 'fotos'}`;
