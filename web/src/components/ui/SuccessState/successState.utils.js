import { isValidElement } from 'react';

// `icon` puede llegar como nodo ya armado (<Icono />, como en EmptyState) o como el componente de Lucide sin instanciar.
export function esComponente(valor) {
    return typeof valor === 'function' || (typeof valor === 'object' && valor !== null && !isValidElement(valor) && '$$typeof' in valor);
}

// Primera acción primaria, el resto secundarias; cada una puede traer su `variant`.
export function varianteAccion(accion, indice) {
    return accion.variant ?? (indice === 0 ? 'primary' : 'secondary');
}
