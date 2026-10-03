'use client';

import { useEffect, useRef } from 'react';
import { useApiQuery } from '@/hooks/data';
import { consentimientosAlumno } from '@/lib/api/biometria.js';

// Carga el historial de consentimientos; un cambio de `version` fuerza la recarga.
export default function useConsentimientos(idAlumno, version = 0) {
    const consulta = useApiQuery(consentimientosAlumno, { idAlumno, limit: 50 });
    const { refetch } = consulta;
    const primera = useRef(true);
    useEffect(() => {
        if (primera.current) {
            primera.current = false;
            return;
        }
        refetch();
    }, [version, refetch]);
    return consulta;
}
