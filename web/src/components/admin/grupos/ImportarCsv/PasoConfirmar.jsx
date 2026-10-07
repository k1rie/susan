'use client';

import { Info, TriangleAlert } from 'lucide-react';
import Alert from '@/components/ui/Alert';
import { plural } from '../compartido/grupos.utils.js';
import { estadoCapacidad } from '../InscribirAlumno/inscribirAlumno.utils.js';

// Paso 3: confirmar. Se dice qué va a pasar con la base antes de escribirla (alumnos que se crean, lo que se omite) y si el aula alcanza.
export default function PasoConfirmar({ revision, capacidadAula, activos, error }) {
    const n = revision.paraEnviar.length;
    const capacidad = estadoCapacidad({ capacidad: capacidadAula, activos, enLista: n });
    return (
        <div className="flex flex-col gap-4">
            <p className="text-sm">
                Vas a inscribir <strong>{plural(n, 'alumno')}</strong> en este grupo.
            </p>
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm text-muted-foreground">
                <li>Los alumnos que ya existen se inscriben sin modificar sus datos.</li>
                <li>Los que no existen se crean activos con los datos del archivo (necesitan apellido paterno, nombres y correo).</li>
                {revision.yaInscritas.length > 0 && <li>{plural(revision.yaInscritas.length, 'fila ya inscrita', 'filas ya inscritas')} no se envían.</li>}
                {revision.descartadas.length > 0 && <li>{plural(revision.descartadas.length, 'fila descartada', 'filas descartadas')} no se importan.</li>}
            </ul>
            {capacidad.texto && (
                <p className={`flex items-start gap-1.5 text-[13px] ${capacidad.tono === 'warning' ? 'text-retardo' : 'text-muted-foreground'}`}>
                    {capacidad.tono === 'warning' ? <TriangleAlert aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} /> : <Info aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" strokeWidth={1.75} />}
                    {capacidad.texto}
                </p>
            )}
            {error && (
                <Alert tone="danger" compact title="No se pudo importar">
                    {error.message}
                </Alert>
            )}
        </div>
    );
}
