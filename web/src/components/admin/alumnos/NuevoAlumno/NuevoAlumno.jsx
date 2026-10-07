'use client';

import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import AltaAlumno from './AltaAlumno.jsx';

// P-06 (alta): asistente de tres pasos (Identidad, Contacto y acceso, Revisión) que termina en una pantalla de éxito con los
// siguientes pasos del alumno. «Crear otro alumno» monta el asistente de cero con otra `key`.
export default function NuevoAlumno() {
    const [intento, setIntento] = useState(0);
    return (
        <div className="flex flex-col gap-4">
            <PageHeader title="Nuevo alumno" subtitle="Tres pasos cortos; antes de crearlo lo revisas." backHref="/admin/alumnos" backLabel="Volver al listado" />
            <AltaAlumno key={intento} onOtro={() => setIntento((n) => n + 1)} />
        </div>
    );
}
