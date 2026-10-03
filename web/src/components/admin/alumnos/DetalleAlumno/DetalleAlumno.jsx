'use client';

import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import DataState from '@/components/ui/DataState';
import { useToast } from '@/components/ui/Toast';
import { useApiQuery } from '@/hooks/data';
import { alumnoCambiarEstatus, alumnoGuardar, alumnoObtener } from '@/lib/api/admin.js';
import AlumnoForm from '../AlumnoForm';
import { etiquetaEstatus } from '../AlumnoForm/alumnoForm.utils.js';
import ConsentimientoPanel from '../ConsentimientoPanel';
import PlantillaFacialPanel from '../PlantillaFacialPanel';

// P-06 (ficha): datos editables, consentimiento, plantilla facial y baja lógica.
export default function DetalleAlumno({ idAlumno }) {
    const consulta = useApiQuery(alumnoObtener, { idAlumno });
    const { toast } = useToast();
    const [version, setVersion] = useState(0);
    const [guardando, setGuardando] = useState(false);
    const [confirmaBaja, setConfirmaBaja] = useState(false);
    const recargar = () => {
        setVersion((v) => v + 1);
        consulta.refetch();
    };

    const guardar = async ({ datos, estatus }, alumno) => {
        setGuardando(true);
        try {
            await alumnoGuardar({ datos });
            if (estatus !== alumno.estatus) await alumnoCambiarEstatus({ idAlumno, estatus });
            toast({ tone: 'success', title: 'Datos guardados' });
            await consulta.refetch();
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo guardar', message: err.message });
        } finally {
            setGuardando(false);
        }
    };

    const cambiarEstatus = async (estatus, mensaje) => {
        try {
            const r = await alumnoCambiarEstatus({ idAlumno, estatus });
            toast({
                tone: 'success',
                title: mensaje,
                message: r.inscripciones_dadas_de_baja ? `${r.inscripciones_dadas_de_baja} inscripción(es) dadas de baja.` : undefined,
            });
            setConfirmaBaja(false);
            await consulta.refetch();
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo cambiar el estatus', message: err.message });
            throw err;
        }
    };

    return (
        <DataState loading={consulta.loading} error={consulta.error} data={consulta.data} onRetry={consulta.refetch} isEmpty={() => false}>
            {(a) => (
                <div className="flex flex-col gap-4">
                    <PageHeader
                        title={a.nombre_completo}
                        subtitle={`${a.matricula} · ${etiquetaEstatus(a.estatus)}`}
                        backHref="/admin/alumnos"
                        backLabel="Volver al listado"
                        actions={
                            a.estatus === 'activo' ? (
                                <Button variant="danger" onClick={() => setConfirmaBaja(true)}>
                                    Dar de baja
                                </Button>
                            ) : (
                                <Button variant="secondary" onClick={() => cambiarEstatus('activo', 'Alumno reactivado').catch(() => {})}>
                                    Reactivar
                                </Button>
                            )
                        }
                    />
                    <Card title="Datos del alumno">
                        <AlumnoForm
                            key={`${a.id_alumno}-${a.estatus}-${a.nombre_completo}-${a.correo_institucional}-${a.matricula}`}
                            alumno={a}
                            onSubmit={(v) => guardar(v, a)}
                            loading={guardando}
                            submitLabel="Guardar cambios"
                        />
                    </Card>
                    <ConsentimientoPanel idAlumno={idAlumno} version={version} onCambio={recargar} />
                    <PlantillaFacialPanel idAlumno={idAlumno} version={version} onCambio={recargar} />
                    {a.inscripciones?.length > 0 && (
                        <Card title="Inscripciones">
                            <ul className="flex flex-col gap-1 text-sm">
                                {a.inscripciones.map((i) => (
                                    <li key={i.id_inscripcion}>
                                        {i.materia_clave} · grupo {i.clave_grupo} · {i.periodo} · {i.estatus}
                                    </li>
                                ))}
                            </ul>
                        </Card>
                    )}
                    <ConfirmDialog
                        open={confirmaBaja}
                        title="Dar de baja al alumno"
                        message="Baja lógica: se conserva todo su historial y se dan de baja sus inscripciones activas. Podrá reactivarlo, pero tendrá que reinscribirlo."
                        confirmLabel="Dar de baja"
                        variant="danger"
                        onConfirm={() => cambiarEstatus('baja_definitiva', 'Alumno dado de baja')}
                        onCancel={() => setConfirmaBaja(false)}
                    />
                </div>
            )}
        </DataState>
    );
}
