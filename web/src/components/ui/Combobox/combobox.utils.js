import { normalizarBusqueda } from '@/lib/formularios/texto.js';

/** Compara valores de opción por texto: el número 3 y "3" son la misma opción (los selects nativos devuelven texto). */
export const mismoValor = (a, b) => a !== undefined && a !== null && b !== undefined && b !== null && String(a) === String(b);

/**
 * Filtra por TODAS las palabras de la consulta (sin acentos ni mayúsculas) sobre título, descripción y grupo.
 * Orden: título que empieza con la consulta, título que la contiene, el resto; estable dentro de cada grupo.
 * Consulta vacía = todas, en su orden original.
 */
export function filtrarOpciones(opciones, consulta) {
    const q = normalizarBusqueda(consulta);
    if (!q) return opciones;
    const palabras = q.split(/\s+/);
    const puntuadas = [];
    opciones.forEach((opcion, indice) => {
        const titulo = normalizarBusqueda(opcion.label);
        const todo = `${titulo} ${normalizarBusqueda(opcion.description)} ${normalizarBusqueda(opcion.group)}`;
        if (!palabras.every((p) => todo.includes(p))) return;
        puntuadas.push({ opcion, indice, puntos: titulo.startsWith(q) ? 0 : titulo.includes(q) ? 1 : 2 });
    });
    return puntuadas.sort((a, b) => a.puntos - b.puntos || a.indice - b.indice).map((x) => x.opcion);
}

/**
 * Agrupa por `group` conservando el orden de aparición. Devuelve:
 *   grupos  -> [{ titulo: string | null, opciones: [{ opcion, indice }] }] para dibujar (indice = posición en `planas`)
 *   planas  -> las mismas opciones en el orden VISUAL, que es el de las flechas del teclado
 * Las opciones sin `group` forman un bloque sin título.
 */
export function agruparOpciones(opciones) {
    const mapa = new Map();
    for (const opcion of opciones) {
        const clave = opcion.group ?? null;
        if (!mapa.has(clave)) mapa.set(clave, []);
        mapa.get(clave).push(opcion);
    }
    const planas = [];
    const grupos = Array.from(mapa, ([titulo, lista]) => ({
        titulo,
        opciones: lista.map((opcion) => {
            planas.push(opcion);
            return { opcion, indice: planas.length - 1 };
        }),
    }));
    return { grupos, planas };
}

/** Índice de la primera opción habilitada de `planas` (o -1). */
export const primeraHabilitada = (planas) => planas.findIndex((o) => !o.disabled);

/** Siguiente opción habilitada desde `desde` en la dirección `paso` (+1 / -1), dando la vuelta. -1 si no hay ninguna. */
export function siguienteHabilitada(planas, desde, paso) {
    const n = planas.length;
    if (n === 0) return -1;
    for (let k = 1; k <= n; k += 1) {
        const i = (((desde + paso * k) % n) + n) % n;
        if (!planas[i].disabled) return i;
    }
    return -1;
}

/**
 * Dónde y de qué tamaño dibujar la lista (posición fija) para que NUNCA se salga de la pantalla:
 *   rect        -> caja del campo (getBoundingClientRect)
 *   limites     -> región visible { arriba, abajo, izquierda, derecha } (visualViewport: con el teclado abierto del teléfono
 *                  la región visible es más baja que la ventana)
 *   altoVentana -> window.innerHeight (para anclar por `bottom` cuando se abre hacia arriba)
 * Abre hacia abajo salvo que haya menos de `alturaMinima` libres y arriba quepa más. El ancho nunca pasa del visible
 * menos los márgenes, y el borde izquierdo se corre para que no se corte por la derecha.
 */
export function calcularPosicionLista({
    rect,
    limites,
    altoVentana,
    alturaDeseada = 320,
    alturaMinima = 160,
    anchoMinimo = 220,
    margen = 8,
    separacion = 4,
}) {
    const anchoDisponible = Math.max(limites.derecha - limites.izquierda - margen * 2, 0);
    const ancho = Math.min(Math.max(rect.width, anchoMinimo), anchoDisponible);
    const izquierda = Math.max(limites.izquierda + margen, Math.min(rect.left, limites.derecha - margen - ancho));
    const espacioAbajo = limites.abajo - rect.bottom - separacion - margen;
    const espacioArriba = rect.top - limites.arriba - separacion - margen;
    const arriba = espacioAbajo < Math.min(alturaDeseada, alturaMinima) && espacioArriba > espacioAbajo;
    const maxAlto = Math.max(Math.min(alturaDeseada, arriba ? espacioArriba : espacioAbajo), 80);
    return {
        izquierda,
        ancho,
        maxAlto,
        arriba,
        top: rect.bottom + separacion,
        bottom: altoVentana - rect.top + separacion,
    };
}
