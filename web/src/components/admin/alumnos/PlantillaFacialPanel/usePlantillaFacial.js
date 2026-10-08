'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApiQuery } from '@/hooks/data';
import { consentimientosAlumno, plantillaAlumno } from '@/lib/api/biometria.js';
import { registrarPlantilla, verificarFoto, verificarFotos } from '@/lib/http/biometria.js';
import { numerarTomas, ordenarTomas } from '../CapturaGuiadaPlantilla/capturaGuiada.utils.js';
import {
    anuncioCambios, aplicarRechazoRegistro, aplicarResultadoConjunto, estadoIndiceTrasRegistro, MAXIMO_FOTOS, MINIMO_FOTOS,
    SONDEO_INTERVALO_MS, SONDEO_MAX_INTENTOS, VERIFICACION_DEBOUNCE_MS,
} from './plantillaFacial.utils.js';

const SIN_VERIFICACION = { clave: null, resultado: null, error: null };

/**
 * Las llamadas del flujo. Por omisión son las del administrador (sobre un alumno concreto); el autoservicio del alumno pasa las
 * suyas (components/alumno/MiRegistro/miRegistro.api.js), que no llevan id_alumno ni id_consent: salen de la sesión. Las funciones deben
 * tener referencia estable (de módulo): `consentimientos` y `plantilla` van a useApiQuery.
 *   verificar   calidad y consistencia del conjunto de tomas.
 *   verificarUna  calidad de UNA toma: es la detección en vivo del asistente (PantallaCaptura). Cada rol usa SU ruta: la del
 *               administrador responde NO_AUTORIZADO a un alumno, así que nada del asistente debe importarla directo.
 *   permiteUna  false: sin el camino de «una sola foto» (es un recurso del administrador).
 */
export const API_ADMIN = {
    consentimientos: consentimientosAlumno,
    plantilla: plantillaAlumno,
    verificar: verificarFotos,
    verificarUna: verificarFoto,
    registrar: registrarPlantilla,
    permiteUna: true,
};

/**
 * Toda la lógica del panel de plantilla facial: carga, conjunto de tomas, verificación, registro y sondeo
 * de la indexación.
 *
 * El servidor no guarda sesiones de captura: en cada verificación se envían TODAS las tomas (de 1 a 8) y el
 * resultado se aplica por el snapshot de ids de ESA petición, nunca por posición en el arreglo actual (al
 * repetir una toma quedan huecos). Cada toma conserva su estado hasta que llega la respuesta nueva
 * (stale-while-revalidate): solo las tomas nuevas muestran «Verificando».
 */
