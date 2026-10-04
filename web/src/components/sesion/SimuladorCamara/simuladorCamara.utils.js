// Funciones puras del simulador de cámara (SOLO desarrollo local con el reloj de demostración): qué rostros aparecen en cada ciclo,
// cómo se reparten en el fotograma y cómo se pintan. Sin DOM propio (el contexto 2D llega por parámetro) ni Math.random/Date.now: el
// mismo ciclo, escenario y lista de alumnos dan siempre el mismo fotograma, que es lo que permite repetir una demostración y probarla.
//
// Por qué existe: el servicio de reconocimiento corre con EMBEDDER=fake, que no reconoce caras reales sino cuadrados con marco magenta
// (ver lib/demo/rostro.js y lib/demo/semillas.js). Una cámara web real nunca los produce, así que sin esto el pase automático no se
// puede probar en local.
import { cssRgb, posicionesDeRostros, rectangulosDeRostro } from '@/lib/demo/rostro.js';
import { semillaDeAlumno, semillaDeExtrano, SEMILLAS_ALUMNO, SEMILLAS_EXTRANO } from '@/lib/demo/semillas.js';
import { LECTURAS_REQUERIDAS } from '../MonitorSesion/monitorSesion.utils.js';

// ---- Fotograma -----------------------------------------------------------------------------------------------------------------------
export const ANCHO_FOTOGRAMA = 960;
export const ALTO_FOTOGRAMA = 540;
/** Calidad JPEG del fotograma: alta, porque el detector lee el color plano del interior de cada rostro. */
export const CALIDAD_JPEG = 0.92;

// Lados probados de mayor a menor: se usa el más grande en el que caben todos (el detector exige >= 24 px; con 40 el interior de 32 px
// resiste la compresión JPEG). Cada celda reserva ALTO_ROTULO bajo el cuadrado para las iniciales (el rótulo nunca toca el marco); en un teléfono el lienzo se ve a ~37 % de su tamaño, por eso la letra es grande.
const LADOS = [96, 88, 80, 72, 64, 56, 48, 40];
export const ALTO_ROTULO = 22;
const TAMANO_LETRA = 15;
const SEPARACION = 16;
// Color de los rótulos: un gris casi blanco, lejos del magenta del marco (R > 180, G < 80, B > 180) que busca el detector.
const COLOR_ROTULO = [236, 236, 236];

// ---- Escenarios ----------------------------------------------------------------------------------------------------------------------
export const ESCENARIOS = [
    { id: 'a_tiempo', etiqueta: 'Todos llegan a tiempo' },
    { id: 'escalonados', etiqueta: 'Llegan escalonados' },
    { id: 'dudosos', etiqueta: 'Casos dudosos' },
];
export const ESCENARIO_POR_OMISION = 'a_tiempo';
export const escenarioValido = (id) => ESCENARIOS.some((e) => e.id === id);

/** Opciones de «Detener después de»: 0 = sin límite. */
export const OPCIONES_CICLOS = [3, 5, 8, 12, 0];
export const CICLOS_POR_OMISION = 5;

/** Minutos que el simulador adelanta el reloj de demostración ANTES de cada ciclo (menos el primero), por escenario. */
export const SALTO_RELOJ_MIN = { a_tiempo: 0, escalonados: 4, dudosos: 0 };
/** Minuto de la clase en el que arranca la demostración si se pide ajustar el reloj: dentro del tramo de «Presente». */
export const MINUTO_DE_INICIO_DEMO = 2;

/**
 * Ritmo de muestreo del cliente con la cámara simulada. El servidor deja pasar UNA captura por cámara cada intervalo/2 como mínimo
 * (lib/server/rateLimit.js: 7,5 s con el intervalo de 15 s), y mide con el reloj REAL del servidor, no con el simulado. Por eso 5 s
 * no sirve (cada segunda captura recibiría 429): el mínimo seguro es intervalo/2 más 1 s de holgura para la latencia (9 s con 15 s).
 * @param {number} intervaloSesionSeg intervalo_muestreo_seg de la sesión
 */
