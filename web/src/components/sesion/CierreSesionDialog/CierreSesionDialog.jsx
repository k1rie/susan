'use client';

import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { useToast } from '@/components/ui/Toast';
import { useApiMutation } from '@/hooks/data';
import { cerrarSesion } from '@/lib/api/sesiones.js';

// Cierre de la sesion de clase (RF-10, RN-07). El servidor aplica las reglas; aqui solo se explican.
export default function CierreSesionDialog({ open, idSesion, totales, onCancel, onCerrada }) {
    const { toast } = useToast();
    const { run } = useApiMutation(cerrarSesion);

    const confirmar = async () => {
        try {
            const r = await run({ idSesion });
            toast({ tone: 'success', title: 'Sesión cerrada', message: `${r.ausentes_creados ?? 0} ausentes creados, ${r.pendientes ?? 0} pendientes.` });
            onCerrada?.(r);
        } catch (err) {
            toast({ tone: 'danger', title: 'No se pudo cerrar la sesión', message: err.message });
            throw err;
        }
    };

    return (
        <ConfirmDialog open={open} title="Cerrar sesion de clase" confirmLabel="Cerrar sesion" onConfirm={confirmar} onCancel={onCancel}>
            <div className="flex flex-col gap-2 text-sm">
                <p>Al cerrar la sesión:</p>
                <ul className="list-disc pl-5">
                    <li>Los alumnos sin lecturas quedan como ausentes.</li>
                    <li>Los alumnos con 1 o 2 lecturas quedan como pendientes de revisión.</li>
                </ul>
                {totales && (
                    <p className="text-muted-foreground">
                        Sin registro ahora: {totales.sin_registro ?? 0} · Pendientes: {totales.pendientes ?? 0}
                    </p>
                )}
            </div>
        </ConfirmDialog>
    );
}
