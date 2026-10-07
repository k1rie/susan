import { ChevronRight } from 'lucide-react';
import Link from 'next/link';
import Avatar from '@/components/ui/Avatar';
import IndicadorEstado from '../IndicadorEstado';
import EstatusAlumno from '../IndicadorEstado/EstatusAlumno.jsx';

// Fila de alumno para teléfono: la tabla de cinco columnas no cabe en 360 px sin desplazarse, así que ahí cada alumno es una
// tarjeta con su nombre, matrícula y lo que importa de un vistazo: consentimiento, plantilla y, solo si no está activo, su estatus.
export default function FilaAlumno({ alumno: a }) {
    return (
        <Link
            href={`/admin/alumnos/${a.id_alumno}`}
            className="flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-colors duration-150 hover:bg-accent/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
        >
            <Avatar nombre={a.nombre_completo} />
            <span className="min-w-0 flex-1">
                <span className="block truncate text-[14.5px] font-medium leading-tight">{a.nombre_completo}</span>
                <span className="mt-0.5 block text-[13px] text-muted-foreground">{a.matricula}</span>
                <span className="mt-2 flex flex-wrap gap-1.5">
                    {a.estatus !== 'activo' && <EstatusAlumno estatus={a.estatus} />}
                    <IndicadorEstado ok={a.consentimiento_vigente} textoOk="Consentimiento" textoNo="Sin consentimiento" toneNo="warning" />
                    <IndicadorEstado ok={a.plantilla_activa} textoOk="Plantilla" textoNo="Sin plantilla" />
                </span>
            </span>
            <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        </Link>
    );
}
