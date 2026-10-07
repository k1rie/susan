// Presentación y validación de conveniencia de los parámetros del sistema (la validación definitiva es del servidor:
// `app.validar_parametro` en supabase/migrations/0040_parametros.sql).

export const AVISOS_CRITICOS = {
    umbral_similitud: 'Aplica a las capturas siguientes; las detecciones ya registradas conservan su validez.',
    min_detecciones_validas: 'Aplica a las capturas siguientes; las detecciones ya registradas conservan su validez.',
    intervalo_muestreo_seg: 'Solo afecta a las sesiones que se programen después de este cambio.',
    dimension_vector: 'Cambiar la dimensión exige cambiar el modelo y reconstruir el índice completo.',
};

export function esCritico(clave) {
    return Object.hasOwn(AVISOS_CRITICOS, clave);
}

// Nombre legible y valor de fábrica de cada parámetro. La API solo entrega la clave técnica, el rango y una descripción con referencias
// al documento de requisitos; el nombre amigable y el valor inicial son de PRESENTACIÓN. Los valores de fábrica son los de la carga
// inicial (0040_parametros.sql, `INSERT INTO parametro_sistema`); si la API algún día devuelve `valor_defecto`, ese manda (ver valorDeFabrica).
export const META_PARAMETROS = {
    umbral_similitud: { nombre: 'Umbral de similitud', defecto: '0.850' },
    min_detecciones_validas: { nombre: 'Lecturas para confirmar asistencia', defecto: '3' },
    limite_presente_min: { nombre: 'Límite para marcar presente', defecto: '10' },
    tolerancia_min: { nombre: 'Tolerancia de retardo', defecto: '20' },
    intervalo_muestreo_seg: { nombre: 'Intervalo entre capturas', defecto: '15' },
    horas_limite_correccion: { nombre: 'Plazo de corrección del docente', defecto: '48' },
    retardos_por_ausencia: { nombre: 'Retardos que equivalen a una falta', defecto: '3' },
    porcentaje_max_ausencias: { nombre: 'Faltas máximas permitidas', defecto: '20' },
    dias_retencion_recortes: { nombre: 'Retención de recortes de rostro', defecto: '7' },
    vigencia_url_firmada_seg: { nombre: 'Vigencia de enlaces a archivos', defecto: '300' },
    dimension_vector: { nombre: 'Dimensión del vector facial', defecto: '512' },
    minutos_pase_lista_base: { nombre: 'Pase de lista tradicional (referencia)', defecto: '5' },
};

/** Nombre amigable del parámetro; sin entrada conocida se muestra la clave técnica. */
export function nombreParametro(clave) {
    return META_PARAMETROS[clave]?.nombre ?? clave;
}

/** Valor de fábrica (texto) o null si no se conoce. */
export function valorDeFabrica(parametro) {
    return parametro?.valor_defecto ?? META_PARAMETROS[parametro?.clave]?.defecto ?? null;
}

// Secciones de la lista: 12 tarjetas seguidas cansan; agrupadas por lo que controlan se encuentran sin leer todas.
export const GRUPOS_PARAMETROS = [
    {
        id: 'reconocimiento',
        titulo: 'Reconocimiento facial',
        descripcion: 'Qué tan estricto es el sistema al identificar a un alumno y cada cuánto lo intenta.',
        claves: ['umbral_similitud', 'min_detecciones_validas', 'intervalo_muestreo_seg', 'dimension_vector'],
    },
    {
        id: 'ventanas',
        titulo: 'Ventanas de asistencia',
        descripcion: 'Cuánto tarda un alumno en pasar de presente a retardo.',
        claves: ['limite_presente_min', 'tolerancia_min', 'minutos_pase_lista_base'],
    },
    {
        id: 'reglas',
        titulo: 'Reglas del curso',
        descripcion: 'Cuándo se acumulan faltas y hasta cuándo se pueden corregir.',
        claves: ['retardos_por_ausencia', 'porcentaje_max_ausencias', 'horas_limite_correccion'],
    },
    {
        id: 'privacidad',
        titulo: 'Privacidad y almacenamiento',
        descripcion: 'Cuánto se conservan los recortes de rostro y los enlaces a archivos.',
        claves: ['dias_retencion_recortes', 'vigencia_url_firmada_seg'],
    },
];

