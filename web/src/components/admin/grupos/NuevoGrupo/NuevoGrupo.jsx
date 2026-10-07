'use client';

import { useState } from 'react';
import PageHeader from '@/components/layout/PageHeader';
import Card from '@/components/ui/Card';
import Spinner from '@/components/ui/Spinner';
import { periodoSugerido } from '../GrupoForm/grupoForm.utils.js';
import { useHoyNegocio } from '../compartido/useHoyNegocio.js';
import AsistenteGrupo from './AsistenteGrupo.jsx';

// Alta de grupo (/admin/grupos/nuevo): asistente de 3 pasos que termina en una pantalla de éxito con los siguientes pasos reales
// (generar sesiones, inscribir alumnos, configurar la cámara del aula). No vuelve a la lista ni aterriza en la pestaña Datos.
//   materiaInicial / aulaInicial: ids de ?materia= y ?aula= (ya validados como enteros positivos por la página) para preseleccionar.
export default function NuevoGrupo({ materiaInicial, aulaInicial }) {
    const { hoy, listo } = useHoyNegocio();
    // «Crear otro grupo» remonta el asistente con estado limpio.
    const [ronda, setRonda] = useState(0);

    return (
        <div className="flex flex-col gap-4">
            <PageHeader title="Nuevo grupo" subtitle="Materia, docente, aula y horario en tres pasos" backHref="/admin/grupos" backLabel="Volver a grupos" />
            <Card>
                {listo ? (
                    <AsistenteGrupo key={ronda} periodoInicial={periodoSugerido(hoy)} materiaInicial={materiaInicial} aulaInicial={aulaInicial} onOtro={() => setRonda((n) => n + 1)} />
                ) : (
                    <div className="flex justify-center py-10">
                        <Spinner />
                    </div>
                )}
            </Card>
        </div>
    );
}
