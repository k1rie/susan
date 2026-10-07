'use client';

import { createContext, useContext } from 'react';

// Contexto que `Modal` y `PanelLateral` ofrecen a su contenido: `cerrar()` es la ruta de cierre del contenedor (la que pregunta
// «¿Descartar los cambios?» cuando el contenedor tiene `dirty`). Así un botón «Cancelar» dentro del cuerpo, de un `FormActions` o de un
// `Asistente` cierra igual que Esc, el fondo y la X, sin que cada pantalla repita la lógica.
export const CierreContext = createContext(null);

// Fuera de un contenedor devuelve `{ enContenedor: false, cerrar: undefined }`.
export function useCierreContenedor() {
    const valor = useContext(CierreContext);
    return valor ? { enContenedor: true, cerrar: valor.cerrar } : { enContenedor: false, cerrar: undefined };
}

export default useCierreContenedor;
