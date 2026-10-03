import { Check, Circle } from 'lucide-react';
import clsx from 'clsx';
import { reglasContrasena } from '../CambiarContrasenaForm/contrasena.utils.js';

// Lista de reglas de la contraseña con marca en vivo (patrón del registro de SchoolAI). Cada regla comunica su estado con
// icono + texto ("cumple" / "falta" para lectores de pantalla): nunca solo color.
export default function ReglasContrasena({ nueva = '', confirmacion = '', className }) {
    const reglas = reglasContrasena(nueva, confirmacion);
    return (
        <ul aria-label="Requisitos de la contraseña" className={clsx('flex flex-col gap-1.5 text-sm', className)}>
            {reglas.map((r) => (
                <li key={r.id} className={clsx('flex items-center gap-2 transition-colors duration-200', r.cumple ? 'text-presente' : 'text-muted-foreground')}>
                    {r.cumple ? <Check aria-hidden="true" className="size-4 shrink-0" strokeWidth={2.25} /> : <Circle aria-hidden="true" className="size-4 shrink-0" strokeWidth={1.5} />}
                    <span>{r.texto}</span>
                    <span className="sr-only">{r.cumple ? ' (cumple)' : ' (falta)'}</span>
                </li>
            ))}
        </ul>
    );
}
