import StatCard from '@/components/ui/StatCard';
import GraficaAsistenciaSesion from '../GraficaAsistenciaSesion';
import TablaAlumnosSesion from '../TablaAlumnosSesion';

// Resumen de solo lectura de una sesion cerrada: dona con los cinco estados y las cifras que piden decisión.
export default function ResumenSesion({ data }) {
    const { alumnos = [], totales = {} } = data;
    const pendientes = totales.pendientes ?? 0;
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-start">
                <GraficaAsistenciaSesion totales={totales} cerrada />
                <div className="grid grid-cols-2 gap-3">
                    <StatCard label="Inscritos" value={totales.inscritos ?? 0} />
                    <StatCard label="Presentes" value={totales.presentes ?? 0} tone="success" />
                    <StatCard label="Retardos" value={totales.retardos ?? 0} tone="warning" />
                    <StatCard label="Ausentes" value={totales.ausentes ?? 0} tone="danger" />
                    <StatCard label="Justificados" value={totales.justificados ?? 0} />
                    {pendientes > 0 && <StatCard label="Pendientes de revisión" value={pendientes} href="/docente/revision?pestana=pendientes" tone="warning" />}
                </div>
            </div>
            <TablaAlumnosSesion alumnos={alumnos} />
        </div>
    );
}
