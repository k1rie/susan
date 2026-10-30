// Mini-marcado de texto enriquecido para las cadenas del reporte.
//
//   **negrita**        -> negrita
//   *cursiva*          -> cursiva
//   ***ambas***        -> negrita + cursiva
//   `identificador`    -> monoespaciada (dentro NO se interpreta nada más)
//   \* \` \\           -> el carácter literal
//   \n                 -> salto de línea suave dentro del mismo párrafo
//
// Reglas para evitar falsos positivos con asteriscos sueltos (por ejemplo "5 * 3"):
// un `*` solo ABRE si lo sigue un carácter que no es espacio, y solo CIERRA si lo
// antecede un carácter que no es espacio. Si el marcado queda sin cerrar se lanza un
// Error con un fragmento del texto, para detectar el descuido al armar el reporte.

const ESCAPABLES = new Set(['*', '`', '\\']);

/**
 * Convierte una cadena con mini-marcado en segmentos planos.
 * @param {string} texto
 * @returns {{texto: string, negrita: boolean, cursiva: boolean, codigo: boolean, salto?: boolean}[]}
 */
export function parsearMarcado(texto) {
    const fuente = String(texto);
    const segmentos = [];
    let buffer = '';
    let negrita = false;
    let cursiva = false;
    let codigo = false;

    const vaciar = () => {
        if (buffer !== '') {
            segmentos.push({ texto: buffer, negrita, cursiva, codigo });
            buffer = '';
        }
    };
    const esEspacio = (c) => c === undefined || /\s/.test(c);

    for (let i = 0; i < fuente.length; i++) {
        const c = fuente[i];

        if (c === '\\' && ESCAPABLES.has(fuente[i + 1])) {
            buffer += fuente[i + 1];
            i += 1;
            continue;
        }
        if (c === '`') {
            vaciar();
            codigo = !codigo;
            continue;
        }
        if (codigo) {
            // Dentro de código todo es literal (incluido el salto de línea, que se normaliza luego).
            buffer += c;
            continue;
        }
        if (c === '\n') {
            vaciar();
            segmentos.push({ texto: '', negrita, cursiva, codigo: false, salto: true });
            continue;
        }
        if (c === '*' && fuente[i + 1] === '*') {
            const antes = fuente[i - 1];
            const despues = fuente[i + 2];
            const puedeAbrir = !negrita && !esEspacio(despues);
            const puedeCerrar = negrita && !esEspacio(antes);
            if (puedeAbrir || puedeCerrar) {
                vaciar();
                negrita = !negrita;
                i += 1;
                continue;
            }
        }
        if (c === '*') {
            const antes = fuente[i - 1];
            const despues = fuente[i + 1];
            const puedeAbrir = !cursiva && !esEspacio(despues);
            const puedeCerrar = cursiva && !esEspacio(antes);
            if (puedeAbrir || puedeCerrar) {
                vaciar();
                cursiva = !cursiva;
                continue;
            }
        }
        buffer += c;
    }
    vaciar();

    if (negrita || cursiva || codigo) {
        const que = [negrita && '**', cursiva && '*', codigo && '`'].filter(Boolean).join(' ');
        throw new Error(`Marcado sin cerrar (${que}) en: "${fuente.slice(0, 70)}"`);
    }
    return segmentos;
}

/** Quita el marcado y devuelve el texto plano (para el índice, búsquedas y pruebas). */
export function textoPlano(texto) {
    return parsearMarcado(texto)
        .map((s) => (s.salto ? ' ' : s.texto))
        .join('');
}
