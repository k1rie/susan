'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { generarSesiones } from '@/lib/api/admin.js';
import { validarGeneracion } from './generarSesiones.utils.js';

// Genera sesiones programadas a partir del horario entre dos fechas; es idempotente (lo existente se omite).
export default function GenerarSesiones({ idGrupo, sinHorario = false, onGenerated }) {
    const { toast } = useToast();
    const generar = useApiMutation(generarSesiones);
    const [valores, setValores] = useState({ desde: '', hasta: '', omitir: '' });
    const [errores, setErrores] = useState({});
    const [resumen, setResumen] = useState(null);

    const cambiar = (campo) => (e) => setValores((v) => ({ ...v, [campo]: e.target.value }));

    const enviar = async (e) => {
        e.preventDefault();
        const v = validarGeneracion(valores);
        setErrores(v.errores);
        if (!v.valido) return;
        try {
            const r = await generar.run({ idGrupo, desde: valores.desde, hasta: valores.hasta, omitirFechas: v.omitirFechas });
            setResumen(r);
            onGenerated?.(r);
        } catch (error) {
            setResumen(null);
            toast({ tone: 'danger', title: 'No se pudieron generar las sesiones', message: error.message });
        }
    };

    return (
        <form onSubmit={enviar} noValidate className="grid gap-3" aria-label="Generar sesiones">
            {sinHorario && <Alert tone="warning">Guarda primero el horario del grupo para poder generar sesiones.</Alert>}
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Desde" required error={errores.desde}>
                    <Input type="date" value={valores.desde} onChange={cambiar('desde')} />
                </Field>
                <Field label="Hasta" required error={errores.hasta}>
                    <Input type="date" value={valores.hasta} onChange={cambiar('hasta')} />
                </Field>
            </div>
            <Field label="Fechas a omitir" hint="Opcional: AAAA-MM-DD separadas por coma, espacio o salto de línea (días festivos, suspensiones)" error={errores.omitir}>
                <Textarea rows={2} value={valores.omitir} onChange={cambiar('omitir')} />
            </Field>
            <div>
                <Button type="submit" loading={generar.loading} disabled={sinHorario}>
                    Generar sesiones
                </Button>
            </div>
            {resumen && (
                <Alert tone="success" title="Sesiones generadas">
                    <p>
                        Creadas: {resumen.creadas}. Omitidas: {resumen.omitidas} ({resumen.omitidas_por_fecha} por fecha omitida, {resumen.ya_existentes} ya existentes).
                    </p>
                    <p>Modo de registro: {resumen.modo_registro}.</p>
                </Alert>
            )}
        </form>
    );
}