export function intervaloDemoSeg(intervaloSesionSeg) {
    const base = Number(intervaloSesionSeg);
    const intervalo = Number.isFinite(base) && base > 0 ? base : 15;
    return Math.max(2, Math.ceil(intervalo / 2) + 1);
}

// ---- Quién está en el aula -----------------------------------------------------------------------------------------------------------
/**
 * Alumnos que «están en el aula»: inscritos activos con un id que tenga semilla de demostración, por id (así el reparto no depende del
 * orden en que el monitor los entregue).
 * @param {{ id_alumno: number, nombre?: string, inscripcion?: string }[]} alumnos `alumnos` de api_sesion_monitor
 * @returns {{ id_alumno: number, nombre: string }[]}
 */
export function participantesDelAula(alumnos) {
    return (Array.isArray(alumnos) ? alumnos : [])
        .filter((a) => (!a.inscripcion || a.inscripcion === 'activa') && Number.isInteger(a.id_alumno) && a.id_alumno >= 1 && a.id_alumno <= SEMILLAS_ALUMNO)
        .map((a) => ({ id_alumno: a.id_alumno, nombre: String(a.nombre ?? '') }))
        .sort((x, y) => x.id_alumno - y.id_alumno);
}

/** «Ana Pérez López» -> «AP»: iniciales de las dos primeras palabras (el rótulo debe caber bajo un cuadrado de 40 px). */
export function iniciales(nombre) {
    const letras = String(nombre ?? '')
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((palabra) => [...palabra][0].toUpperCase());
    return letras.join('') || '?';
}

// Índices de los alumnos que en «Casos dudosos» aparecen solo 1 ciclo (1 lectura) o solo 2 (2 lecturas): ambos se quedan por debajo de
// las 3 lecturas que confirman y, al cerrar, pasan a pendientes de revisión. Cada seis alumnos hay uno de cada tipo; con grupos muy
// chicos se fuerza al menos uno de cada para que el escenario siempre muestre algo.
function indicesDudosos(total) {
    const una = new Set();
    const dos = new Set();
    for (let i = 0; i < total; i += 1) {
        if (i % 6 === 3) una.add(i);
        if (i % 6 === 5) dos.add(i);
    }
    if (una.size === 0 && total >= 2) una.add(total - 1);
    if (dos.size === 0 && total >= 3) dos.add(una.has(total - 1) ? total - 2 : total - 1);
    return { una, dos };
}

/**
 * En qué ciclos aparece el alumno número `indice` (de `total`): { llega, sale }, `sale = null` si ya no se va. Aparece en los ciclos
 * llega <= ciclo < sale.
 *   a_tiempo     todos desde el ciclo 0
 *   escalonados  un tercio por ciclo: tanda 0 en el ciclo 0, tanda 1 en el 1 y tanda 2 en el 2 (indice % 3)
 *   dudosos      casi todos desde el 0; algunos solo en 1 o 2 ciclos
 */
export function rolDeAlumno(escenario, indice, total) {
    if (escenario === 'escalonados') return { llega: indice % 3, sale: null };
    if (escenario === 'dudosos') {
        const { una, dos } = indicesDudosos(total);
        if (una.has(indice)) return { llega: 0, sale: 1 };
        if (dos.has(indice)) return { llega: 0, sale: 2 };
    }
    return { llega: 0, sale: null };
}

/** Un visitante (rostro ajeno al grupo) pasa por la cámara cada tres ciclos, empezando por el segundo: 1, 4, 7… */
export const hayVisitanteEnCiclo = (ciclo) => ciclo % 3 === 1;

/**
 * Qué rostros ve la cámara en un ciclo.
 * @param {{ escenario: string, ciclo: number, alumnos: object[], visitante?: boolean }} p `alumnos` = del monitor; `visitante` incluye al ajeno
 * @returns {{ ciclo: number, rostros: { tipo: 'alumno' | 'visitante', id_alumno?: number, semilla: number, etiqueta: string }[],
 *            alumnos: number, visitantes: number }}
 */
