'use client';

import { useCallback, useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import usePlantillaFacial from '@/components/admin/alumnos/PlantillaFacialPanel/usePlantillaFacial.js';
import { useApiQuery } from '@/hooks/data';
import { VERSION_AVISO } from '@/lib/avisoBiometrico.js';
import { miRegistro } from '@/lib/api/biometria.js';
import { aceptarAviso, revocarMiConsentimiento } from '@/lib/http/autoservicio.js';
import { API_PROPIA } from './miRegistro.api.js';

/**
 * Toda la lógica de «Mi registro facial»: el estado del registro (api_mi_registro), aceptar o revocar el aviso, y el estado del asistente
 * de captura (usePlantillaFacial con las llamadas del autoservicio). El alumno es siempre el de la sesión.
 */
export default function useMiRegistro() {
    const registro = useApiQuery(miRegistro, {});
    const { toast } = useToast();
    const refetchRegistro = registro.refetch;
    // Sube al aceptar o revocar: el hook de la plantilla vuelve a leer el consentimiento.
    const [version, setVersion] = useState(0);
    const alCambiar = useCallback(() => {
        refetchRegistro();
    }, [refetchRegistro]);
    const p = usePlantillaFacial({ version, onCambio: alCambiar, api: API_PROPIA });

    const [aceptando, setAceptando] = useState(false);
    const [errorAceptar, setErrorAceptar] = useState(null);
    const [asistenteAbierto, setAsistenteAbierto] = useState(false);

    const refrescar = useCallback(async () => {
        setVersion((v) => v + 1);
        await refetchRegistro();
    }, [refetchRegistro]);

    const aceptar = useCallback(async () => {
        setAceptando(true);
        setErrorAceptar(null);
        try {
            await aceptarAviso({ version: VERSION_AVISO });
            toast({ tone: 'success', title: 'Aviso aceptado', message: 'Ahora registra tu rostro.' });
            await refrescar();
        } catch (error) {
            setErrorAceptar(error);
        } finally {
            setAceptando(false);
        }
    }, [refrescar, toast]);

    // Lo usa el ConfirmDialog: si rechaza, el diálogo sigue abierto y el error se muestra como aviso.
    const revocar = useCallback(async () => {
        try {
            await revocarMiConsentimiento();
            toast({ tone: 'success', title: 'Consentimiento revocado', message: 'Tu plantilla facial se archivó. Tu asistencia se tomará a mano.' });
            await refrescar();
        } catch (error) {
            toast({ tone: 'danger', title: 'No se pudo revocar', message: error.message });
            throw error;
        }
    }, [refrescar, toast]);

    return {
        registro,
        p,
        aceptando, errorAceptar, aceptar,
        revocar,
        asistenteAbierto,
        abrirAsistente: () => setAsistenteAbierto(true),
        cerrarAsistente: () => {
            setAsistenteAbierto(false);
            refetchRegistro();
        },
    };
}
