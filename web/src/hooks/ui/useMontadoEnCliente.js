'use client';

import { useSyncExternalStore } from 'react';

const sinSuscripcion = () => () => {};

// `false` en el servidor y durante la hidratación; `true` desde el primer render que ocurre en el navegador (un componente que se monta
// después de una interacción ya lo recibe en `true`, sin un render extra). Sirve para dibujar en un portal a `document.body` sin romper
// la hidratación: el servidor nunca tiene `document` y el árbol de la hidratación debe coincidir con el del servidor.
export function useMontadoEnCliente() {
    return useSyncExternalStore(sinSuscripcion, () => true, () => false);
}

export default useMontadoEnCliente;
