// El <select> ahora vive dentro de un contenedor (para dibujar el chevron de Lucide encima). Las clases de diseño que los
// consumidores ya pasaban en `className` (ancho, márgenes, posición en flex/grid) deben ir al CONTENEDOR para que el
// chevron siga pegado al borde del control; el resto (tamaño de texto, altura…) sigue yendo al <select>.
const TOKEN_DE_DISENO = /^-?(?:m|mx|my|mt|mr|mb|ml|ms|me|w|min-w|max-w|basis|grow|shrink|flex|self|justify-self|place-self|col|row|order|z)(?:-|$)/;

// Quita las variantes ("sm:", "max-md:", "hover:") y el modificador de importancia ("!" delante o detrás).
function nucleo(token) {
    return token.replace(/^(?:[\w-]+:)+/, '').replace(/^!/, '').replace(/!$/, '');
}

/** Reparte `className` en { envoltura, control }. Sin clases devuelve cadenas vacías. */
export function repartirClases(className) {
    const envoltura = [];
    const control = [];
    for (const token of String(className ?? '').split(/\s+/).filter(Boolean)) {
        (TOKEN_DE_DISENO.test(nucleo(token)) ? envoltura : control).push(token);
    }
    return { envoltura: envoltura.join(' '), control: control.join(' ') };
}