/**
 * Reparte los parámetros en las secciones de GRUPOS_PARAMETROS conservando el orden de la API; lo que no pertenezca a ninguna
 * (un parámetro nuevo) va a «Otros parámetros» para que nunca desaparezca de la pantalla. Las secciones vacías se omiten.
 */
export function agruparParametros(items = []) {
    const lista = items || [];
    const conocidas = new Set(GRUPOS_PARAMETROS.flatMap((g) => g.claves));
    const grupos = GRUPOS_PARAMETROS.map((g) => ({ ...g, items: lista.filter((p) => g.claves.includes(p.clave)) }));
    const otros = lista.filter((p) => !conocidas.has(p.clave));
    if (otros.length) grupos.push({ id: 'otros', titulo: 'Otros parámetros', descripcion: null, claves: [], items: otros });
    return grupos.filter((g) => g.items.length > 0);
}

// Unidad corta junto al campo. «score» no lleva unidad: el rango ya dice que es un puntaje de 0 a 1.
const UNIDADES = {
    score: '',
    lecturas: 'lecturas',
    minutos: 'min',
    segundos: 's',
    horas: 'h',
    retardos: 'retardos',
    porcentaje: '%',
    dias: 'días',
    dimensiones: 'dimensiones',
};

/** Unidad para mostrar junto al valor («min», «s», «%»); las desconocidas se muestran tal cual. */
export function unidadLegible(unidad) {
    if (!unidad) return '';
    return Object.hasOwn(UNIDADES, unidad) ? UNIDADES[unidad] : unidad;
}

const NUMERO = /^-?\d+([.,]\d+)?$/;
const ENTERO = /^-?\d+$/;

/** Número que representa el texto (admite coma decimal) o null si no es un número. */
export function aNumero(texto) {
    const t = String(texto ?? '').trim();
    return NUMERO.test(t) ? Number(t.replace(',', '.')) : null;
}

const esNumerico = (tipo) => tipo === 'entero' || tipo === 'decimal' || tipo === 'numerico';

/**
 * Texto tal como lo espera el servidor: sin espacios y con punto decimal (el servidor solo admite «0.9», no «0,9»; en español
 * es fácil teclear la coma).
 */
export function valorParaEnviar(texto) {
    return String(texto ?? '').trim().replace(',', '.');
}

/** true si el texto equivale al valor guardado: «0.85» y «0.850» son el mismo número, no un cambio. */
export function mismoValor(parametro, texto, guardado = parametro?.valor) {
    const a = String(texto ?? '').trim();
    const b = String(guardado ?? '').trim();
    if (esNumerico(parametro?.tipo)) {
        const na = aNumero(a);
        const nb = aNumero(b);
        if (na != null && nb != null) return na === nb;
    }
    return a === b;
}

/** Devuelve el mensaje de error o null si el texto es un valor valido para el parametro. */
export function validarValor(parametro, texto) {
    const t = String(texto ?? '').trim();
    if (t === '') return 'El valor no puede estar en blanco.';
    const tipo = parametro.tipo;
    if (esNumerico(tipo)) {
        if (tipo === 'entero' ? !ENTERO.test(t) : !NUMERO.test(t)) {
            return tipo === 'entero' ? 'Debe ser un número entero.' : 'Debe ser un número.';
        }
        // El servidor acepta hasta 3 decimales en los parámetros decimales.
        if (tipo !== 'entero' && (t.split(/[.,]/)[1] ?? '').length > 3) return 'Usa hasta 3 decimales.';
        const n = aNumero(t);
        const min = parametro.minimo != null ? Number(parametro.minimo) : null;
        const max = parametro.maximo != null ? Number(parametro.maximo) : null;
        if ((min != null && n < min) || (max != null && n > max)) return `Fuera de rango: ${textoRango(parametro)}.`;
    }
    return null;
}