export function planDeCiclo({ escenario, ciclo, alumnos, visitante = true }) {
    const gente = participantesDelAula(alumnos);
    const rostros = [];
    gente.forEach((a, i) => {
        const { llega, sale } = rolDeAlumno(escenario, i, gente.length);
        if (ciclo >= llega && (sale == null || ciclo < sale)) {
            rostros.push({ tipo: 'alumno', id_alumno: a.id_alumno, semilla: semillaDeAlumno(a.id_alumno), etiqueta: iniciales(a.nombre) });
        }
    });
    const alumnosVistos = rostros.length;
    if (visitante && hayVisitanteEnCiclo(ciclo)) {
        rostros.push({ tipo: 'visitante', semilla: semillaDeExtrano(ciclo % SEMILLAS_EXTRANO), etiqueta: 'Visita' });
    }
    return { ciclo, rostros, alumnos: alumnosVistos, visitantes: rostros.length - alumnosVistos };
}

/** Qué se espera al terminar, contando solo alumnos y suponiendo que el reloj arranca en el minuto 2 (ver textoEsperado). */
export function conteosEsperados(escenario, total) {
    if (total <= 0) return { presentes: 0, retardos: 0, pendientes: 0 };
    if (escenario === 'dudosos') {
        const { una, dos } = indicesDudosos(total);
        const pendientes = una.size + dos.size;
        return { presentes: total - pendientes, retardos: 0, pendientes };
    }
    if (escenario === 'escalonados') {
        // La tanda 2 llega cuando el reloj ya pasó el límite de Presente (ver SALTO_RELOJ_MIN): entra como retardo.
        let retardos = 0;
        for (let i = 0; i < total; i += 1) if (i % 3 === 2) retardos += 1;
        return { presentes: total - retardos, retardos, pendientes: 0 };
    }
    return { presentes: total, retardos: 0, pendientes: 0 };
}

const aMultiploDeCinco = (segundos) => Math.ceil(segundos / 5) * 5;

/**
 * Frase en lenguaje llano de lo que se espera ver con este escenario y este ritmo de muestreo.
 * @param {{ escenario: string, intervaloSeg: number, total: number, visitante?: boolean, reloj?: boolean }} p
 *   `total` = alumnos en el aula · `reloj` = el simulador arranca el reloj en el minuto 2 (si no, el estado depende de la hora que marque)
 */
export function textoEsperado({ escenario, intervaloSeg, total, visitante = true, reloj = true }) {
    // 3 lecturas = 3 capturas: la primera sale de inmediato y las otras dos tras un intervalo cada una (+ ~2 s de reconocimiento).
    const hasta = (capturas) => aMultiploDeCinco((capturas - 1) * intervaloSeg + 2);
    const confirma = hasta(LECTURAS_REQUERIDAS);
    const c = conteosEsperados(escenario, total);
    const partes = [];
    if (escenario === 'escalonados') {
        partes.push(
            `Llegan en tres tandas, una por ciclo. En unos ${confirma} s la primera tanda pasa a Presente y en unos ${hasta(LECTURAS_REQUERIDAS + 2)} s ya están todos.`,
            reloj
                ? `Las dos primeras quedan en Presente y la tercera en Retardo: el simulador adelanta el reloj ${SALTO_RELOJ_MIN.escalonados} min antes de cada ciclo.`
                : 'Presente o Retardo depende de la hora que marque el reloj cuando cada tanda se ve por primera vez.',
        );
    } else if (escenario === 'dudosos') {
        partes.push(
            `En unos ${confirma} s la mayoría pasa a Presente.`,
            'Algunos alumnos aparecen solo en 1 o 2 ciclos: se quedan sin confirmar (menos de 3 lecturas) y, al cerrar la sesión, pasan a Pendientes de revisión.',
        );
    } else {
        partes.push(
            reloj
                ? `En unos ${confirma} s todos los alumnos pasan a Presente: el servidor pide ${LECTURAS_REQUERIDAS} lecturas válidas y llega una cada ${intervaloSeg} s.`
                : `En unos ${confirma} s todos los alumnos quedan confirmados (${LECTURAS_REQUERIDAS} lecturas, una cada ${intervaloSeg} s), como Presente o Retardo según la hora del reloj.`,
        );
    }
    if (visitante) partes.push('Cada tres ciclos pasa un visitante: sube el total de rostros, pero no cuenta para nadie.');
    if (reloj && total > 0) {
        const lista = [
            c.presentes > 0 && `${c.presentes} Presentes`,
            c.retardos > 0 && `${c.retardos} Retardos`,
            c.pendientes > 0 && `${c.pendientes} Pendientes de revisión al cerrar`,
        ].filter(Boolean);
        partes.push(`Resultado esperado con ${total} alumnos: ${lista.join(' · ')}.`);
    }
    return partes.join(' ');
}