export default function usePlantillaFacial({ idAlumno, version = 0, onCambio, api = API_ADMIN }) {
    const consentimientos = useApiQuery(api.consentimientos, { idAlumno, limit: 50 });
    const plantilla = useApiQuery(api.plantilla, { idAlumno, limit: 1 });
    const refetchC = consentimientos.refetch;
    const refetchP = plantilla.refetch;

    const [tomas, setTomas] = useState([]);
    const [modo, setModo] = useState('camara'); // 'camara' | 'archivo'; cambiar de modo conserva las tomas
    const [veri, setVeri] = useState(SIN_VERIFICACION);
    const [intentoVerif, setIntentoVerif] = useState(0);
    const [envio, setEnvio] = useState({ cargando: false, error: null });
    const [registro, setRegistro] = useState(null); // { indice: 'lista'|'indexando'|'tardando'|'pendiente', version, nFotos, descartadas }
    const [sondeando, setSondeando] = useState(false);
    const [anuncio, setAnuncio] = useState('');
    const montado = useRef(true);
    const sondeoId = useRef(0);
    const siguienteId = useRef(1);
    const ultimoEnvio = useRef('varias'); // 'varias' | 'una': qué camino reintentar tras un 503
    const tomasRef = useRef(tomas);
    const modoRef = useRef(modo);

    // Refleja el último estado para los efectos que no deben reiniciarse cuando cambian las tomas.
    useEffect(() => {
        tomasRef.current = tomas;
        modoRef.current = modo;
    });

    useEffect(() => {
        montado.current = true;
        return () => {
            montado.current = false;
            sondeoId.current += 1;
        };
    }, []);

    const primera = useRef(true);
    useEffect(() => {
        if (primera.current) {
            primera.current = false;
            return;
        }
        refetchC();
        refetchP();
    }, [version, refetchC, refetchP]);

    const vigente = consentimientos.data?.vigente ? consentimientos.data.consentimiento_vigente : null;
    const activa = plantilla.data?.activa ?? null;
    const idConsent = vigente?.id_consent ?? null;

    const ordenadas = useMemo(() => ordenarTomas(tomas), [tomas]);
    // La clave identifica EL CONJUNTO (ids en orden de envío) y cada reintento; los cambios de estado de una toma no la tocan.
    const clave = vigente && ordenadas.length > 0 ? `${ordenadas.map((t) => t.id).join(',')}:${intentoVerif}` : null;

    // Verificación del conjunto con debounce y cancelación: varias capturas seguidas producen una sola petición.
    useEffect(() => {
        if (!clave) return undefined;
        const lista = ordenarTomas(tomasRef.current);
        const ids = lista.map((t) => t.id);
        const blobs = lista.map((t) => t.blob);
        const control = new AbortController();
        const temporizador = setTimeout(() => {
            api.verificar(blobs, { idAlumno, idConsent, signal: control.signal }).then(
                (resultado) => {
                    if (control.signal.aborted) return;
                    const previas = tomasRef.current;
                    const nuevas = aplicarResultadoConjunto(previas, ids, resultado);
                    setVeri({ clave, resultado, error: null });
                    setTomas(nuevas);
                    setAnuncio(anuncioCambios(previas, nuevas, (id) => numerarTomas(nuevas, modoRef.current).get(id)));
                },
                (error) => {
                    if (!control.signal.aborted) setVeri({ clave, resultado: null, error });
                },
            );
        }, VERIFICACION_DEBOUNCE_MS);
        return () => {
            clearTimeout(temporizador);
            control.abort();
        };
    }, [clave, idAlumno, idConsent, api]);

    // `cargando` se deriva: la respuesta guardada es de otro conjunto o intento hasta que llega la actual.
    const actual = clave !== null && veri.clave === clave;
    const reintentarVerificacion = useCallback(() => setIntentoVerif((n) => n + 1), []);
    const verificacion = {
        cargando: clave !== null && !actual,
        resultado: actual ? veri.resultado : null,
        error: actual ? veri.error : null,
        reintentar: reintentarVerificacion,
    };

    const minimo = veri.resultado?.minimo ?? MINIMO_FOTOS;
    const maximo = Math.min(MAXIMO_FOTOS, veri.resultado?.maximo ?? MAXIMO_FOTOS);
    const aceptadas = tomas.filter((t) => t.estado === 'aceptada').length;
    const sinSondeo = !sondeando;

    const puedeRegistrar = Boolean(vigente)
        && tomas.length >= minimo
        && tomas.every((t) => t.estado === 'aceptada')
        && verificacion.resultado?.suficiente === true
        && verificacion.resultado?.ambiguo !== true
        && !envio.cargando
        && !verificacion.cargando
        && sinSondeo;
    // Escape de una foto (camino heredado): para personas cuyas tomas no resultan consistentes entre sí.
    const puedeRegistrarUna = api.permiteUna !== false && Boolean(vigente) && aceptadas === 1 && !envio.cargando && !verificacion.cargando && sinSondeo;

    const reiniciarEnvio = useCallback(() => {
        setEnvio({ cargando: false, error: null });
        setRegistro(null);
    }, []);

    const agregarToma = useCallback((blob, origen = 'archivo', { paso = null, nombre = null } = {}) => {
        const id = siguienteId.current;
        siguienteId.current += 1;
        const nueva = { id, origen, paso, blob, nombre, estado: 'verificando', motivoCodigo: null, motivo: null, cosenoResto: null, calidad: null, rostros: null, duplicadaDeId: null };
        // El tope y el paso libre se comprueban dentro del actualizador: varias altas seguidas ven el estado más reciente.
        setTomas((prev) => (prev.length >= MAXIMO_FOTOS || (paso != null && prev.some((t) => t.paso === paso)) ? prev : [...prev, nueva]));
        reiniciarEnvio();
        return id;
    }, [reiniciarEnvio]);

    const quitarToma = useCallback((id) => {
        const numero = numerarTomas(tomasRef.current, modoRef.current).get(id);
        setTomas((prev) => prev.filter((t) => t.id !== id));
        setEnvio({ cargando: false, error: null });
        setAnuncio(numero ? `Toma ${numero} quitada.` : '');
    }, []);
    // Repetir y quitar borran la toma; la diferencia es de interfaz: el paso queda libre como siguiente.
    const repetirToma = quitarToma;

    const limpiar = useCallback(() => {
        setTomas([]);
        setVeri(SIN_VERIFICACION);
        setEnvio({ cargando: false, error: null });
        setAnuncio('');
    }, []);

    const sondear = useCallback(async () => {
        const id = ++sondeoId.current;
        setSondeando(true);
        try {
            for (let i = 0; i < SONDEO_MAX_INTENTOS; i += 1) {
                await new Promise((r) => setTimeout(r, SONDEO_INTERVALO_MS));
                if (!montado.current || sondeoId.current !== id) return;
                const r = await refetchP();
                if (!montado.current || sondeoId.current !== id) return;
                if (r?.ok && r.data?.activa?.indexada) {
                    setRegistro((p) => ({ ...p, indice: 'lista', version: r.data.activa.version_indice ?? null }));
                    onCambio?.();
                    return;
                }
            }
            if (montado.current && sondeoId.current === id) setRegistro((p) => (p ? { ...p, indice: 'tardando' } : p));
        } finally {
            if (montado.current && sondeoId.current === id) setSondeando(false);
        }
    }, [refetchP, onCambio]);

    // Cierre común del registro (varias fotos o una sola): limpia el conjunto y sigue el estado del índice.
    const terminarRegistro = useCallback(async (r, nFotos) => {
        if (!montado.current) return;
        const indice = estadoIndiceTrasRegistro(r?.indice);
        setEnvio({ cargando: false, error: null });
        setRegistro({
            indice,
            version: r?.indice?.version ?? r?.version ?? null,
            nFotos: r?.n_fotos ?? nFotos,
            descartadas: r?.muestra?.descartadas?.length ?? 0,
        });
        setTomas([]);
        setVeri(SIN_VERIFICACION);
        setAnuncio('');
        const rr = await refetchP();
        onCambio?.();
        if (!montado.current) return;
        if (indice === 'indexando' && !(rr?.ok && rr.data?.activa?.indexada)) sondear();
        else if (indice !== 'pendiente' && rr?.ok && rr.data?.activa?.indexada) {
            setRegistro((p) => ({ ...p, indice: 'lista', version: rr.data.activa.version_indice ?? p?.version ?? null }));
        }
    }, [refetchP, onCambio, sondear]);

    const fallarRegistro = useCallback((error, ids) => {
        if (!montado.current) return;
        // El 422 de fotos trae el estado de cada una: se marcan las tomas con el snapshot de ids del envío.
        if (error?.code === 'FOTOS_RECHAZADAS' || error?.code === 'FOTOS_DUPLICADAS') {
            setTomas((prev) => aplicarRechazoRegistro(prev, ids, error.details));
        }
        setEnvio({ cargando: false, error });
    }, []);

    const registrar = useCallback(async () => {
        if (!puedeRegistrar) return;
        ultimoEnvio.current = 'varias';
        const lista = ordenadas;
        setEnvio({ cargando: true, error: null });
        try {
            const r = await api.registrar({ idAlumno, idConsent, fotos: lista.map((t) => t.blob) });
            await terminarRegistro(r, lista.length);
        } catch (error) {
            fallarRegistro(error, lista.map((t) => t.id));
        }
    }, [puedeRegistrar, ordenadas, idAlumno, idConsent, api, terminarRegistro, fallarRegistro]);

    const registrarUna = useCallback(async () => {
        if (!puedeRegistrarUna) return;
        ultimoEnvio.current = 'una';
        const toma = tomas.find((t) => t.estado === 'aceptada');
        setEnvio({ cargando: true, error: null });
        try {
            const r = await api.registrar({ idAlumno, idConsent, foto: toma.blob });
            await terminarRegistro(r, 1);
        } catch (error) {
            fallarRegistro(error, [toma.id]);
        }
    }, [puedeRegistrarUna, tomas, idAlumno, idConsent, api, terminarRegistro, fallarRegistro]);

    const reintentarEnvio = useCallback(() => (ultimoEnvio.current === 'una' ? registrarUna() : registrar()), [registrar, registrarUna]);

    // Subir fotos y reconstruir el índice puede tardar un minuto: se avisa antes de cerrar la pestaña.
    useEffect(() => {
        if (!envio.cargando) return undefined;
        const avisar = (e) => {
            e.preventDefault();
            e.returnValue = '';
        };
        window.addEventListener('beforeunload', avisar);
        return () => window.removeEventListener('beforeunload', avisar);
    }, [envio.cargando]);

    return {
        consentimientos, plantilla, vigente, activa,
        tomas, ordenadas, modo, setModo, agregarToma, quitarToma, repetirToma, limpiar,
        verificacion, verificarUna: api.verificarUna, minimo, maximo, aceptadas, anuncio,
        envio, registro, sondeando,
        puedeRegistrar, puedeRegistrarUna, registrar, registrarUna, reintentarEnvio,
    };
}
