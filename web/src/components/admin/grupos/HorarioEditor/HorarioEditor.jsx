'use client';

import { useRef, useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import FormActions from '@/components/ui/FormActions';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { horarioGuardar } from '@/lib/api/admin.js';
import { useAvisarSucio } from '../compartido/useAvisarSucio.js';
import HorarioSemanal from '../HorarioSemanal';
import { enfocarPrimerError } from '../HorarioSemanal/enfocarError.js';
import { firmaFranjas, franjasDesdeApi, franjasHaciaApi, validarFranjas } from '../HorarioSemanal/horarioSemanal.utils.js';
import { mensajeErrorHorario } from './horarioEditor.utils.js';

// Pestaña Horario de un grupo: reemplaza el horario completo (api_horario_guardar). El editor trabaja con franjas (días + hora) y al guardar
// las expande en un bloque por día, el mismo payload de siempre. Valida en el cliente orden y traslapes propios; el choque con otros grupos del
// aula lo informa el servidor. `onSucioChange` avisa al detalle del grupo si hay cambios sin guardar (las pestañas desmontan su contenido).
export default function HorarioEditor({ idGrupo, horario = [], horasMateria, onSaved, onSucioChange }) {
    const { toast } = useToast();
    const guardar = useApiMutation(horarioGuardar);
    const [base, setBase] = useState(() => franjasDesdeApi(horario));
    const [franjas, setFranjas] = useState(base);
    const [intentado, setIntentado] = useState(false);
    const [choque, setChoque] = useState(null);
    const formulario = useRef(null);

    const sucio = firmaFranjas(franjas) !== firmaFranjas(base);
    useAvisarSucio(sucio, onSucioChange);

    const editar = (siguientes) => {
        setFranjas(siguientes);
        setChoque(null);
    };

    const descartar = () => {
        setFranjas(base);
        setIntentado(false);
        setChoque(null);
    };

    const enviar = async (e) => {
        e.preventDefault();
        setIntentado(true);
        setChoque(null);
        if (!validarFranjas(franjas).valido) {
            // Los errores en línea ya están pintados: el foco va al primero.
            requestAnimationFrame(() => enfocarPrimerError(formulario.current));
            return;
        }
        try {
            const r = await guardar.run({ idGrupo, bloques: franjasHaciaApi(franjas) });
            const guardado = franjasDesdeApi(r.bloques ?? []);
            setBase(guardado);
            setFranjas(guardado);
            setIntentado(false);
            toast({ tone: 'success', message: 'Horario guardado.' });
            onSaved?.(r);
        } catch (error) {
            const mensaje = mensajeErrorHorario(error);
            if (error.code === 'HORARIO_CHOQUE') setChoque(mensaje);
            else toast({ tone: 'danger', title: 'No se pudo guardar el horario', message: mensaje });
        }
    };

    return (
        <form ref={formulario} onSubmit={enviar} noValidate className="flex flex-col gap-4" aria-label="Horario semanal">
            {choque && (
                <Alert tone="warning" title="Choque de horario">
                    {choque}
                </Alert>
            )}
            <HorarioSemanal value={franjas} onChange={editar} mostrarPendientes={intentado} horasMateria={horasMateria} disabled={guardar.loading} />
            <FormActions dirty={sucio} sticky="movil">
                {sucio && (
                    <Button variant="secondary" onClick={descartar} disabled={guardar.loading}>
                        Descartar cambios
                    </Button>
                )}
                <Button type="submit" loading={guardar.loading}>
                    Guardar horario
                </Button>
            </FormActions>
        </form>
    );
}
