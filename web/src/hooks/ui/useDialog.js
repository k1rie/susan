import { useEffect, useRef } from 'react';

const FOCUSABLES = 'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

// Pila de diálogos abiertos (el último es el de arriba). Con un diálogo sobre otro (p. ej. «¿Descartar los cambios?» sobre un
// formulario) solo el de arriba atiende Esc y Tab; si no, los dos listeners de document se pisarían el foco.
const pila = [];

// Devuelve el foco a quien abrió el diálogo (si sigue en el documento) y deja el registro de apertura limpio.
function devolverFoco(apertura) {
    const { anterior } = apertura;
    apertura.abierto = false;
    apertura.cerrando = false;
    apertura.anterior = null;
    if (anterior && typeof anterior.focus === 'function' && document.contains(anterior)) anterior.focus();
}

// Accesibilidad de diálogos: Esc cierra, Tab queda atrapado dentro, el foco inicial va al primer
// control (o a initialFocusRef) y al cerrar se devuelve al elemento que abrió el diálogo.
//   ref     -> contenedor del diálogo
//   onClose -> se invoca con Esc
//   enabled -> true mientras el diálogo está abierto
//   options.initialFocusRef -> elemento que recibe el foco inicial (p. ej. "Cancelar" en acciones destructivas)
// Con varios diálogos abiertos a la vez solo el más reciente responde al teclado.
//
// El foco se devuelve SOLO cuando el diálogo se cierra de verdad (`enabled` pasa a false) o se desmonta de verdad, nunca en la limpieza del
// efecto a secas: React Strict Mode (desarrollo) monta, desmonta y vuelve a montar de inmediato, y devolver el foco en esa limpieza
// quitaba el foco al primer campo recién enfocado (un blur que `useFormulario` marcaba como «tocado»: el panel abría con un error).
// Por eso `anterior` y los indicadores viven en un ref (sobrevive al doble montaje) y la limpieza solo difiere la devolución un microtask: si
// el efecto vuelve a correr en ese lapso (doble montaje), se cancela; si no, el diálogo se desmontó y se devuelve.
export function useDialog(ref, onClose, enabled = true, options = {}) {
    const onCloseRef = useRef(onClose);
    const initialRef = useRef(options.initialFocusRef);
    const apertura = useRef({ anterior: null, abierto: false, cerrando: false });

    // Se guardan las últimas referencias sin re-enganchar los listeners en cada render.
    useEffect(() => {
        onCloseRef.current = onClose;
        initialRef.current = options.initialFocusRef;
    });

    useEffect(() => {
        const estado = apertura.current;
        if (!enabled) {
            // Pasó de abierto a cerrado: la limpieza del efecto anterior ya corrió; aquí se devuelve el foco, en el mismo commit.
            if (estado.abierto) devolverFoco(estado);
            return undefined;
        }
        const node = ref.current;
        if (!node) return undefined;
        estado.cerrando = false;
        if (!estado.abierto) {
            estado.abierto = true;
            estado.anterior = document.activeElement;
        }
        const marca = {};
        pila.push(marca);
        // jsdom no calcula offsetParent: solo se descartan los elementos ocultos explícitamente (ellos o un ancestro con `hidden`/`inert`,
        // p. ej. una sección plegada: si no, la trampa de foco creería que el último control es uno que no se ve).
        const enfocables = () => Array.from(node.querySelectorAll(FOCUSABLES)).filter((el) => !el.hidden && !el.closest('[hidden],[inert]'));

        if (!node.contains(document.activeElement)) {
            const destino = initialRef.current?.current || enfocables()[0] || node;
            destino.focus();
        }

        const onKey = (e) => {
            if (pila[pila.length - 1] !== marca) return;
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
            const posicion = pila.indexOf(marca);
            if (posicion !== -1) pila.splice(posicion, 1);
            // Si `enabled` pasó a false, el cuerpo del efecto de arriba devuelve el foco en seguida. Si el componente se desmonta, nadie
            // más volverá a correr: se devuelve tras un microtask, salvo que el efecto se vuelva a montar enseguida (Strict Mode).
            estado.cerrando = true;
            queueMicrotask(() => {
                if (estado.cerrando && estado.abierto) devolverFoco(estado);
            });
        };
    }, [ref, enabled]);
}

export default useDialog;
