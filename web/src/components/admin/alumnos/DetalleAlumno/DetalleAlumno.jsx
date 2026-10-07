'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Badge from '@/components/ui/Badge';
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
import CuentaAccesoPanel from '../CuentaAccesoPanel';
import useCuentaAcceso from '../CuentaAccesoPanel/useCuentaAcceso.js';
import PlantillaFacialPanel from '../PlantillaFacialPanel';
import { inscripcionesActivas, resumenFicha, textosConfirmacionEstatus } from './detalleAlumno.utils.js';
import ResumenFicha from './ResumenFicha.jsx';

// P-06 (ficha): resumen de lo que falta, datos editables, consentimiento, plantilla facial, cuenta de acceso e inscripciones.
// La baja o el egreso se confirman en un solo diálogo, se pida desde el encabezado o desde el formulario.
export default function DetalleAlumno({ idAlumno }) {
    const consulta = useApiQuery(alumnoObtener, { idAlumno });
    const cuenta = useCuentaAcceso(consulta.data);
    const { toast } = useToast();
    const [version, setVersion] = useState(0);
    // Confirmación pendiente: { estatus, nombre, inscripciones, resolver }. `pedirConfirmacion` devuelve una promesa con la respuesta.
    const [confirmacion, setConfirmacion] = useState(null);
    const recargar = () => {
        setVersion((v) => v + 1);
        consulta.refetch();
    };

    // Los enlaces del alta (`/admin/alumnos/9#consentimiento`) llegan antes de que exista la tarjeta, porque la ficha carga después:
    // el navegador no encuentra el ancla. Al tener la ficha se salta a ella, y otra vez poco después por si las tarjetas de abajo
    // (que cargan sus propios datos) movieron el destino.
    const hayFicha = Boolean(consulta.data);
    useEffect(() => {
        if (!hayFicha) return undefined;
        const id = decodeURIComponent(window.location.hash.slice(1));
        if (!id) return undefined;
        const saltar = () => document.getElementById(id)?.scrollIntoView?.();
        saltar();
        const tarde = setTimeout(saltar, 700);
        return () => clearTimeout(tarde);
    }, [hayFicha]);

    const pedirConfirmacion = (estatus, alumno) =>
        new Promise((resolver) => {
            setConfirmacion({ estatus, nombre: alumno.nombre_completo, inscripciones: inscripcionesActivas(alumno), resolver });
        });
    const responder = (acepta) => {
        confirmacion?.resolver(acepta);
        setConfirmacion(null);
    };

    // Guardar datos y cambiar el estatus son dos RPC: se llama solo a las que hacen falta y, si la segunda falla, se dice qué sí se
    // guardó (nunca «No se pudo guardar» cuando el registro ya cambió). Devuelve false si la persona canceló la confirmación; si una
    // RPC falla sin haber guardado nada, el error vuelve al formulario, que lo pega al campo (matrícula o correo duplicados…).
    const guardar = async ({ datos, estatus, cambioDatos, cambioEstatus }, alumno) => {
        if (cambioEstatus && estatus !== 'activo' && !(await pedirConfirmacion(estatus, alumno))) return false;
        let datosGuardados = false;
        try {
            if (cambioDatos) {
                await alumnoGuardar({ datos });
                datosGuardados = true;
            }
            if (cambioEstatus) {
                const r = await alumnoCambiarEstatus({ idAlumno, estatus });
                toast({
                    tone: 'success',
                    title: cambioDatos ? 'Datos y estatus guardados' : `Estatus: ${etiquetaEstatus(estatus)}`,
                    message: r.inscripciones_dadas_de_baja ? `${r.inscripciones_dadas_de_baja} inscripción(es) dadas de baja.` : undefined,
                });
            } else {
                toast({ tone: 'success', title: 'Datos guardados' });
            }
        } catch (err) {
            if (!datosGuardados) throw err;
            toast({
                tone: 'warning',
                title: 'Se guardaron los datos, pero no el estatus',
                message: err.message,
                durationMs: 10000,
            });
        }
        await consulta.refetch();
        return true;
    };

    const reactivar = async () => {
        try {
            await alumnoCambiarEstatus({ idAlumno, estatus: 'activo' });
            toast({ tone: 'success', title: 'Alumno reactivado', message: 'Sus inscripciones no se restituyen: inscríbelo de nuevo en cada grupo.' });
            await consulta.refetch();
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo reactivar', message: err.message });
        }
    };

    // Baja desde el encabezado: pasa por la misma confirmación que el formulario.
    const darDeBaja = async (alumno) => {
        if (!(await pedirConfirmacion('baja_definitiva', alumno))) return;
        try {
            const r = await alumnoCambiarEstatus({ idAlumno, estatus: 'baja_definitiva' });
            toast({
                tone: 'success',
                title: 'Alumno dado de baja',
                message: r.inscripciones_dadas_de_baja ? `${r.inscripciones_dadas_de_baja} inscripción(es) dadas de baja.` : undefined,
            });
            await consulta.refetch();
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo dar de baja', message: err.message });
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
                                <Button variant="danger" onClick={() => darDeBaja(a)}>
                                    Dar de baja
                                </Button>
                            ) : (
                                <Button variant="secondary" onClick={reactivar}>
                                    Reactivar
                                </Button>
                            )
                        }
                    />
                    <ResumenFicha items={resumenFicha(a, cuenta)} />
                    <Card id="datos" title="Datos del alumno" className="scroll-mt-20 lg:scroll-mt-4">
                        <AlumnoForm
                            key={`${a.id_alumno}-${a.estatus}-${a.nombre_completo}-${a.correo_institucional}-${a.matricula}`}
                            alumno={a}
                            onSubmit={(v) => guardar(v, a)}
                            submitLabel="Guardar cambios"
                            inscripcionesActivas={inscripcionesActivas(a)}
                        />
                    </Card>
                    <ConsentimientoPanel idAlumno={idAlumno} version={version} onCambio={recargar} alumnoActivo={a.estatus === 'activo'} />
                    {/* Ancla del enlace «registrar la plantilla»: PlantillaFacialPanel no se toca (trabajo del asistente facial), así que el destino es este elemento vacío; el margen negativo anula el hueco que añade el `gap`. */}
                    <span id="plantilla" className="-mt-4 scroll-mt-20 lg:scroll-mt-4" />
                    <PlantillaFacialPanel idAlumno={idAlumno} version={version} onCambio={recargar} />
                    <CuentaAccesoPanel alumno={a} cuenta={cuenta} />
                    <Card id="inscripciones" title="Inscripciones" className="scroll-mt-20 lg:scroll-mt-4">
                        {a.inscripciones?.length > 0 ? (
                            <ul className="flex flex-col gap-2">
                                {a.inscripciones.map((i) => (
                                    <li key={i.id_inscripcion} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm">
                                        <Link href={`/admin/grupos/${i.id_grupo}`} className="min-w-0 font-medium text-link underline-offset-2 hover:underline">
                                            {i.materia_clave} · grupo {i.clave_grupo} · {i.periodo}
                                        </Link>
                                        <Badge tone={i.estatus === 'activa' ? 'success' : 'neutral'}>{i.estatus === 'activa' ? 'Activa' : 'Baja'}</Badge>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-sm text-muted-foreground">
                                Aún no está inscrito en ningún grupo. Se inscribe desde el grupo, en la pestaña Inscripciones, buscándolo por su matrícula.{' '}
                                <Link href="/admin/grupos" className="font-medium text-link underline-offset-2 hover:underline">
                                    Ver grupos
                                </Link>
                            </p>
                        )}
                    </Card>
                    <ConfirmDialog
                        open={Boolean(confirmacion)}
                        {...(confirmacion ? textosConfirmacionEstatus(confirmacion) : {})}
                        variant="danger"
                        onConfirm={() => responder(true)}
                        onCancel={() => responder(false)}
                    />
                </div>
            )}
        </DataState>
    );
}
