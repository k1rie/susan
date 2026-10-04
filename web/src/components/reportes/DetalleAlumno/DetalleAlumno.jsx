import Card from '@/components/ui/Card';
import EmptyState from '@/components/ui/EmptyState';
import StatusChip from '@/components/ui/StatusChip';
import Table from '@/components/ui/Table';
import { fechaCorta } from '../reporte.utils.js';

const COLUMNAS = [
    { key: 'fecha', header: 'Fecha', primary: true, render: (d) => fechaCorta(d.fecha) },
    { key: 'hora_inicio', header: 'Hora', hideBelow: 'sm', render: (d) => String(d.hora_inicio || '').slice(0, 5) },
    {
        key: 'estado', header: 'Estado',
        render: (d) => (
            <span className="flex flex-col items-start gap-1">
                {d.estado ? <StatusChip kind="asistencia" value={d.estado} size="sm" /> : 'Sin registro'}
                {/* Solo en pantallas angostas: ui/Table no encoge sus columnas y con tres a 360 px se desplazaría en horizontal; desde sm
                    el justificante tiene su propia columna. El rótulo evita que «Aprobado» se lea como un estado de la asistencia. */}
                {d.justificante_estatus && (
                    <span className="flex flex-col items-start gap-0.5 sm:hidden">
                        <span className="text-xs text-muted-foreground">Justificante</span>
                        <StatusChip kind="justificante" value={d.justificante_estatus} size="sm" />
                    </span>
                )}
            </span>
        ),
    },
    { key: 'origen', header: 'Origen', hideBelow: 'sm', render: (d) => (d.origen ? <StatusChip kind="origen" value={d.origen} size="sm" /> : '—') },
    { key: 'justificante', header: 'Justificante', hideBelow: 'sm', render: (d) => (d.justificante_estatus ? <StatusChip kind="justificante" value={d.justificante_estatus} size="sm" /> : '—') },
];

// Historial de sesiones del alumno seleccionado (modo alumno). Hora, origen y justificante se ocultan en pantallas angostas
// (el justificante pasa bajo el estado).
export default function DetalleAlumno({ detalle }) {
    const filas = detalle || [];
    return (
        <Card title="Detalle por sesión">
            {filas.length === 0 ? (
                <EmptyState title="Sin sesiones registradas para este alumno." />
            ) : (
                <Table columns={COLUMNAS} rows={filas} rowKey="id_sesion" caption="Estado del alumno en cada sesión" />
            )}
        </Card>
    );
}
