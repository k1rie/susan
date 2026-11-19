import { normalizarBusqueda } from '@/lib/formularios/texto.js';

// Utilidades puras del pase de lista manual (P-04).

/** Estados que el docente puede asignar a mano (los demás, como `pendiente`, son de la captura automática). */
export const ESTADOS_EDITABLES = ['presente', 'retardo', 'ausente'];

const ETIQUETA_ESTADO = { presente: 'Presente', retardo: 'Retardo', ausente: 'Ausente' };

/** Avance del pase: cuántos alumnos activos ya tienen estado marcado. `marcas` = { [id_alumno]: estado }. */
export function conteoMarcas(activos, marcas) {
    const lista = Array.isArray(activos) ? activos : [];
    const marcados = lista.filter((a) => marcas?.[a.id_alumno]).length;
    return { marcados, total: lista.length, ancho: lista.length ? (marcados / lista.length) * 100 : 0 };
}

/** Marcas de partida: lo que el servidor ya tiene guardado (solo los estados editables a mano). */
export function marcasIniciales(activos) {
    const lista = Array.isArray(activos) ? activos : [];
    return Object.fromEntries(lista.filter((a) => ESTADOS_EDITABLES.includes(a.estado)).map((a) => [a.id_alumno, a.estado]));
}

/** Cuántos alumnos activos hay por estado y cuántos siguen sin marcar. */
export function conteoPorEstado(activos, marcas) {
    const cuenta = { presente: 0, retardo: 0, ausente: 0, sinMarcar: 0 };
    for (const a of Array.isArray(activos) ? activos : []) {
        const estado = marcas?.[a.id_alumno];
        if (ESTADOS_EDITABLES.includes(estado)) cuenta[estado] += 1;
        else cuenta.sinMarcar += 1;
    }
    return cuenta;
}

/** Alumnos cuya marca difiere de la guardada (una marca vacía y una ausente cuentan igual: «sin marcar»). */
export function contarCambios(marcas, guardadas) {
    const ids = new Set([...Object.keys(marcas ?? {}), ...Object.keys(guardadas ?? {})]);
    let cambios = 0;
    for (const id of ids) if ((marcas?.[id] || '') !== (guardadas?.[id] || '')) cambios += 1;
    return cambios;
}

/**
 * Da `estado` a quienes aún no tienen marca; no pisa lo que ya se marcó (así «Todos presentes» no borra los ausentes
 * que se marcaron antes). Devuelve las marcas nuevas y a cuántos alcanzó.
 */
export function completarRestantes(activos, marcas, estado) {
    const nuevas = { ...marcas };
    let afectados = 0;
    for (const a of Array.isArray(activos) ? activos : []) {
        if (!nuevas[a.id_alumno]) {
            nuevas[a.id_alumno] = estado;
            afectados += 1;
        }
    }
    return { marcas: nuevas, afectados };
}

/** Frase corta del resultado de una acción en bloque: «Se marcó a 12 alumnos como Presente.» */
export function textoMarcado(afectados, estado) {
    const quien = afectados === 1 ? 'a 1 alumno' : `a ${afectados} alumnos`;
    return `Se marcó ${quien} como ${ETIQUETA_ESTADO[estado] ?? estado}.`;
}

/** Filtra por nombre o matrícula (todas las palabras, sin acentos ni mayúsculas). Sin texto devuelve la lista completa. */
export function filtrarAlumnos(activos, texto) {
    const lista = Array.isArray(activos) ? activos : [];
    const palabras = normalizarBusqueda(texto).split(/\s+/).filter(Boolean);
    if (!palabras.length) return lista;
    return lista.filter((a) => {
        const pajar = normalizarBusqueda(`${a.nombre ?? ''} ${a.matricula ?? ''}`);
        return palabras.every((p) => pajar.includes(p));
    });
}

/** Primer alumno sin marca, en el orden de la lista (null si todos están marcados). */
export function primeroSinMarcar(activos, marcas) {
    return (Array.isArray(activos) ? activos : []).find((a) => !marcas?.[a.id_alumno]) ?? null;
}

/** Registros que recibe `api_pase_lista_manual`: solo los alumnos con estado. */
export function registrosDeMarcas(marcas) {
    return Object.entries(marcas ?? {})
        .filter(([, estado]) => estado)
        .map(([id, estado]) => ({ id_alumno: Number(id), estado }));
}
