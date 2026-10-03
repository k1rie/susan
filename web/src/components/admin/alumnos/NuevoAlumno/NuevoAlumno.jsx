'use client';

import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { alumnoCambiarEstatus, alumnoGuardar } from '@/lib/api/admin.js';
import AlumnoForm from '../AlumnoForm';
import CuentaAccesoPanel from '../CuentaAccesoPanel';

// P-06 (alta): crea el alumno; después ofrece su cuenta de acceso y lleva a la ficha para el consentimiento y la foto.
export default function NuevoAlumno() {
    const { toast } = useToast();
    const [guardando, setGuardando] = useState(false);
    const [creado, setCreado] = useState(null);
    const [intento, setIntento] = useState(0);

    const guardar = async ({ datos, estatus }) => {
        setGuardando(true);
        try {
            const r = await alumnoGuardar({ datos });
            // El alta nace activo: otro estatus inicial se aplica con la RPC de cambio de estatus.
            if (estatus && estatus !== 'activo') await alumnoCambiarEstatus({ idAlumno: r.id_alumno, estatus });
            setCreado({ ...r, estatus: estatus || r.estatus });
            toast({ tone: 'success', title: 'Alumno creado', message: r.nombre_completo });
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo guardar el alumno', message: err.message });
        } finally {
            setGuardando(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            <PageHeader title="Nuevo alumno" backHref="/admin/alumnos" backLabel="Volver al listado" />
            {!creado ? (
                <Card title="Datos del alumno">
                    <AlumnoForm key={intento} onSubmit={guardar} loading={guardando} submitLabel="Crear alumno" />
                </Card>
            ) : (
                <>
                    <Alert tone="success" title={`Alumno creado: ${creado.nombre_completo}`}>
                        Siguiente paso: registre el consentimiento firmado y la foto desde su ficha.
                    </Alert>
                    <div className="flex flex-wrap gap-2">
                        <Button href={`/admin/alumnos/${creado.id_alumno}`}>Ir a la ficha (consentimiento y foto)</Button>
                        <Button variant="secondary" onClick={() => { setCreado(null); setIntento((n) => n + 1); }}>
                            Crear otro alumno
                        </Button>
                    </div>
                    <CuentaAccesoPanel alumno={creado} />
                </>
            )}
        </div>
    );
}
