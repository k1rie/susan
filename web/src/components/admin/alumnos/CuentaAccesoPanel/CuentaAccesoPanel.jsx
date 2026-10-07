'use client';

import Link from 'next/link';
import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import { useApiMutation } from '@/hooks/data';
import { crearUsuario } from '@/lib/http/admin.js';
import PasswordTemporalModal from '@/components/admin/catalogos/PasswordTemporalModal';

const INSIGNIA = {
    cargando: { tone: 'neutral', texto: 'Comprobando' },
    error: { tone: 'warning', texto: 'Sin comprobar' },
    sin: { tone: 'neutral', texto: 'Sin cuenta' },
    activa: { tone: 'success', texto: 'Cuenta activa' },
    inactiva: { tone: 'warning', texto: 'Cuenta desactivada' },
};

// Cuenta de acceso del alumno: dice si ya existe y, si no, permite crearla desde la ficha. La contraseña temporal llega UNA sola vez
// (la muestra PasswordTemporalModal y se descarta al cerrarlo); restablecerla o desactivar la cuenta se hace en Usuarios.
//   alumno  { id_alumno, nombre_completo, correo_institucional, estatus }
//   cuenta  resultado de useCuentaAcceso(alumno); la ficha lo comparte con su resumen para no preguntarlo dos veces.
export default function CuentaAccesoPanel({ alumno, cuenta }) {
    const crear = useApiMutation(crearUsuario);
    const [credencial, setCredencial] = useState(null);
    const [errorCrear, setErrorCrear] = useState(null);
    const activo = alumno.estatus === 'activo';
    const insignia = INSIGNIA[cuenta.estado];

    const crearCuenta = async () => {
        setErrorCrear(null);
        try {
            const r = await crear.run({ correo: alumno.correo_institucional, rol: 'alumno', idAlumno: alumno.id_alumno });
            setCredencial({ correo: r.correo, contrasena: r.contrasena_temporal });
        } catch (err) {
            setErrorCrear(err.message);
        }
        // Con éxito o con error (p. ej. «ya tiene cuenta» por una carrera) se vuelve a preguntar el estado real.
        await cuenta.refetch();
    };

    return (
        <Card id="cuenta" title="Cuenta de acceso" className="scroll-mt-20 lg:scroll-mt-4" actions={<Badge tone={insignia.tone}>{insignia.texto}</Badge>}>
            <div className="flex flex-col gap-3 text-sm">
                {cuenta.estado === 'cargando' && (
                    <p className="flex items-center gap-2 text-muted-foreground">
                        <Spinner size="sm" label="Comprobando la cuenta" />
                        Comprobando si ya tiene cuenta…
                    </p>
                )}

                {cuenta.estado === 'error' && (
                    <>
                        <Alert tone="warning" compact title="No se pudo comprobar la cuenta">
                            {cuenta.error?.message ?? 'Inténtalo de nuevo.'}
                        </Alert>
                        <div>
                            <Button variant="secondary" onClick={() => cuenta.refetch()}>
                                Reintentar
                            </Button>
                        </div>
                    </>
                )}

                {cuenta.estado === 'sin' && (
                    <>
                        <p>
                            Con su cuenta, {alumno.nombre_completo} consulta su asistencia y sus justificantes. Se crea con el correo{' '}
                            <strong className="break-all">{alumno.correo_institucional}</strong> y una contraseña temporal que verás una sola vez.
                        </p>
                        {!activo && (
                            <Alert tone="info" compact>
                                Solo se crea cuenta para un alumno activo.
                            </Alert>
                        )}
                        {errorCrear && (
                            <Alert tone="danger" compact title="No se pudo crear la cuenta">
                                {errorCrear}
                            </Alert>
                        )}
                        <div>
                            <Button onClick={crearCuenta} loading={crear.loading} disabled={!activo}>
                                Crear cuenta de acceso
                            </Button>
                        </div>
                    </>
                )}

                {(cuenta.estado === 'activa' || cuenta.estado === 'inactiva') && (
                    <>
                        <dl className="flex flex-col gap-1.5">
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                                <dt className="text-[13px] text-muted-foreground sm:w-28 sm:shrink-0">Usuario</dt>
                                <dd className="min-w-0 break-all">{cuenta.cuenta.correo}</dd>
                            </div>
                            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-4">
                                <dt className="text-[13px] text-muted-foreground sm:w-28 sm:shrink-0">Estado</dt>
                                <dd>{cuenta.estado === 'activa' ? 'Puede iniciar sesión.' : 'No puede iniciar sesión hasta que se reactive.'}</dd>
                            </div>
                        </dl>
                        <p className="text-[13px] text-muted-foreground">
                            Para restablecer la contraseña o desactivar la cuenta, ve a{' '}
                            <Link href="/admin/usuarios" className="font-medium text-link underline-offset-2 hover:underline">
                                Usuarios
                            </Link>
                            .
                        </p>
                    </>
                )}
            </div>

            <PasswordTemporalModal
                open={Boolean(credencial)}
                correo={credencial?.correo}
                contrasena={credencial?.contrasena}
                titulo="Cuenta de acceso creada"
                onClose={() => setCredencial(null)}
            />
        </Card>
    );
}
