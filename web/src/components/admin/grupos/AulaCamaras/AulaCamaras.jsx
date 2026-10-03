'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import DataState from '@/components/ui/DataState';
import Field from '@/components/ui/Field';
import Input from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation, useApiQuery } from '@/hooks/data';
import { aulaGuardar, aulaObtener } from '@/lib/api/admin.js';
import CamaraForm from '../CamaraForm';

const POSICIONES = ['frente', 'fondo'];

function CapacidadForm({ aula, onSaved }) {
    const { toast } = useToast();
    const guardar = useApiMutation(aulaGuardar);
    const [capacidad, setCapacidad] = useState(String(aula.capacidad));
    const [error, setError] = useState('');

    const enviar = async (e) => {
        e.preventDefault();
        const n = Number(capacidad);
        if (!Number.isInteger(n) || n < 1) {
            setError('La capacidad debe ser un entero positivo.');
            return;
        }
        setError('');
        try {
            await guardar.run({ datos: { id_aula: aula.id_aula, clave: aula.clave, edificio: aula.edificio, capacidad: n } });
            toast({ tone: 'success', message: 'Capacidad actualizada.' });
            onSaved?.();
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo guardar el aula', message: err.message });
        }
    };

    return (
        <form onSubmit={enviar} noValidate className="grid max-w-sm gap-3" aria-label="Capacidad del aula">
            <Field label="Capacidad" required error={error}>
                <Input type="number" min={1} value={capacidad} onChange={(e) => setCapacidad(e.target.value)} />
            </Field>
            <div>
                <Button type="submit" loading={guardar.loading}>
                    Guardar capacidad
                </Button>
            </div>
        </form>
    );
}

// P-09 pestaña Aula y cámaras: capacidad del aula y cámaras frente/fondo (ip | navegador).
export default function AulaCamaras({ idAula, onChanged }) {
    const consulta = useApiQuery(aulaObtener, { idAula });
    const recargar = async () => {
        await consulta.refetch();
        onChanged?.();
    };

    return (
        <DataState loading={consulta.loading} error={consulta.error} data={consulta.data} onRetry={consulta.refetch} isEmpty={() => false}>
            {(aula) => (
                <div className="grid gap-4">
                    <Card title={`Aula ${aula.clave}${aula.edificio ? ` (edificio ${aula.edificio})` : ''}`}>
                        <CapacidadForm key={aula.capacidad} aula={aula} onSaved={recargar} />
                    </Card>
                    <div className="grid gap-4 md:grid-cols-2">
                        {POSICIONES.map((pos) => {
                            const camara = (aula.camaras ?? []).find((c) => c.posicion === pos);
                            return (
                                <Card key={`${pos}-${camara?.id_camara ?? 'nueva'}-${camara?.estatus ?? ''}-${camara?.direccion_ip ?? ''}`}>
                                    <CamaraForm idAula={aula.id_aula} posicion={pos} camara={camara} onSaved={recargar} />
                                </Card>
                            );
                        })}
                    </div>
                </div>
            )}
        </DataState>
    );
}
