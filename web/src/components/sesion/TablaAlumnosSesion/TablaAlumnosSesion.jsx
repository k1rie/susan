import Button from '@/components/ui/Button';
import StatusChip from '@/components/ui/StatusChip';
import Table from '@/components/ui/Table';
import { estadoMostrado, etiquetaScore, formatearHoraIso, requiereRegistroManual } from '../MonitorSesion/monitorSesion.utils.js';

export const LECTURAS_REQUERIDAS = 3;

// Alumnos de la sesion (P-03). `onRegistrar(alumno)` solo se ofrece a quien puede registrarse a mano.
export default function TablaAlumnosSesion({ alumnos = [], onRegistrar, puedeRegistrar = false }) {
    const columns = [
        { key: 'matricula', header: 'Matrícula' },
        { key: 'nombre', header: 'Alumno', primary: true },
        { key: 'estado', header: 'Estado', render: (a) => <StatusChip kind="asistencia" value={estadoMostrado(a)} size="sm" /> },
        { key: 'lecturas', header: 'Lecturas', align: 'center', render: (a) => `${a.lecturas_validas ?? 0}/${LECTURAS_REQUERIDAS}` },
        { key: 'mejor_score', header: 'Mejor score', align: 'right', render: (a) => etiquetaScore(a.mejor_score) },
        { key: 'origen', header: 'Origen', render: (a) => (a.origen ? <StatusChip kind="origen" value={a.origen} size="sm" /> : '-') },
        { key: 'hora_registro', header: 'Hora', render: (a) => (a.hora_registro ? formatearHoraIso(a.hora_registro) : '-') },
        {
            key: 'consentimiento',
            header: 'Consentimiento',
            render: (a) => <StatusChip kind="consentimiento" value={a.consentimiento_vigente ? 'vigente' : 'vencido'} size="sm" title={a.consentimiento_vigente ? 'Consentimiento vigente' : 'Sin consentimiento vigente'} />,
        },
    ];
    if (puedeRegistrar && onRegistrar) {
        columns.push({
            key: 'accion',
            header: 'Acción',
            render: (a) =>
                requiereRegistroManual(a) ? (
                    <Button size="sm" variant="secondary" onClick={() => onRegistrar(a)}>
                        Registrar manualmente
                    </Button>
                ) : null,
        });
    }
    return <Table columns={columns} rows={alumnos} rowKey="id_alumno" caption="Alumnos inscritos" emptyMessage="El grupo no tiene alumnos inscritos." />;
}
