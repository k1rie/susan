'use client';

import { Minus, Plus } from 'lucide-react';
import clsx from 'clsx';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Field from '@/components/ui/Field';
import FormActions from '@/components/ui/FormActions';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { useFormulario } from '@/hooks/ui/useFormulario.js';
import { aulaGuardar } from '@/lib/api/admin.js';
import { useAvisarSucio } from '../compartido/useAvisarSucio.js';
import { ocupacion, validarCapacidad } from './capacidadForm.utils.js';

const BARRA = { neutral: 'bg-primary', warning: 'bg-retardo', danger: 'bg-ausente' };
const BOTON_PASO = 'flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground focus-visible:ring-4 focus-visible:ring-ring/30 focus-visible:outline-none disabled:opacity-50';

// Capacidad del aula. Muestra cuántos inscritos activos tiene el grupo que se está viendo y no deja bajar de ahí (el servidor valida
// contra todos los grupos del aula). Botones − y + además de teclear, para el teléfono.
export default function CapacidadForm({ aula, inscritosActivos, onSaved, onSucioChange }) {
    const { toast } = useToast();
    const guardar = useApiMutation(aulaGuardar);
    const f = useFormulario({
        inicial: { capacidad: String(aula.capacidad) },
        validar: (v) => validarCapacidad(v, { inscritosActivos }),
        mapearError: (e) => (e.code === 'AULA_CAPACIDAD_INSUFICIENTE' ? { capacidad: e.message } : null),
        onSubmit: async (v) => {
            await guardar.run({ datos: { id_aula: aula.id_aula, clave: aula.clave, edificio: aula.edificio, capacidad: Number(v.capacidad) } });
            toast({ tone: 'success', message: 'Capacidad actualizada.' });
            onSaved?.();
        },
    });
    useAvisarSucio(f.sucio, onSucioChange);

    const campo = f.campo('capacidad');
    const actual = Number(campo.value);
    const piso = Math.max(1, inscritosActivos ?? 1);
    const paso = (delta) => f.setCampo('capacidad', String(Math.max(Number.isInteger(actual) ? actual + delta : piso, 1)));
    // La barra muestra la ocupación frente a la capacidad que se está escribiendo (no la guardada).
    const estado = ocupacion({ inscritosActivos, capacidad: Number.isInteger(actual) && actual > 0 ? actual : aula.capacidad });

    return (
        <form onSubmit={f.enviar} noValidate className="flex max-w-sm flex-col gap-4" aria-label="Capacidad del aula">
            {estado && (
                <div className="flex flex-col gap-1.5">
                    <p className="text-sm">
                        {estado.texto}
                        {estado.estado && <span className={clsx('ml-1.5 font-medium', estado.tono === 'danger' ? 'text-ausente' : 'text-retardo')}>· {estado.estado}</span>}
                    </p>
                    <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className={clsx('h-full rounded-full', BARRA[estado.tono])} style={{ width: `${estado.porcentaje}%` }} />
                    </div>
                </div>
            )}
            <Field label="Capacidad del aula" required error={campo.error} hint="Es del aula: se aplica a todos los grupos que la usan." reserveError>
                <Input
                    {...campo.props}
                    type="text"
                    inputMode="numeric"
                    autoComplete="off"
                    className="max-w-40"
                    startAdornment={
                        <button type="button" onClick={() => paso(-1)} disabled={Number.isInteger(actual) && actual <= piso} aria-label="Quitar un lugar" className={BOTON_PASO}>
                            <Minus aria-hidden="true" className="size-4" strokeWidth={1.75} />
                        </button>
                    }
                    endAdornment={
                        <button type="button" onClick={() => paso(1)} aria-label="Agregar un lugar" className={BOTON_PASO}>
                            <Plus aria-hidden="true" className="size-4" strokeWidth={1.75} />
                        </button>
                    }
                />
            </Field>
            {f.errorEnvio && (
                <Alert tone="danger" compact title="No se pudo guardar el aula">
                    {f.errorEnvio.message}
                </Alert>
            )}
            <FormActions sticky={false} dirty={f.cambios} motivoBloqueo={f.sucio ? undefined : 'Aún no hay cambios que guardar.'}>
                {f.sucio && (
                    <Button variant="secondary" onClick={() => f.reiniciar()} disabled={f.enviando}>
                        Descartar
                    </Button>
                )}
                <Button type="submit" loading={f.enviando} disabled={!f.sucio}>
                    Guardar capacidad
                </Button>
            </FormActions>
        </form>
    );
}
