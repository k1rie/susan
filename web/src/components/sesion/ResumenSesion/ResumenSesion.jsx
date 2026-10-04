import { CircleCheck, ClipboardCheck, Clock, FileCheck, UserX, Users } from 'lucide-react';
import StatCard from '@/components/ui/StatCard';
import GraficaAsistenciaSesion from '../GraficaAsistenciaSesion';
import TablaAlumnosSesion from '../TablaAlumnosSesion';

// Resumen de solo lectura de una sesion cerrada: anillo con los cinco estados y las cifras (cada una con su icono y su cifra animada)
// que piden decisión. Los pendientes de revisión solo aparecen si los hay, y llevan a la cola de revisión.
export default function ResumenSesion({ data }) {
    const { alumnos = [], totales = {} } = data;
    const pendientes = totales.pendientes ?? 0;
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                <GraficaAsistenciaSesion totales={totales} cerrada />
                <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Inscritos" value={totales.inscritos ?? 0} icon={Users} animated />
                    <StatCard label="Presentes" value={totales.presentes ?? 0} tone="success" icon={CircleCheck} animated />
                    <StatCard label="Retardos" value={totales.retardos ?? 0} tone="warning" icon={Clock} animated />
                    <StatCard label="Ausentes" value={totales.ausentes ?? 0} tone="danger" icon={UserX} animated />
                    <StatCard label="Justificados" value={totales.justificados ?? 0} icon={FileCheck} animated />
                    {pendientes > 0 && <StatCard label="Pendientes" value={pendientes} hint="Resolver en Revisión" href="/docente/revision?pestana=pendientes" tone="warning" icon={ClipboardCheck} animated />}
                </div>
            </div>
            <TablaAlumnosSesion alumnos={alumnos} />
        </div>
    );
}
