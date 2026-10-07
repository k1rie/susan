// Funciones puras de `useFormulario` (sin React ni DOM, salvo `enfocarPrimerError`, que recibe el nodo).

// Igualdad estructural para valores de formulario: primitivos, fechas, arreglos y objetos planos (p. ej. los bloques de un horario).
export function iguales(a, b) {
    if (Object.is(a, b)) return true;
    if (a == null || b == null || typeof a !== 'object' || typeof b !== 'object') return false;
    if (a instanceof Date || b instanceof Date) return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every((v, i) => iguales(v, b[i]));
    const clavesA = Object.keys(a);
    const clavesB = Object.keys(b);
    return clavesA.length === clavesB.length && clavesA.every((k) => Object.hasOwn(b, k) && iguales(a[k], b[k]));
}

// Cuántos campos de primer nivel difieren de los valores guardados («3 cambios sin guardar»).
export function contarCambios(valores, base) {
    const claves = new Set([...Object.keys(valores ?? {}), ...Object.keys(base ?? {})]);
    let n = 0;
    for (const k of claves) if (!iguales(valores?.[k], base?.[k])) n += 1;
    return n;
}

// `validar` puede devolver undefined, null o un objeto con valores vacíos para los campos correctos: solo se conservan los mensajes reales.
export function limpiarErrores(errores) {
    const limpio = {};
    if (!errores || typeof errores !== 'object') return limpio;
    for (const [campo, mensaje] of Object.entries(errores)) {
        if (typeof mensaje === 'string' ? mensaje.trim() !== '' : Boolean(mensaje)) limpio[campo] = mensaje;
    }
    return limpio;
}

// Un `onChange` puede recibir el evento del control nativo o directamente el valor (Combobox, SegmentedControl, FileInput…).
export function extraerValor(arg) {
    const t = arg && typeof arg === 'object' ? arg.target : null;
    if (t && typeof t === 'object' && ('value' in t || 'checked' in t)) {
        if (t.type === 'checkbox') return t.checked;
        if (t.type === 'file') return t.files?.[0] ?? null;
        return t.value;
    }
    return arg;
}

function esFormulario(nodo) {
    return Boolean(nodo) && typeof nodo === 'object' && typeof nodo.querySelectorAll === 'function';
}

const CONTROLES_NATIVOS = new Set(['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON']);
// Dentro de un control compuesto, en este orden: el input del Combobox, el radio elegido de un SegmentedControl, el primer radio
// habilitado, y por último cualquier control nativo visible.
const DENTRO_DE_COMPUESTO = [
    '[role="combobox"]:not(:disabled)',
    '[role="radio"][aria-checked="true"]:not(:disabled)',
    '[role="radio"]:not(:disabled)',
    'input:not([type="hidden"]):not(:disabled), select:not(:disabled), textarea:not(:disabled), button:not(:disabled)',
];

function enfocable(el) {
    return typeof el?.focus === 'function' && !el.disabled && !el.closest?.('[hidden],[inert]');
}

// El elemento que debe recibir el foco para un nodo candidato, o null si no hay ninguno que se pueda enfocar:
//   - un control nativo (input, select, textarea, botón) es él mismo, salvo `type="hidden"` o deshabilitado;
//   - un contenedor de un control compuesto (los que exponen `data-campo-nombre`: Combobox, SegmentedControl, o un grupo con
//     `role="radiogroup"` marcado `aria-invalid`) se resuelve por dentro con DENTRO_DE_COMPUESTO;
//   - cualquier otra cosa (un <form name>, un <div name>) no es un campo: se ignora.
function controlEnfocable(nodo, { compuesto = false } = {}) {
    if (!nodo || typeof nodo !== 'object') return null;
    if (CONTROLES_NATIVOS.has(nodo.tagName)) {
        if (nodo.tagName === 'INPUT' && nodo.type === 'hidden') return null;
        return enfocable(nodo) ? nodo : null;
    }
    const esCompuesto = compuesto || nodo.getAttribute?.('role') === 'radiogroup';
    if (!esCompuesto || typeof nodo.querySelector !== 'function') return null;
    for (const selector of DENTRO_DE_COMPUESTO) {
        const hallado = Array.from(nodo.querySelectorAll(selector)).find(enfocable);
        if (hallado) return hallado;
    }
    return null;
}

// Enfoca el primer campo (en orden de aparición en pantalla) cuyo `name` tenga error; si ninguno coincide, el primero con aria-invalid.
// Devuelve el nodo enfocado o null. `raiz` es el <form> (o cualquier contenedor); sin él se busca en todo el documento.
//
// Qué cuenta como «el campo»: un control nativo con `name`, o un contenedor con `data-campo-nombre="<name>"` (lo escriben `Combobox` y
// `SegmentedControl` cuando reciben `name`), de donde se toma el control enfocable de dentro. Los campos deshabilitados (o dentro de algo
// `hidden`/`inert`, como una sección plegada) se saltan y se busca el siguiente: un deshabilitado no puede recibir el foco. Para que el error
// de un campo que se deshabilita MIENTRAS se envía reciba el foco, usa `readOnly` en lugar de `disabled` mientras `enviando` (ver
// PRIMITIVAS-contenedores.md); `useFormulario` además reintenta el foco tras el siguiente render cuando no había a dónde ir.
export function enfocarPrimerError(raiz, errores) {
    const contenedor = esFormulario(raiz) ? raiz : typeof document !== 'undefined' ? document : null;
    if (!contenedor) return null;
    const nombres = new Set(Object.keys(errores ?? {}));
    const candidatos = Array.from(contenedor.querySelectorAll('[name], [data-campo-nombre]')).filter((el) => nombres.has(el.getAttribute('data-campo-nombre') || el.getAttribute('name')));
    let destino = null;
    for (const el of candidatos) {
        destino = controlEnfocable(el, { compuesto: el.hasAttribute('data-campo-nombre') });
        if (destino) break;
    }
    if (!destino) {
        // Sin coincidencia por nombre: el primer control (o grupo) ya marcado como inválido en pantalla.
        for (const el of Array.from(contenedor.querySelectorAll('[aria-invalid="true"]'))) {
            destino = controlEnfocable(el);
            if (destino) break;
        }
    }
    if (destino) {
        destino.focus();
        return destino;
    }
    return null;
}
