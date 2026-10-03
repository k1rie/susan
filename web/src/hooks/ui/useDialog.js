import { useEffect, useRef } from 'react';

const FOCUSABLES = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Accesibilidad de diálogos: Esc cierra, Tab queda atrapado dentro, el foco inicial va al primer
// control (o a initialFocusRef) y al cerrar se devuelve al elemento que abrió el diálogo.
//   ref     -> contenedor del diálogo
//   onClose -> se invoca con Esc
//   enabled -> true mientras el diálogo está abierto
//   options.initialFocusRef -> elemento que recibe el foco inicial (p. ej. "Cancelar" en acciones destructivas)
export function useDialog(ref, onClose, enabled = true, options = {}) {
    const onCloseRef = useRef(onClose);
    const initialRef = useRef(options.initialFocusRef);

    // Se guardan las últimas referencias sin re-enganchar los listeners en cada render.
    useEffect(() => {
        onCloseRef.current = onClose;
        initialRef.current = options.initialFocusRef;
    });

    useEffect(() => {
        if (!enabled) return undefined;
        const node = ref.current;
        if (!node) return undefined;
        const anterior = document.activeElement;
        // jsdom no calcula offsetParent: solo se descartan los elementos ocultos explícitamente.
        const enfocables = () => Array.from(node.querySelectorAll(FOCUSABLES)).filter((el) => !el.hidden);

        if (!node.contains(document.activeElement)) {
            const destino = initialRef.current?.current || enfocables()[0] || node;
            destino.focus();
        }

        const onKey = (e) => {
            if (e.key === 'Escape') {
                e.stopPropagation();
                onCloseRef.current?.();
                return;
            }
            if (e.key !== 'Tab') return;
            const items = enfocables();
            if (items.length === 0) {
                e.preventDefault();
                return;
            }
            const primero = items[0];
            const ultimo = items[items.length - 1];
            if (e.shiftKey && (document.activeElement === primero || !node.contains(document.activeElement))) {
                e.preventDefault();
                ultimo.focus();
            } else if (!e.shiftKey && (document.activeElement === ultimo || !node.contains(document.activeElement))) {
                e.preventDefault();
                primero.focus();
            }
        };
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('keydown', onKey);
            if (anterior && typeof anterior.focus === 'function' && document.contains(anterior)) anterior.focus();
        };
    }, [ref, enabled]);
}

export default useDialog;
