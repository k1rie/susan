'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useCambiosSinGuardar } from '@/hooks/ui/useCambiosSinGuardar.js';
import { useFormulario } from '@/hooks/ui/useFormulario.js';

/**
 * Estado común de las altas y ediciones de catálogo en panel lateral (aula, materia, docente).
 *
 *   editando       true: editar un registro (guarda, avisa y cierra). false: alta (pantalla de éxito o «crear otro»).
 *   inicial        valores de partida (en alta, los vacíos; en edición, los del registro).
 *   inicialOtra    (valoresEnviados) => valores con que arranca «Guardar y crear otro» (por omisión `inicial`).
 *   validar / mapearError   como `useFormulario`.
 *   guardar        (valores) => Promise<registro>. Aquí van la o las llamadas a la API; si lanza, el error se pega al campo
 *                  (`mapearError`) o queda en `f.errorEnvio`, y lo capturado se conserva. Si hay varias llamadas y la primera
 *                  ya persistió algo, el error lleva `guardadoParcial: { registro, valores }` (ver abajo).
 *   onGuardado     (registro) => void: refresca la lista de detrás. NO cierra el panel; eso lo decide el flujo.
 *   onClose        cierra el panel.
 *   onCreado       (registro) => void: si se da, tras un alta (sin «crear otro») se llama a esto EN LUGAR de mostrar la pantalla
 *                  de éxito (p. ej. la cuenta de usuario, cuyo éxito es el aviso de la contraseña temporal).
 *   mensajeEditado / mensajeOtra   (registro) => título del aviso breve («Aula A-12 actualizada»).
 *
 * Devuelve `f` (el formulario), `campo(nombre)` (como `f.campo`, pero el blur de un campo sin editar no lo marca como «tocado»), `formId` (para `type="submit" form={formId}` del pie), `enviar` (para el `onSubmit` del
 * <form>), `pedirOtro` («Guardar y crear otro»), `exito` (el registro creado, o null) y `crearOtra` (vuelve del éxito al formulario).
 *
 * Fallo parcial: si `guardar` lanza un error con `guardadoParcial` (el registro ya se guardó y falló un paso posterior, p. ej. el cambio
 * de estatus de un docente), se avisa a la lista (`onGuardado`) y el formulario toma `guardadoParcial.valores` como lo guardado: así
 * «Cambios sin guardar» solo cuenta lo que de verdad falta y reintentar no repite el alta.
 *
 * Por qué se resetea DESPUÉS de `f.enviar`: `useFormulario` toma lo enviado como «lo guardado» al terminar; si el reinicio ocurriera
 * dentro de `onSubmit` esa base pisaría al formulario limpio y quedaría «sucio» sin que nadie hubiera escrito nada.
 */
export function useAltaCatalogo({ editando, inicial, inicialOtra, validar, mapearError, guardar, onGuardado, onCreado, onClose, mensajeEditado, mensajeOtra }) {
    const formId = useId();
    const { toast } = useToast();
    const modo = useRef('cerrar');
    const ultimo = useRef({ registro: null, valores: null });
    const [exito, setExito] = useState(null);

    // `f` se necesita dentro de su propio `onSubmit` (fallo parcial): se lee por ref, que se actualiza después de pintar.
    const fRef = useRef(null);
    const f = useFormulario({
        inicial,
        validar,
        mapearError,
        onSubmit: async (valores) => {
            try {
                const registro = await guardar(valores);
                ultimo.current = { registro, valores };
            } catch (error) {
                const parcial = error?.guardadoParcial;
                if (parcial) {
                    onGuardado?.(parcial.registro);
                    fRef.current?.reiniciar(parcial.valores);
                }
                throw error;
            }
        },
    });
    useEffect(() => {
        fRef.current = f;
    });
    useCambiosSinGuardar(f.sucio);

    // Un campo que nadie ha tocado no muestra error al perder el foco: pasar de largo («Tab») o la devolución de foco que hace el
    // contenedor al montarse en desarrollo (React Strict Mode) no deben pintar de rojo un formulario recién abierto. El error de un
    // campo vacío aparece al enviar, o al salir de él si la persona llegó a escribir o elegir algo.
    const editados = useRef(new Set());
    const campo = (nombre, opciones) => {
        const base = f.campo(nombre, opciones);
        const onChange = (arg) => {
            editados.current.add(nombre);
            base.onChange(arg);
        };
        const onBlur = () => {
            if (editados.current.has(nombre)) base.onBlur();
        };
        return { ...base, onChange, onBlur, props: { ...base.props, onChange, onBlur } };
    };

    const enviar = async (evento) => {
        const otra = modo.current === 'otra';
        modo.current = 'cerrar';
        const guardado = await f.enviar(evento);
        if (!guardado) {
            // `useFormulario` enfoca por `name`, y el selector de vínculo (Combobox) no lo expone: con dos errores se iría al segundo.
            // Ya pintado el error, el foco va al primer control marcado como inválido EN PANTALLA (si se puede enfocar).
            setTimeout(() => {
                const primero = document.getElementById(formId)?.querySelector('[aria-invalid="true"]');
                if (primero && primero.tabIndex >= 0) primero.focus();
            }, 0);
            return;
        }
        const { registro, valores } = ultimo.current;
        onGuardado?.(registro);
        if (editando) {
            toast({ tone: 'success', title: mensajeEditado?.(registro) ?? 'Cambios guardados' });
            onClose?.();
        } else if (otra) {
            toast({ tone: 'success', title: mensajeOtra?.(registro) ?? 'Registro creado' });
            f.reiniciar(inicialOtra?.(valores) ?? inicial);
            // El foco vuelve al primer campo: quien captura en serie no debe buscarlo con el ratón.
            document.getElementById(formId)?.querySelector('input:not([type="hidden"]), select, textarea')?.focus();
        } else if (onCreado) {
            onCreado(registro);
        } else {
            setExito(registro);
        }
        editados.current.clear();
    };

    // `requestSubmit` (y no un clic en el botón del pie) para que pase por la validación y el `onSubmit` del <form>.
    const pedirOtro = () => {
        modo.current = 'otra';
        document.getElementById(formId)?.requestSubmit();
    };

    const crearOtra = () => {
        setExito(null);
        f.reiniciar(inicial);
        editados.current.clear();
    };

    return { f, campo, formId, enviar, pedirOtro, exito, crearOtra };
}

export default useAltaCatalogo;
