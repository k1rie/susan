'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { contarCambios, enfocarPrimerError, extraerValor, iguales, limpiarErrores } from './formulario.utils.js';

const SIN_ERRORES = Object.freeze({});

// Estado de un formulario: valores, validación en el momento justo, «tocados», envío sin doble clic y detección de cambios.
//
//   inicial          valores de partida (objeto plano). Para editar un registro que carga después, llama a `reiniciar(registro)`.
//   validar(valores) => { campo: 'mensaje' }  Pura y síncrona; los campos correctos se omiten o van vacíos. Es validación de
//                    conveniencia: la regla real sigue siendo la del servidor.
//   onSubmit(valores) => Promise  Si lanza, el error queda en `errorEnvio` (o en un campo, ver `mapearError`) y se conserva lo capturado.
//   validarAlSalir   true: el error de un campo aparece al salir de él (blur) o al enviar, nunca mientras se escribe por primera vez;
//                    false: solo al enviar. Con un error visible se revalida en cada tecla, así que desaparece en cuanto se corrige.
//   mapearError(error) => { campo: 'mensaje' } | null  Convierte un error del servidor (p. ej. DUPLICADO) en un error pegado al campo
//                    que lo causa, con foco en él. Si devuelve null el error es general (`errorEnvio`).
// Foco al primer error: lleva el foco a Input, Select, Textarea, Combobox y SegmentedControl por `name` (ver `enfocarPrimerError`). Un campo
// `disabled` no puede recibir el foco: mientras `enviando` usa `readOnly` (o `aria-disabled`) y no `disabled`; si el campo con el error del
// servidor seguía deshabilitado al fallar el envío, el foco se reintenta tras el render en que `enviando` vuelve a `false`.
export function useFormulario({ inicial, validar, onSubmit, validarAlSalir = true, mapearError } = {}) {
    const [base, setBase] = useState(() => inicial ?? {});
    const [valores, setValores] = useState(() => inicial ?? {});
    const [tocados, setTocados] = useState({});
    const [intentado, setIntentado] = useState(false);
    const [enviando, setEnviando] = useState(false);
    const [errorEnvio, setErrorEnvio] = useState(null);
    const [erroresServidor, setErroresServidor] = useState(SIN_ERRORES);

    // Los manejadores leen siempre lo último (también si se llaman en el mismo tick que un cambio); se actualizan en eventos y efectos,
    // nunca durante el render.
    const valoresRef = useRef(valores);
    const baseRef = useRef(base);
    const opcionesRef = useRef({ validar, onSubmit, mapearError });
    const enviandoRef = useRef(false);
    const montado = useRef(true);
    // Foco que no pudo darse al fallar (campo `disabled` mientras enviaba, sección plegada que aún no abre): se reintenta tras el render.
    const focoPendiente = useRef(null);
    useEffect(() => {
        opcionesRef.current = { validar, onSubmit, mapearError };
    });
    useEffect(() => {
        const pendiente = focoPendiente.current;
        if (!pendiente || enviando) return;
        focoPendiente.current = null;
        enfocarPrimerError(pendiente.raiz, pendiente.errores);
    });
    useEffect(() => {
        montado.current = true;
        return () => {
            montado.current = false;
        };
    }, []);

    const erroresTodos = useMemo(() => limpiarErrores(validar?.(valores)), [validar, valores]);

    // Solo se muestran los errores de campos tocados o, tras intentar enviar, todos; los del servidor siempre (se quitan al editar el campo).
    const errores = useMemo(() => {
        const visibles = {};
        for (const [campo, mensaje] of Object.entries(erroresTodos)) {
            if (intentado || (validarAlSalir && tocados[campo])) visibles[campo] = mensaje;
        }
        for (const [campo, mensaje] of Object.entries(erroresServidor)) {
            if (!visibles[campo]) visibles[campo] = mensaje;
        }
        return visibles;
    }, [erroresTodos, erroresServidor, intentado, tocados, validarAlSalir]);

    const sucio = useMemo(() => !iguales(valores, base), [valores, base]);
    const cambios = useMemo(() => contarCambios(valores, base), [valores, base]);
    const valido = Object.keys(erroresTodos).length === 0;
    const primerError = Object.values(erroresTodos)[0] ?? null;

    const setCampo = useCallback((nombre, valor) => {
        const actual = valoresRef.current;
        const nuevo = typeof valor === 'function' ? valor(actual[nombre]) : valor;
        const siguiente = { ...actual, [nombre]: nuevo };
        valoresRef.current = siguiente;
        setValores(siguiente);
        // El error del servidor era sobre el valor anterior: al editar el campo deja de aplicar.
        setErroresServidor((s) => {
            if (!(nombre in s)) return s;
            const { [nombre]: _quitado, ...resto } = s;
            return resto;
        });
    }, []);

    const tocar = useCallback((nombres) => {
        const lista = nombres === undefined ? [...Object.keys(valoresRef.current), ...Object.keys(limpiarErrores(opcionesRef.current.validar?.(valoresRef.current)))] : [].concat(nombres);
        setTocados((t) => {
            const siguiente = { ...t };
            let cambio = false;
            for (const n of lista) {
                if (!siguiente[n]) {
                    siguiente[n] = true;
                    cambio = true;
                }
            }
            return cambio ? siguiente : t;
        });
    }, []);

    // Errores actuales de estos campos (se hayan tocado o no), sin mostrarlos: { campo: 'mensaje' }.
    const erroresDe = useCallback((nombres) => {
        const todos = limpiarErrores(opcionesRef.current.validar?.(valoresRef.current));
        return Object.fromEntries(Object.entries(todos).filter(([campo]) => nombres.includes(campo)));
    }, []);

    // Valida solo estos campos (p. ej. los de un paso de asistente): los marca como tocados para que muestren su error, enfoca el primero
    // inválido y devuelve true si todos están bien. Para `Asistente.validarPaso`: `(id) => f.validarCampos(CAMPOS[id]) || f.erroresDe(CAMPOS[id])`
    // (true = avanza; si no, el objeto de errores alimenta el resumen del paso).
    // Enfoca el primer campo con error; si no hay ninguno enfocable ahora, lo reintenta después del siguiente render.
    const enfocarConReintento = useCallback((raiz, errs) => {
        focoPendiente.current = enfocarPrimerError(raiz, errs) ? null : { raiz, errores: errs };
    }, []);

    const validarCampos = useCallback(
        (nombres) => {
            const propios = erroresDe(nombres);
            tocar(nombres);
            if (Object.keys(propios).length > 0) {
                enfocarPrimerError(null, propios);
                return false;
            }
            return true;
        },
        [erroresDe, tocar],
    );

    const fijarErrores = useCallback((campos) => {
        const limpios = limpiarErrores(campos);
        setErroresServidor(Object.keys(limpios).length ? limpios : SIN_ERRORES);
        if (Object.keys(limpios).length) enfocarPrimerError(null, limpios);
    }, []);

    const reiniciar = useCallback((nuevoInicial) => {
        const destino = nuevoInicial ?? baseRef.current;
        baseRef.current = destino;
        valoresRef.current = destino;
        setBase(destino);
        setValores(destino);
        setTocados({});
        setIntentado(false);
        setErrorEnvio(null);
        setErroresServidor(SIN_ERRORES);
    }, []);

    // Devuelve una promesa con true (enviado) o false (inválido o falló). Nunca lanza: el error queda en `errorEnvio` o en su campo.
    const enviar = useCallback(async (evento) => {
        evento?.preventDefault?.();
        // currentTarget solo existe durante el despacho del evento: se lee antes de cualquier await. Si `enviar` no se llamó desde el
        // submit de un <form>, el foco al primer error busca por `name` en todo el documento.
        const raiz = evento?.currentTarget?.tagName === 'FORM' ? evento.currentTarget : null;
        if (enviandoRef.current) return false;
        const { validar: validarActual, onSubmit: enviarActual, mapearError: mapearActual } = opcionesRef.current;
        const enviados = valoresRef.current;
        const errs = limpiarErrores(validarActual?.(enviados));
        setIntentado(true);
        if (Object.keys(errs).length > 0) {
            enfocarConReintento(raiz, errs);
            return false;
        }
        enviandoRef.current = true;
        setEnviando(true);
        setErrorEnvio(null);
        setErroresServidor(SIN_ERRORES);
        try {
            await enviarActual?.(enviados);
            // Lo enviado pasa a ser lo guardado: ya no hay «cambios sin guardar» (y no se pregunta al salir después de guardar).
            baseRef.current = enviados;
            if (montado.current) setBase(enviados);
            return true;
        } catch (error) {
            const delCampo = limpiarErrores(mapearActual?.(error));
            if (Object.keys(delCampo).length > 0) {
                if (montado.current) {
                    setErroresServidor(delCampo);
                    enfocarConReintento(raiz, delCampo);
                }
            } else if (montado.current) {
                setErrorEnvio(error);
            }
            return false;
        } finally {
            enviandoRef.current = false;
            if (montado.current) setEnviando(false);
        }
    }, [enfocarConReintento]);

    // Props listas para un control: `campo('matricula')`. `error` es solo el mensaje (va a `Field`); `props` es lo que se esparce en el
    // control (`<Input {...c.props} />`). Con `{ checkbox: true }` entrega `checked` en lugar de `value`.
    const campo = (nombre, { checkbox = false } = {}) => {
        const error = errores[nombre];
        const invalid = Boolean(error);
        const onChange = (arg) => setCampo(nombre, extraerValor(arg));
        const onBlur = () => {
            if (validarAlSalir) setTocados((t) => (t[nombre] ? t : { ...t, [nombre]: true }));
        };
        const dato = checkbox ? { checked: Boolean(valores[nombre]) } : { value: valores[nombre] ?? '' };
        return { name: nombre, ...dato, onChange, onBlur, invalid, error, props: { name: nombre, ...dato, onChange, onBlur, invalid } };
    };

    return {
        valores,
        setCampo,
        campo,
        errores,
        sucio,
        cambios,
        valido,
        primerError,
        enviando,
        errorEnvio,
        enviar,
        reiniciar,
        tocar,
        validarCampos,
        erroresDe,
        fijarErrores,
    };
}

export default useFormulario;
