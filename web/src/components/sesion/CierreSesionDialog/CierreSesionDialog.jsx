'use client';

import clsx from 'clsx';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { cerrarSesion } from '@/lib/api/sesiones.js';

// Qué pasa con cada grupo al cerrar. Siempre texto + color (el punto solo refuerza). `ocultarEnCero`: lo que no aplica no estorba.
const RESUMEN = [
    { clave: 'presentes', etiqueta: 'Presentes', punto: 'bg-presente' },
    { clave: 'retardos', etiqueta: 'Retardos', punto: 'bg-retardo' },
    { clave: 'ausentes', etiqueta: 'Ausentes marcados', punto: 'bg-ausente', ocultarEnCero: true },
    { clave: 'sin_registro', etiqueta: 'Sin registro', nota: 'Quedarán como ausentes', punto: 'bg-ausente' },
    { clave: 'pendientes', etiqueta: 'Pendientes', nota: 'Pasan a Revisión', punto: 'bg-pendiente', ocultarEnCero: true },
];

// Cierre de la sesión de clase (RF-10, RN-07). El servidor aplica las reglas; aquí solo se explican, con el resumen de lo que se cierra.
//   totales        = { presentes, retardos, ausentes?, sin_registro, pendientes } (los del monitor, o los de las marcas en pantalla).
//   modo           = 'automatico' (por omisión) | 'manual': cambia la explicación (sin lecturas de cámara).
//   antesDeCerrar  = () => Promise: se ejecuta antes de cerrar (el pase manual guarda ahí las marcas). Si rechaza, no se cierra y el
//                    diálogo queda abierto para reintentar.
export default function CierreSesionDialog({ open, idSesion, totales, modo = 'automatico', antesDeCerrar, onCancel, onCerrada }) {
    const { toast } = useToast();
    const { run } = useApiMutation(cerrarSesion);
    const manual = modo === 'manual';

    const confirmar = async () => {
        if (antesDeCerrar) {
            try {
                await antesDeCerrar();
            } catch (err) {
                toast({ tone: 'danger', title: 'No se pudo guardar el pase de lista', message: err.message });
                throw err;
            }
        }
        try {
            const r = await run({ idSesion });
            toast({ tone: 'success', title: 'Sesión cerrada', message: `${r.ausentes_creados ?? 0} ausentes creados, ${r.pendientes ?? 0} pendientes.` });
            onCerrada?.(r);
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo cerrar la sesión', message: err.message });
            throw err;
        }
    };

    const filas = totales ? RESUMEN.filter((f) => totales[f.clave] != null && !(f.ocultarEnCero && Number(totales[f.clave]) === 0)) : [];

    return (
        <ConfirmDialog open={open} title="Cerrar sesión de clase" confirmLabel="Cerrar sesión" onConfirm={confirmar} onCancel={onCancel}>
            <div className="flex flex-col gap-3 text-sm">
                <div>
                    <p>Al cerrar la sesión:</p>
                    <ul className="mt-1 list-disc pl-5">
                        {manual ? (
                            <>
                                <li>Se guardan las marcas que tienes en pantalla.</li>
                                <li>Los alumnos sin marcar quedan como ausentes.</li>
                            </>
                        ) : (
                            <>
                                <li>Los alumnos sin lecturas quedan como ausentes.</li>
                                <li>Los alumnos con 1 o 2 lecturas quedan como pendientes de revisión.</li>
                            </>
                        )}
                    </ul>
                </div>
                {filas.length > 0 && (
                    <dl aria-label="Resumen de lo que se cierra" className="grid grid-cols-2 gap-2">
                        {filas.map((f, i) => (
                            <div key={f.clave} className={clsx('rounded-lg border border-border px-3 py-2', filas.length % 2 === 1 && i === filas.length - 1 && 'col-span-2')}>
                                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                    <span aria-hidden="true" className={clsx('size-2 shrink-0 rounded-full', f.punto)} />
                                    {f.etiqueta}
                                </dt>
                                <dd>
                                    <span className="block text-lg font-semibold leading-tight tabular-nums">{totales[f.clave]}</span>
                                    {f.nota && <span className="block text-xs text-muted-foreground">{f.nota}</span>}
                                </dd>
                            </div>
                        ))}
                    </dl>
                )}
            </div>
        </ConfirmDialog>
    );
}
