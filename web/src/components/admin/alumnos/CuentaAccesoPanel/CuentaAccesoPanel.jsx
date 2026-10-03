'use client';

import { useState } from 'react';
import Alert from '@/components/ui/Alert';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { crearUsuario } from '@/lib/http/admin.js';

// Ofrece crear la cuenta de acceso del alumno. La contraseña temporal llega UNA sola vez: se muestra y
// no se guarda en ningún lado (solo vive en el estado de este componente).
export default function CuentaAccesoPanel({ alumno }) {
    const { toast } = useToast();
    const crear = useApiMutation(crearUsuario);
    const [cuenta, setCuenta] = useState(null);
    const [copiada, setCopiada] = useState(false);

    const crearCuenta = async () => {
        try {
            const r = await crear.run({ correo: alumno.correo_institucional, rol: 'alumno', idAlumno: alumno.id_alumno });
            setCuenta({ correo: r.correo, contrasena: r.contrasena_temporal });
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo crear la cuenta', message: err.message });
        }
    };

    const copiar = async () => {
        try {
            await navigator.clipboard.writeText(cuenta.contrasena);
            setCopiada(true);
        } catch {
            toast({ tone: 'warning', title: 'No se pudo copiar', message: 'Seleccione la contraseña y cópiela manualmente.' });
        }
    };

    return (
        <Card title="Cuenta de acceso">
            {!cuenta ? (
                <div className="flex flex-col gap-3 text-sm">
                    <p>
                        Cree la cuenta con la que el alumno consultará su asistencia. Se usará el correo{' '}
                        <strong>{alumno.correo_institucional}</strong>.
                    </p>
                    <div>
                        <Button onClick={crearCuenta} loading={crear.loading}>
                            Crear cuenta de acceso
                        </Button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-3 text-sm">
                    <Alert tone="warning" title="Copie la contraseña ahora">
                        Se muestra una sola vez y no se podrá consultar después (solo restablecer).
                    </Alert>
                    <p>
                        Usuario: <strong>{cuenta.correo}</strong>
                    </p>
                    <p>
                        Contraseña temporal:{' '}
                        <code data-testid="contrasena-temporal" className="rounded bg-muted px-2 py-1 text-base">
                            {cuenta.contrasena}
                        </code>
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="secondary" onClick={copiar}>
                            Copiar contraseña
                        </Button>
                        {copiada && <span role="status">Copiada.</span>}
                        <Button variant="ghost" onClick={() => setCuenta(null)}>
                            Ya la copié
                        </Button>
                    </div>
                </div>
            )}
        </Card>
    );
}
