'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useApiQuery } from '@/hooks/data';
import { consentimientosAlumno, plantillaAlumno } from '@/lib/api/biometria.js';
import { registrarPlantilla, verificarFoto } from '@/lib/http/biometria.js';
import { esFotoAceptable, estadoIndiceTrasRegistro, SONDEO_INTERVALO_MS, SONDEO_MAX_INTENTOS } from './plantillaFacial.utils.js';

// Toda la lógica del panel: carga, verificación de calidad, registro y sondeo de la indexación.
export default function usePlantillaFacial({ idAlumno, version = 0, onCambio }) {
    const consentimientos = useApiQuery(consentimientosAlumno, { idAlumno, limit: 50 });
    const plantilla = useApiQuery(plantillaAlumno, { idAlumno, limit: 1 });
    const refetchC = consentimientos.refetch;
    const refetchP = plantilla.refetch;

    const [foto, setFoto] = useState(null);
    const [fotoId, setFotoId] = useState(0);
    const [veri, setVeri] = useState({ clave: null, resultado: null, error: null });
    const [envio, setEnvio] = useState({ cargando: false, error: null });
    const [registro, setRegistro] = useState(null); // { indice: 'lista'|'indexando'|'tardando', version }
    const [intentoVerif, setIntentoVerif] = useState(0);
    const montado = useRef(true);
    const sondeoId = useRef(0);

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

    // Verificación automática al tener una imagen nueva (o al reintentar tras un error del servicio).
    // `cargando` se deriva: la respuesta guardada es de otra imagen/intento hasta que llega la actual.
    const clave = foto ? `${fotoId}:${intentoVerif}` : null;
    useEffect(() => {
        if (!foto) return undefined;
        const control = new AbortController();
        verificarFoto(foto, { signal: control.signal }).then(
            (resultado) => {
                if (!control.signal.aborted) setVeri({ clave, resultado, error: null });
            },
            (error) => {
                if (!control.signal.aborted) setVeri({ clave, resultado: null, error });
            },
        );
        return () => control.abort();
    }, [foto, clave]);
    const actual = clave !== null && veri.clave === clave;
    const verificacion = {
        cargando: clave !== null && !actual,
        resultado: actual ? veri.resultado : null,
        error: actual ? veri.error : null,
    };

    const vigente = consentimientos.data?.vigente ? consentimientos.data.consentimiento_vigente : null;
    const activa = plantilla.data?.activa ?? null;

    const elegirFoto = useCallback((blob) => {
        setEnvio({ cargando: false, error: null });
        setRegistro(null);
        setFoto(blob || null);
        setFotoId((n) => n + 1);
    }, []);

    const reintentarVerificacion = useCallback(() => setIntentoVerif((n) => n + 1), []);

    const sondear = useCallback(async () => {
        const id = ++sondeoId.current;
        for (let i = 0; i < SONDEO_MAX_INTENTOS; i += 1) {
            await new Promise((r) => setTimeout(r, SONDEO_INTERVALO_MS));
            if (!montado.current || sondeoId.current !== id) return;
            const r = await refetchP();
            if (!montado.current || sondeoId.current !== id) return;
            if (r?.ok && r.data?.activa?.indexada) {
                setRegistro({ indice: 'lista', version: r.data.activa.version_indice ?? null });
                onCambio?.();
                return;
            }
        }
        if (montado.current && sondeoId.current === id) setRegistro((p) => (p ? { ...p, indice: 'tardando' } : p));
    }, [refetchP, onCambio]);

    const registrar = useCallback(async () => {
        if (!vigente || !esFotoAceptable(verificacion.resultado) || !foto) return;
        setEnvio({ cargando: true, error: null });
        try {
            const r = await registrarPlantilla({ idAlumno, idConsent: vigente.id_consent, foto });
            if (!montado.current) return;
            const indice = estadoIndiceTrasRegistro(r?.indice);
            setEnvio({ cargando: false, error: null });
            setRegistro({ indice, version: r?.indice?.version ?? r?.version ?? null });
            setFoto(null);
            const rr = await refetchP();
            onCambio?.();
            if (indice === 'indexando' && !(rr?.ok && rr.data?.activa?.indexada)) sondear();
            else if (rr?.ok && rr.data?.activa?.indexada) {
                setRegistro({ indice: 'lista', version: rr.data.activa.version_indice ?? r?.indice?.version ?? null });
            }
        } catch (error) {
            if (montado.current) setEnvio({ cargando: false, error });
        }
    }, [vigente, verificacion.resultado, foto, idAlumno, refetchP, onCambio, sondear]);

    return {
        consentimientos, plantilla, vigente, activa, foto, elegirFoto, verificacion, reintentarVerificacion,
        envio, registro, registrar,
        puedeRegistrar: Boolean(vigente) && esFotoAceptable(verificacion.resultado) && !envio.cargando && !verificacion.cargando,
    };
}