/** Texto alternativo del fotograma que se ve en el panel. */
export function descripcionDelFotograma(plan) {
    const { ciclo, alumnos, visitantes } = plan;
    const visita = visitantes > 0 ? ` y ${visitantes === 1 ? 'un visitante' : `${visitantes} visitantes`}` : '';
    return `Vista previa de la cámara simulada, ciclo ${ciclo + 1}: ${alumnos} ${alumnos === 1 ? 'alumno' : 'alumnos'}${visita}. Cada rostro es un cuadrado de color con marco magenta y las iniciales debajo.`;
}

// ---- Reloj ---------------------------------------------------------------------------------------------------------------------------
/**
 * Minuto de la clase en el instante `ahoraIso` (ISO de api/_local/reloj): puede ser negativo (antes de empezar). null si no se puede
 * calcular. La sede está en -06 todo el año (ver lib/local/reloj.js).
 */
export function minutoDeClase(ahoraIso, sesion) {
    const ahora = Date.parse(ahoraIso);
    const inicio = Date.parse(`${String(sesion?.fecha ?? '').slice(0, 10)}T${String(sesion?.hora_inicio ?? '').slice(0, 8)}-06:00`);
    if (!Number.isFinite(ahora) || !Number.isFinite(inicio)) return null;
    return (ahora - inicio) / 60000;
}

const dos = (n) => String(n).padStart(2, '0');

/** 'AAAA-MM-DD HH:MM' (hora de la sede, el formato de `fijar` del reloj) del minuto `minutos` de la clase. null si faltan datos. */
export function horaDeClase(sesion, minutos) {
    const m = /^(\d{1,2}):(\d{2})/.exec(String(sesion?.hora_inicio ?? ''));
    if (!m || !sesion?.fecha) return null;
    const total = Math.min(23 * 60 + 59, Number(m[1]) * 60 + Number(m[2]) + minutos);
    return `${String(sesion.fecha).slice(0, 10)} ${dos(Math.floor(total / 60))}:${dos(total % 60)}`;
}

/**
 * ¿Hay que mover el reloj al minuto 2 antes de empezar? «Escalonados» siempre (los saltos de reloj suponen ese punto de partida); los
 * demás solo si ya no queda margen para que las primeras lecturas cuenten como Presente, o si la clase aún no empieza.
 */
export function debeAjustarReloj({ escenario, minuto, limitePresenteMin }) {
    if (escenario === 'escalonados') return true;
    if (!Number.isFinite(minuto)) return false;
    const limite = Number.isFinite(Number(limitePresenteMin)) ? Number(limitePresenteMin) : 10;
    return minuto < 0 || minuto > limite - 3;
}

