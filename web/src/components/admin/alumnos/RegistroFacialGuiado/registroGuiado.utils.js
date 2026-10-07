import { PASOS_TOMA, TOTAL_PASOS } from '../CapturaGuiadaPlantilla/capturaGuiada.utils.js';

// Ritmo de la captura automática (ms salvo `aciertos` y `manualTrasFallos`). La foto no se toma al pulsar nada: con la cámara lista
// se muestrea un fotograma, se pasa por el control de calidad de una foto y, tras `aciertos` muestras buenas seguidas (la persona
// se mantiene quieta ~1 s, lo que además descarta fotos movidas), esa última se entrega como toma. Se puede ajustar por prop `ritmo`.
export const RITMO_AUTOMATICO = {
    esperaPrimero: 900, // antes de la primera muestra del primer paso: la cámara acaba de abrirse
    esperaPaso: 1500, // al cambiar de paso (o reintentar): tiempo para acomodarse o girar antes de muestrear
    intervalo: 600, // entre muestras; la siguiente espera a que termine la comprobación anterior
    aciertos: 2, // muestras buenas seguidas para tomar la foto
    demoraAceptada: 900, // se ve la toma aceptada antes de pasar a la siguiente
    demoraRechazo: 2600, // se lee el motivo de un rechazo antes de reintentar solo
    manualTrasFallos: 12, // intentos sin éxito (~15 s) tras los que se ofrece «Tomar foto ahora»
};

/** Siguiente paso después de `desde` que no tiene toma ni se omitió; null si ya no queda ninguno. */
export function siguientePaso(desde, tomas, omitidos) {
    const ocupados = new Set(tomas.filter((t) => t.paso != null).map((t) => t.paso));
    for (let i = desde + 1; i < TOTAL_PASOS; i += 1) {
        if (!ocupados.has(i) && !omitidos.has(i)) return i;
    }
    return null;
}

/** Estado visual de cada paso para el aro y la barra: hecho | verificando | error | actual | omitido | pendiente. */
export function estadosDePasos({ tomas, omitidos, actual }) {
    return PASOS_TOMA.map((_, i) => {
        const toma = tomas.find((t) => t.paso === i);
        if (toma) {
            if (toma.estado === 'aceptada') return 'hecho';
            if (toma.estado === 'verificando') return 'verificando';
            return 'error';
        }
        if (i === actual) return 'actual';
        if (omitidos.has(i)) return 'omitido';
        return 'pendiente';
    });
}

// Aro de marcas (como el de Face ID): 60 marcas uniformes. Las marcas RESALTADAS son siempre hacia donde la persona debe mirar:
// en «gira a la izquierda» el arco del lado izquierdo, en «gira a la derecha» el derecho, en «inclina hacia arriba» el de arriba; en
// «de frente» y «otra expresión o luz» no hay dirección y se resalta el aro completo. Los grados se miden desde arriba en sentido
// horario sobre la pantalla (la vista previa es un espejo: la izquierda de la persona es la izquierda de la pantalla).
export const NUM_MARCAS = 60;
const GRADOS_POR_MARCA = 360 / NUM_MARCAS;
const redondear = (n) => Math.round(n * 100) / 100;
export const CENTRO_FOCO = { izquierda: 270, derecha: 90, arriba: 0 };
export const SEMIANCHO_FOCO = 42; // ±42° = 15 marcas

export const MARCAS_ANILLO = Array.from({ length: NUM_MARCAS }, (_, indice) => {
    const grados = indice * GRADOS_POR_MARCA;
    const rad = (grados * Math.PI) / 180;
    const [sin, cos] = [Math.sin(rad), Math.cos(rad)];
    const punto = (radio) => [redondear(100 + sin * radio), redondear(100 - cos * radio)];
    const [x1, y1] = punto(90);
    const [x2, y2] = punto(98);
    const [x1f, y1f] = punto(85); // las marcas del foco son más largas: se distinguen sin depender del color
    return { indice, grados, x1, y1, x2, y2, x1f, y1f };
});

/** Distancia angular más corta entre dos ángulos (0..180). */
export const distanciaAngular = (a, b) => {
    const d = Math.abs(a - b) % 360;
    return d > 180 ? 360 - d : d;
};

/** ¿El paso tiene una dirección (izquierda, derecha, arriba)? Sin clave o sin dirección se resalta el aro completo. */
export const tieneDireccion = (clave) => CENTRO_FOCO[clave] !== undefined;

/** ¿La marca cae en el foco del paso? Sin dirección, todas. */
export function enFoco(marca, clave) {
    return tieneDireccion(clave) ? distanciaAngular(marca.grados, CENTRO_FOCO[clave]) <= SEMIANCHO_FOCO : true;
}

/**
 * ¿La marca ya se «llenó» con el progreso de la toma (0..1)? En un paso con dirección el arco se llena del centro hacia afuera;
 * sin dirección, el aro se llena en sentido horario desde arriba.
 */
export function marcaLlena(marca, clave, progreso) {
    if (!(progreso > 0)) return false;
    if (tieneDireccion(clave)) return distanciaAngular(marca.grados, CENTRO_FOCO[clave]) <= progreso * SEMIANCHO_FOCO;
    return marca.indice < Math.ceil(progreso * NUM_MARCAS);
}

// Clase del trazo según el estado (siempre tokens; el color nunca es la única señal: lo acompaña el texto y el largo de la marca).
export const CLASE_MARCA = {
    hecho: 'stroke-presente',
    verificando: 'stroke-link motion-safe:animate-pulse',
    error: 'stroke-ausente',
    actual: 'stroke-foreground',
    llena: 'stroke-link',
    pendiente: 'stroke-border',
    fuera: 'stroke-border opacity-60',
};

