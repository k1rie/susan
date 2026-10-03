'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import Select from '@/components/ui/Select';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { horarioGuardar } from '@/lib/api/admin.js';
import { bloqueVacio, DIAS, desdeApi, haciaApi, mensajeErrorHorario, validarBloques } from './horarioEditor.utils.js';

// Editor del horario semanal del grupo: reemplaza el horario completo (api_horario_guardar).
// Valida en cliente fin > inicio y traslapes propios; el choque con otros grupos del aula lo informa el servidor.
export default function HorarioEditor({ idGrupo, horario = [], onSaved }) {
    const { toast } = useToast();
    const guardar = useApiMutation(horarioGuardar);
    const [filas, setFilas] = useState(() => desdeApi(horario));
    const [intentado, setIntentado] = useState(false);
    const [choque, setChoque] = useState(null);

    const validacion = validarBloques(filas);
    const cambiar = (clave, campo, valor) => {
        setFilas((fs) => fs.map((f) => (f.clave === clave ? { ...f, [campo]: valor } : f)));
        setChoque(null);
    };

    const enviar = async (e) => {
        e.preventDefault();
        setIntentado(true);
        setChoque(null);
        if (!validacion.valido) return;
        try {
            const r = await guardar.run({ idGrupo, bloques: haciaApi(filas) });
            setFilas(desdeApi(r.bloques ?? []));
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
        <form onSubmit={enviar} noValidate className="grid gap-3" aria-label="Horario semanal">
            {choque && <Alert tone="warning" title="Choque de horario">{choque}</Alert>}
            {intentado && validacion.general.map((m) => (
                <Alert key={m} tone="danger">{m}</Alert>
            ))}
            {filas.length === 0 && <p className="text-sm text-muted-foreground">Este grupo aún no tiene bloques de horario.</p>}
            <ul className="grid gap-3">
                {filas.map((f, i) => (
                    <li key={f.clave} className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_auto] sm:items-end">
                        <Field label={`Día (bloque ${i + 1})`}>
                            <Select value={f.dia_semana} onChange={(e) => cambiar(f.clave, 'dia_semana', e.target.value)} options={DIAS} />
                        </Field>
                        <Field label="Hora de inicio" error={intentado ? validacion.porFila[f.clave] : undefined}>
                            <Input type="time" value={f.hora_inicio} onChange={(e) => cambiar(f.clave, 'hora_inicio', e.target.value)} />
                        </Field>
                        <Field label="Hora de fin">
                            <Input type="time" value={f.hora_fin} onChange={(e) => cambiar(f.clave, 'hora_fin', e.target.value)} />
                        </Field>
                        <Button variant="ghost" aria-label={`Quitar bloque ${i + 1}`} onClick={() => setFilas((fs) => fs.filter((x) => x.clave !== f.clave))}>
                            Quitar
                        </Button>
                    </li>
                ))}
            </ul>
            <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => setFilas((fs) => [...fs, bloqueVacio()])}>
                    Agregar bloque
                </Button>
                <Button type="submit" loading={guardar.loading}>
                    Guardar horario
                </Button>
            </div>
        </form>
    );
}
