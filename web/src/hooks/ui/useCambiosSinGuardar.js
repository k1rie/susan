'use client';

import { useCallback, useEffect } from 'react';

export const MENSAJE_CAMBIOS = 'Tienes cambios sin guardar. Si sales ahora, se perderán.';

// Registro global de formularios con cambios sin guardar. Existe para que los enlaces que no pertenecen al formulario (riel lateral,
// barra inferior) puedan preguntar antes de navegar sin necesitar un proveedor montado en el layout: `alNavegarProtegido` consulta
// este registro. Cada instancia del hook agrega y retira su propia marca.
const sucios = new Set();

export function hayCambiosSinGuardar() {
    return sucios.size > 0;
}

// Confirmación síncrona (window.confirm), la misma que usa la guía de Next para bloquear navegación. Devuelve true si se puede salir.
export function confirmarNavegacion(mensaje = MENSAJE_CAMBIOS) {
    if (!hayCambiosSinGuardar()) return true;
    return window.confirm(mensaje);
}

// Para `<Link onNavigate={alNavegarProtegido}>`: cancela la navegación del App Router si la persona decide quedarse.
export function alNavegarProtegido(evento) {
    if (!confirmarNavegacion()) evento.preventDefault();
}

// Protege contra la pérdida de lo capturado.
//   - Recargar o cerrar la pestaña: `beforeunload` (el navegador muestra su propio aviso; el texto no se puede personalizar).
//   - Modales y pestañas propias: `confirmarSalida()` (true = puede salir) para llamar antes de cambiar de pestaña o cerrar.
//   - Enlaces de Next: `alNavegar` es un `onNavigate` listo para `<Link>`. Es el único mecanismo oficial de este Next para frenar
//     navegación interna (docs de `Link`, «Blocking navigation»); el botón «atrás» del navegador (popstate) no se puede interceptar.
export function useCambiosSinGuardar(sucio, { mensaje = MENSAJE_CAMBIOS } = {}) {
    useEffect(() => {
        if (!sucio) return undefined;
        const marca = Symbol('cambios-sin-guardar');
        sucios.add(marca);
        const alCerrar = (e) => {
            e.preventDefault();
            // Chrome exige asignar returnValue para mostrar el aviso.
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', alCerrar);
        return () => {
            window.removeEventListener('beforeunload', alCerrar);
            sucios.delete(marca);
        };
    }, [sucio]);

    const confirmarSalida = useCallback(
        (texto) => {
            if (!sucio) return true;
            return window.confirm(texto || mensaje);
        },
        [sucio, mensaje],
    );

    const alNavegar = useCallback(
        (evento) => {
            if (!confirmarSalida()) evento.preventDefault();
        },
        [confirmarSalida],
    );

    return { confirmarSalida, alNavegar, sucio: Boolean(sucio) };
}

export default useCambiosSinGuardar;
