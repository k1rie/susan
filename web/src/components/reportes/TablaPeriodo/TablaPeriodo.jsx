import { LineChart } from 'lucide-react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Table from '@/components/ui/Table';
import { porcentaje } from '../reporte.utils.js';

// Situación de riesgo en texto + color: nunca solo color.
function Riesgo({ g }) {
    const limite = Number(g.alumnos_en_limite) || 0;
    const sin = Number(g.alumnos_sin_derecho) || 0;
    if (!limite && !sin) return <Badge tone="success">Sin alertas</Badge>;
    return (
        <span className="flex flex-wrap gap-1">
            {sin > 0 && <Badge tone="danger">{sin} sin derecho</Badge>}
            {limite > 0 && <Badge tone="warning">{limite} en el límite</Badge>}
        </span>
    );
}

// Vista del periodo: una fila por grupo; el nombre abre el reporte del grupo y el icono su analítica.
// Docente, inscritos y sesiones se ocultan en pantallas angostas; el detalle completo va en el CSV.
// Los objetivos táctiles miden 44 px (como el resto del sistema); el margen negativo evita que la fila crezca por ellos.
export default function TablaPeriodo({ items = [], onAbrirGrupo }) {
    const columnas = [
        {
            key: 'clave_grupo', header: 'Grupo',
            render: (g) => (
                <button type="button" onClick={() => onAbrirGrupo(g.id_grupo)} className="-my-2 inline-flex min-h-11 items-center rounded-md font-medium text-link underline focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                    {g.clave_grupo}
                </button>
            ),
        },
        { key: 'materia_nombre', header: 'Materia' },
        { key: 'docente_nombre', header: 'Docente', hideBelow: 'md' },
        { key: 'inscritos', header: 'Inscritos', align: 'right', hideBelow: 'md' },
        { key: 'sesiones', header: 'Sesiones cerradas', align: 'right', hideBelow: 'md', render: (g) => `${g.sesiones_cerradas} / ${g.sesiones_programadas}` },
        { key: 'asistencia_promedio', header: 'Asistencia', align: 'right', render: (g) => (g.asistencia_promedio == null ? '—' : porcentaje(g.asistencia_promedio)) },
        { key: 'riesgo', header: 'Alumnos en riesgo', render: (g) => <Riesgo g={g} /> },
        {
            key: 'analitica', header: <span className="sr-only">Analítica</span>, align: 'right',
            render: (g) => (
                <Link href={`/analitica?grupo=${g.id_grupo}`} aria-label={`Ver analítica del grupo ${g.clave_grupo}`}
                    className="-my-2 inline-flex size-11 items-center justify-center rounded-md text-link hover:bg-accent focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30">
                    <LineChart aria-hidden="true" className="size-4" strokeWidth={1.75} />
                </Link>
            ),
        },
    ];
    return <Table columns={columnas} rows={items} rowKey="id_grupo" caption="Resumen por grupo del periodo" />;
}
