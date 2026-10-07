'use client';

import { useState } from 'react';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import { camaraGuardar } from '@/lib/api/admin.js';
import { probarCamara } from '@/lib/http/admin.js';
import { horaDe } from '../compartido/grupos.utils.js';
import { datosCamara, describirPrueba, estadoProbar, mapearErrorCamara, validarCamara, valoresDeCamara } from './camaraForm.utils.js';

// Estado de una cámara (frente o fondo): formulario, guardado y prueba de conexión PERSISTENTE (resultado y hora, no solo un aviso que
// desaparece). Lo comparten la tarjeta de edición (CamaraForm) y el panel de alta (CamaraPanel).
export function useCamaraForm({ idAula, posicion, camara, onSaved }) {
    const { toast } = useToast();
    const guardar = useApiMutation(camaraGuardar);
    const [probando, setProbando] = useState(false);
    const [prueba, setPrueba] = useState(null);

    const f = useFormulario({
        inicial: valoresDeCamara(camara),
        validar: validarCamara,
        mapearError: mapearErrorCamara,
        onSubmit: async (v) => {
            await guardar.run({ datos: datosCamara(v, { idAula, posicion, idCamara: camara?.id_camara }) });
            toast({ tone: 'success', message: `Cámara de ${posicion} guardada.` });
            onSaved?.();
        },
    });

    const bloqueo = estadoProbar({ camara, tipoActual: f.valores.tipo, sucio: f.sucio });

    const probar = async () => {
        if (!bloqueo.puede || probando) return;
        const ip = camara.direccion_ip;
        setProbando(true);
        try {
            setPrueba({ ...describirPrueba(await probarCamara({ idCamara: camara.id_camara })), hora: horaDe(), ip });
        } catch (error) {
            setPrueba({ ...describirPrueba({ ok: false, mensaje: error.message }), hora: horaDe(), ip });
        } finally {
            setProbando(false);
        }
    };

    // Un resultado de otra dirección ya no describe a la cámara: tras cambiar la IP guardada vuelve a «sin probar».
    const vigente = prueba && prueba.ip === camara?.direccion_ip ? prueba : null;

    return { f, probando, prueba: vigente, probar, puedeProbar: bloqueo.puede, motivoProbar: bloqueo.motivo };
}

export default useCamaraForm;
