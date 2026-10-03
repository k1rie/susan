import StatCard from '@/components/ui/StatCard';
import TablaAlumnosSesion from '../TablaAlumnosSesion';

// Resumen de solo lectura de una sesion cerrada.
export default function ResumenSesion({ data }) {
    const { alumnos = [], totales = {} } = data;
    return (
        <div className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
                <StatCard label="Inscritos" value={totales.inscritos ?? 0} />
                <StatCard label="Presentes" value={totales.presentes ?? 0} tone="success" />
                <StatCard label="Retardos" value={totales.retardos ?? 0} tone="warning" />
                <StatCard label="Ausentes" value={totales.ausentes ?? 0} tone="danger" />
                <StatCard label="Justificados" value={totales.justificados ?? 0} />
            </div>
            {(totales.pendientes ?? 0) > 0 && <StatCard label="Pendientes de revisión" value={totales.pendientes} href="/docente/revision?pestana=pendientes" tone="warning" />}
            <TablaAlumnosSesion alumnos={alumnos} />
        </div>
    );
}