/**
 * Reglas entre parámetros que el servidor también aplica: el límite de «presente» debe ser menor que la tolerancia de retardo.
 * Se comparan con el valor GUARDADO del otro parámetro (es lo que verá el servidor al guardar este). null si no hay conflicto.
 */
export function validarCoherencia(parametro, texto, todos = []) {
    const n = aNumero(texto);
    if (n == null) return null;
    const guardado = (clave) => {
        const v = Number((todos || []).find((p) => p.clave === clave)?.valor);
        return Number.isFinite(v) ? v : null;
    };
    if (parametro.clave === 'limite_presente_min') {
        const tolerancia = guardado('tolerancia_min');
        if (tolerancia != null && n >= tolerancia) return `Debe ser menor que la tolerancia de retardo (${tolerancia} min).`;
    }
    if (parametro.clave === 'tolerancia_min') {
        const limite = guardado('limite_presente_min');
        if (limite != null && n <= limite) return `Debe ser mayor que el límite para marcar presente (${limite} min).`;
    }
    return null;
}

export function textoRango(p) {
    const u = unidadLegible(p.unidad);
    const sufijo = u ? ` ${u}` : '';
    if (p.minimo != null && p.maximo != null) return `de ${p.minimo} a ${p.maximo}${sufijo}`;
    if (p.minimo != null) return `mínimo ${p.minimo}${sufijo}`;
    if (p.maximo != null) return `máximo ${p.maximo}${sufijo}`;
    return sufijo.trim() || 'sin rango';
}

const fechaCorta = (iso) => {
    const d = iso ? new Date(iso) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleDateString('es-MX') : null;
};

/**
 * Quién y cuándo cambió el valor por última vez, en una frase corta. La API deja `actualizado_por` en nulo para los valores
 * de la carga inicial, y eso se dice («Valor inicial del sistema») en lugar de dejar la línea vacía.
 */
export function textoModificacion(p) {
    if (!p.actualizado_por) return 'Valor inicial del sistema';
    const f = fechaCorta(p.fecha_actualizacion);
    const quien = p.actualizado_por.correo ? ` por ${p.actualizado_por.correo}` : '';
    return f ? `Cambiado el ${f}${quien}` : `Cambiado${quien}`;
}

/** Paso del deslizador: el decimal avanza de 0.005 en 0.005; el entero, de 1 en 1. */
export function pasoDeslizador(p) {
    return p.tipo === 'entero' ? 1 : 0.005;
}

/** ¿Lleva deslizador? Solo los decimales con rango (el umbral de similitud): en los enteros, teclear es más rápido. */
export function llevaDeslizador(p) {
    return p.tipo !== 'entero' && esNumerico(p.tipo) && p.minimo != null && p.maximo != null;
}

/** Texto que escribe el deslizador al moverlo (3 decimales: así lo guarda el servidor). */
export function textoDeDeslizador(valor) {
    return Number(valor).toFixed(3);
}

/** "12 parámetros, 4 críticos": encabezado corto de la lista. */
export function resumenLista(items = []) {
    const lista = items || [];
    const criticos = lista.filter((p) => esCritico(p.clave)).length;
    const n = lista.length;
    return `${n} parámetro${n === 1 ? '' : 's'}${criticos ? `, ${criticos} crítico${criticos === 1 ? '' : 's'}` : ''}`;
}

/** «1 parámetro con cambios sin guardar» / «3 parámetros con cambios sin guardar» (null si no hay). */
export function textoSinGuardar(n) {
    if (!n) return null;
    return n === 1 ? '1 parámetro con cambios sin guardar' : `${n} parámetros con cambios sin guardar`;
}
