// Reglas de contraseña del producto (política de Auth: ≥ 10 caracteres, con letra y número). Es una COPIA de la lógica de
// components/auth/CambiarContrasenaForm/contrasena.utils.js (`reglasContrasena`, sin la regla de «coincide» porque aquí no hay
// campo de confirmación): ui/ no importa de auth/. campoPassword.utils.test.js comprueba que las dos sigan de acuerdo.
export const REGLAS_PREDETERMINADAS = [
    { id: 'largo', texto: 'Al menos 10 caracteres', test: (v) => v.length >= 10 },
    { id: 'letra', texto: 'Contiene una letra', test: (v) => /\p{L}/u.test(v) },
    { id: 'numero', texto: 'Contiene un número', test: (v) => /\d/.test(v) },
];

/** Evalúa las reglas contra la contraseña escrita: [{ id, texto, cumple }]. */
export function evaluarReglas(reglas, valor) {
    const texto = String(valor ?? '');
    return reglas.map((r) => ({ id: r.id, texto: r.texto, cumple: Boolean(r.test(texto)) }));
}

// Sin caracteres que se confunden al dictarlos o copiarlos a mano: 0/O, 1/l/I.
const LEGIBLE = {
    mayusculas: 'ABCDEFGHJKLMNPQRSTUVWXYZ',
    minusculas: 'abcdefghijkmnpqrstuvwxyz',
    digitos: '23456789',
    simbolos: '!@#$%&*+-=?',
};
const COMPLETO = {
    mayusculas: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    minusculas: 'abcdefghijklmnopqrstuvwxyz',
    digitos: '0123456789',
    simbolos: '!@#$%&*+-=?',
};

export const LONGITUD_MINIMA_GENERADA = 12;

/** Entero uniforme en [0, n) con el generador criptográfico del navegador (descarta valores que sesgarían el reparto). */
export function aleatorioSeguro(n) {
    const tope = Math.floor(0x100000000 / n) * n;
    const cubo = new Uint32Array(1);
    do {
        globalThis.crypto.getRandomValues(cubo);
    } while (cubo[0] >= tope);
    return cubo[0] % n;
}

/**
 * Contraseña aleatoria con al menos una mayúscula, una minúscula, un dígito y un símbolo (largo mínimo 12, como la que
 * genera el servidor para las cuentas temporales). `aleatorio(n)` se puede inyectar en pruebas.
 */
export function generarContrasena(longitud = 16, { legible = true, aleatorio = aleatorioSeguro } = {}) {
    const clases = Object.values(legible ? LEGIBLE : COMPLETO);
    const largo = Math.max(LONGITUD_MINIMA_GENERADA, longitud);
    const todo = clases.join('');
    const caracteres = clases.map((c) => c[aleatorio(c.length)]);
    while (caracteres.length < largo) caracteres.push(todo[aleatorio(todo.length)]);
    for (let i = caracteres.length - 1; i > 0; i -= 1) {
        const j = aleatorio(i + 1);
        [caracteres[i], caracteres[j]] = [caracteres[j], caracteres[i]];
    }
    return caracteres.join('');
}