/**
 * Clase de una marca: las del foco llevan el estado del paso (actual, verificando, hecho, error…) y las demás quedan neutras.
 * `clave` null (portada, guardado, listo) = sin dirección: todo el aro lleva el estado.
 */
export function claseMarca(marca, { clave = null, estado = 'pendiente', progreso = 0 }) {
    if (!enFoco(marca, clave)) return CLASE_MARCA.fuera;
    if (estado === 'actual') return marcaLlena(marca, clave, progreso) ? CLASE_MARCA.llena : CLASE_MARCA.actual;
    return CLASE_MARCA[estado] ?? CLASE_MARCA.pendiente;
}

// Lo que dice cada rechazo, dirigido a quien se fotografía (tú) y siempre con una acción concreta.
const FRASES = {
    SIN_ROSTRO: 'No vemos tu rostro. Colócalo dentro del círculo.',
    MULTIPLES_ROSTROS: 'Se ve más de una persona. Solo debe salir tu rostro.',
    ROSTRO_PEQUENO: 'Acércate un poco más a la cámara.',
    NO_FRONTAL: 'Giraste demasiado. Gira solo un poco, sin dejar de ver la cámara.',
    POCA_LUZ: 'Hay poca luz. Busca un lugar más iluminado.',
    EXCESO_LUZ: 'Hay demasiada luz. Evita ventanas o focos detrás de ti.',
    BORROSA: 'La foto salió borrosa. Mantén quieto el dispositivo.',
    IMAGEN_INVALIDA: 'No se pudo leer la imagen. Inténtalo de nuevo.',
};

/** Frase de por qué no pasó el control de calidad de UNA foto. `clavePaso` solo afina «no frontal» en el paso de frente. */
export function motivoDeCalidad({ codigo, frase = null, clavePaso = null }) {
    if (codigo === 'NO_FRONTAL' && clavePaso === 'frente') return 'Mira de frente a la cámara, sin girar la cabeza.';
    return FRASES[codigo] ?? frase ?? 'La foto no cumple la calidad mínima.';
}

/** Frase de por qué no sirvió una toma (vacía si no hay problema o aún se verifica). */
export function motivoDeToma(toma) {
    if (!toma) return '';
    const paso = toma.paso == null ? null : PASOS_TOMA[toma.paso];
    switch (toma.estado) {
        case 'calidad':
            return motivoDeCalidad({ codigo: toma.motivoCodigo, frase: toma.motivo, clavePaso: paso?.clave });
        case 'inconsistente':
            return 'No parece la misma persona que en las tomas anteriores. Asegúrate de que sea la misma.';
        case 'ilegible':
            return FRASES.IMAGEN_INVALIDA;
        case 'duplicada':
            return 'Es casi igual a otra toma. Haz el movimiento que se indica.';
        default:
            return '';
    }
}

/**
 * Qué se ve en el visor durante un paso: espera | verificando | fallo | aceptada | rechazada.
 * La toma del paso (si existe) manda; sin toma, la cámara está buscando una foto buena (`espera`).
 * `fallo`: el servicio no pudo verificar la toma ya tomada.
 */
export function vistaDePaso({ toma, fallo = false }) {
    if (!toma) return 'espera';
    if (toma.estado === 'verificando') return fallo ? 'fallo' : 'verificando';
    return toma.estado === 'aceptada' ? 'aceptada' : 'rechazada';
}

/**
 * Texto principal y de apoyo bajo el visor. `ultimo` indica que tras esta toma se pasa a la revisión; `guia` es el motivo en vivo
 * de la última muestra rechazada y `reteniendo` que la última muestra fue buena y falta mantener la posición.
 */
export function textosDeVista({ vista, paso, toma, ultimo, detalleFallo = '', guia = null, reteniendo = false }) {
    switch (vista) {
        case 'fallo':
            return { titulo: 'No pudimos verificar la toma', detalle: detalleFallo };
        case 'verificando':
            return { titulo: 'Verificando…', detalle: 'Revisamos que la toma sea nítida y de frente.' };
        case 'aceptada':
            return { titulo: 'Toma aceptada', detalle: ultimo ? 'Listo, vamos a revisar tus tomas.' : 'Pasamos a la siguiente.' };
        case 'rechazada':
            return { titulo: 'Esta toma no sirve', detalle: motivoDeToma(toma) };
        default:
            if (reteniendo) return { titulo: paso.titulo, detalle: 'Muy bien, mantén la posición…' };
            return { titulo: paso.titulo, detalle: guia ?? paso.indicacion };
    }
}

/**
 * Elementos de la revisión. En cámara: uno por paso (con su toma, o «omitido»/«sin tomar») y las subidas a continuación;
 * en archivo: una por toma, numeradas por posición.
 */
export function elementosRevision({ tomas, omitidos, numeros, modo }) {
    const ordenar = (lista) => [...lista].sort((a, b) => numeros.get(a.id) - numeros.get(b.id));
    const sueltas = ordenar(tomas.filter((t) => modo !== 'camara' || t.paso == null)).map((toma) => ({
        clave: `toma-${toma.id}`,
        numero: numeros.get(toma.id),
        titulo: toma.nombre || `Foto ${numeros.get(toma.id)}`,
        toma,
        paso: null,
        omitido: false,
    }));
    if (modo !== 'camara') return sueltas;
    const guiadas = PASOS_TOMA.map((p, i) => ({
        clave: `paso-${i}`,
        numero: i + 1,
        titulo: p.titulo,
        toma: tomas.find((t) => t.paso === i) ?? null,
        paso: i,
        omitido: omitidos.has(i),
    }));
    return [...guiadas, ...sueltas];
}