// ---- Dibujo --------------------------------------------------------------------------------------------------------------------------
/**
 * Reparto de `cantidad` rostros en el fotograma sin que se toquen. Si no caben ni con el lado menor, se dibujan los que quepan
 * (`omitidos` dice cuántos se quedaron fuera).
 * @returns {{ lado: number, rostros: { x: number, y: number }[], omitidos: number }} esquinas superiores izquierdas de CADA CUADRADO
 */
export function disposicionDeRostros(cantidad, ancho = ANCHO_FOTOGRAMA, alto = ALTO_FOTOGRAMA) {
    if (cantidad <= 0) return { lado: LADOS[0], rostros: [], omitidos: 0 };
    let lado = LADOS[0];
    let capacidad = 0;
    for (const candidato of LADOS) {
        lado = candidato;
        const celda = lado + ALTO_ROTULO + SEPARACION;
        capacidad = Math.floor((ancho - SEPARACION) / celda) * Math.floor((alto - SEPARACION) / celda);
        if (capacidad >= cantidad) break;
    }
    const caben = Math.min(cantidad, Math.max(capacidad, 0));
    const celdas = posicionesDeRostros(caben, ancho, alto, lado + ALTO_ROTULO, SEPARACION);
    // La celda es cuadrada (lado + rótulo): el cuadrado va centrado en ella y arriba, para dejar el rótulo debajo.
    const sangria = Math.floor(ALTO_ROTULO / 2);
    return { lado, rostros: celdas.map((p) => ({ x: p.x + sangria, y: p.y })), omitidos: cantidad - caben };
}

/** Rellena `datos` (RGBA) con gris suave y ruido reproducible: la misma `semilla` da el mismo ruido. Sin Math.random. */
export function rellenarRuido(datos, semilla) {
    let x = (Math.imul(semilla + 1, 2654435761) + 12345) >>> 0;
    for (let i = 0; i < datos.length; i += 4) {
        x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
        const v = 122 + ((x >>> 24) % 13); // 128 ± 6, como las imágenes de prueba del servicio
        datos[i] = v;
        datos[i + 1] = v;
        datos[i + 2] = v;
        datos[i + 3] = 255;
    }
    return datos;
}

/**
 * Pinta un fotograma completo en un contexto 2D: fondo gris con ruido, y por cada rostro el cuadrado magenta, su interior con el color
 * de la semilla (el mismo que en el registro del alumno) y las iniciales DEBAJO. Los rótulos nunca se dibujan sobre el marco.
 * @param {CanvasRenderingContext2D} ctx
 * @param {ReturnType<typeof planDeCiclo>} plan
 * @returns {{ dibujados: number, omitidos: number, lado: number }}
 */
export function dibujarFotograma(ctx, plan, { ancho = ANCHO_FOTOGRAMA, alto = ALTO_FOTOGRAMA } = {}) {
    const fondo = ctx.createImageData(ancho, alto);
    rellenarRuido(fondo.data, plan.ciclo);
    ctx.putImageData(fondo, 0, 0);

    const { lado, rostros: sitios, omitidos } = disposicionDeRostros(plan.rostros.length, ancho, alto);
    ctx.font = `600 ${TAMANO_LETRA}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    sitios.forEach((sitio, i) => {
        const rostro = plan.rostros[i];
        const { marco, interior } = rectangulosDeRostro(rostro.semilla, { x: sitio.x, y: sitio.y, lado });
        ctx.fillStyle = cssRgb(marco.rgb);
        ctx.fillRect(marco.x, marco.y, marco.ancho, marco.alto);
        ctx.fillStyle = cssRgb(interior.rgb);
        ctx.fillRect(interior.x, interior.y, interior.ancho, interior.alto);
        ctx.fillStyle = cssRgb(COLOR_ROTULO);
        // Línea de base a 5 px del fondo de la celda: la letra (15 px) queda entera bajo el cuadrado.
        ctx.fillText(rostro.etiqueta, sitio.x + lado / 2, sitio.y + lado + ALTO_ROTULO - 5);
    });
    return { dibujados: sitios.length, omitidos, lado };
}
