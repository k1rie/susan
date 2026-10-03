'use client';

import { useRef, useState } from 'react';
import { obtenerEstadoIndice, reconstruirIndice, sincronizarIndice } from '@/lib/http/biometria.js';
import { useApiQuery } from '@/hooks/data';

const ARGS = {};

// Estado del indice y operaciones largas. `bloqueo` (ref) impide el doble clic aunque React no haya repintado.
export function useIndiceFacial() {
    const [enCurso, setEnCurso] = useState(false);
    const [resultado, setResultado] = useState(null); // { tono, titulo, detalle[] }
    const bloqueo = useRef(false);
    const q = useApiQuery(obtenerEstadoIndice, ARGS, { refetchInterval: enCurso ? 10000 : undefined });

    const ejecutar = async (fn, formatear) => {
        if (bloqueo.current) return null;
        bloqueo.current = true;
        setEnCurso(true);
        setResultado(null);
        try {
            const r = await fn();
            setResultado(formatear.ok(r));
            return r;
        } catch (e) {
            setResultado(formatear.error(e));
            return null;
        } finally {
            bloqueo.current = false;
            setEnCurso(false);
            q.refetch();
        }
    };

    const reconstruir = (completa) =>
        ejecutar(() => reconstruirIndice({ completa }), {
            ok: (r) => ({
                tono: 'success',
                titulo: r.estado === 'activada' ? 'Índice reconstruido y activado' : 'Sin cambios: el índice ya está al día',
                detalle: [`Versión: ${r.version ?? 'ninguna'}`, `Vectores: ${r.total_vectores}`,
                    ...(r.plantillas_pendientes ? [`Plantillas pendientes: ${r.plantillas_pendientes}`] : [])],
            }),
            error: (e) => {
                if (e.code === 'RECONSTRUCCION_EN_CURSO') {
                    return { tono: 'info', titulo: 'Ya hay una reconstrucción en curso', detalle: [e.message] };
                }
                const errores = Array.isArray(e.details?.errores) ? e.details.errores : [];
                return {
                    tono: 'danger',
                    titulo: 'No se pudo reconstruir el índice',
                    detalle: [e.message, ...errores.map((x) => (typeof x === 'string' ? x : `Plantilla ${x.id_plantilla ?? '?'}: ${x.error ?? x.motivo ?? x.message ?? JSON.stringify(x)}`))],
                };
            },
        });

    const sincronizar = () =>
        ejecutar(() => sincronizarIndice(), {
            ok: (r) => ({ tono: 'success', titulo: 'Servicio sincronizado', detalle: [`Versión: ${r.version}`, `Vectores: ${r.total_vectores}`] }),
            error: (e) => ({ tono: 'danger', titulo: 'No se pudo sincronizar', detalle: [e.message] }),
        });

    return { q, enCurso, resultado, cerrarResultado: () => setResultado(null), reconstruir, sincronizar };
}
